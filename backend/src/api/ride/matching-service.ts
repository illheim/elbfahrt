/**
 * Matching service (v2.0 Stage 2). Invoked fire-and-forget from the ride
 * lifecycle when an Angebot is created or (re)activated. Scans active Gesuche,
 * runs the pure matcher, and emails each rider whose Gesuch fits — once per ride
 * (idempotent via the match-notification ledger).
 *
 * Kill switch: set MATCH_NOTIFY_ENABLED=false to disable notifications.
 * Ride links use FRONTEND_URL (default https://elb-fahrt.de).
 */

import {
  matchRideToRequest,
  type MatchRide,
  type MatchGesuch,
  type GeoPoint,
} from './matching';

const num = (v: unknown): number =>
  typeof v === 'number' ? v : parseFloat(String(v));

const point = (lat: unknown, lng: unknown): GeoPoint => ({
  lat: num(lat),
  lng: num(lng),
});

function toMatchRide(ride: any, seatsConfirmed: number): MatchRide {
  return {
    status: ride.status,
    recurrence: ride.recurrence,
    recurrence_weekdays: ride.recurrence_weekdays ?? null,
    recurrence_until: ride.recurrence_until ?? null,
    departure_at: ride.departure_at,
    seats_total: ride.seats_total,
    seats_confirmed: seatsConfirmed,
    driver_id: ride.driver?.id ?? null,
    origin: point(ride.origin_lat, ride.origin_lng),
    destination: point(ride.destination_lat, ride.destination_lng),
    waypoints: Array.isArray(ride.waypoints)
      ? ride.waypoints.map((w: any) => point(w.lat, w.lng))
      : [],
  };
}

function toMatchGesuch(g: any): MatchGesuch {
  return {
    status: g.status,
    notify_on_match: g.notify_on_match ?? true,
    passenger_id: g.passenger?.id ?? -1,
    recurrence: g.recurrence,
    recurrence_weekdays: g.recurrence_weekdays ?? null,
    recurrence_until: g.recurrence_until ?? null,
    departure_at: g.departure_at,
    departure_window_min: null, // global default (90 min) for v1
    seats_needed: g.seats_needed,
    origin: point(g.origin_lat, g.origin_lng),
    destination: point(g.destination_lat, g.destination_lng),
    origin_radius_m: g.origin_radius_m ?? null,
    destination_radius_m: g.destination_radius_m ?? null,
    flexible_origin: !!g.flexible_origin,
    flexible_destination: !!g.flexible_destination,
  };
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

async function sendMatchEmail(
  strapi: any,
  passenger: any,
  ride: any,
  frontendUrl: string
): Promise<void> {
  const base = frontendUrl.replace(/\/$/, '');
  const link = `${base}/rides/${ride.documentId}`;
  const settingsLink = `${base}/meine-fahrten`;
  const name = passenger.first_name ? ` ${passenger.first_name}` : '';
  const when = fmtWhen(ride.departure_at);
  const subject = 'Neue passende Mitfahrt auf elb-fahrt.de';
  const text =
    `Hallo${name},\n\n` +
    `es wurde eine Fahrt eingetragen, die zu Ihrem Gesuch passt:\n\n` +
    `${ride.origin_address} → ${ride.destination_address}\n` +
    `Abfahrt: ${when}\n\n` +
    `Fahrt ansehen und anfragen:\n${link}\n\n` +
    `Sie erhalten diese E-Mail, weil Sie bei Ihrem Gesuch Benachrichtigungen ` +
    `aktiviert haben. Unter „Meine Fahrten" können Sie die Benachrichtigung ` +
    `jederzeit deaktivieren:\n${settingsLink}`;
  const html =
    `<p>Hallo${name},</p>` +
    `<p>es wurde eine Fahrt eingetragen, die zu Ihrem Gesuch passt:</p>` +
    `<p><strong>${ride.origin_address} → ${ride.destination_address}</strong><br>` +
    `Abfahrt: ${when}</p>` +
    `<p><a href="${link}">Fahrt ansehen und anfragen</a></p>` +
    `<p style="color:#666;font-size:13px">Sie erhalten diese E-Mail, weil Sie bei ` +
    `Ihrem Gesuch Benachrichtigungen aktiviert haben. Sie können die ` +
    `Benachrichtigung jederzeit <a href="${settingsLink}" style="color:#666">` +
    `deaktivieren</a>.</p>`;
  await strapi.plugin('email').service('email').send({ to: passenger.email, subject, text, html });
}

/** Match a freshly created/activated ride against all active Gesuche. */
export async function runMatchingForRide(
  strapi: any,
  rideId: number
): Promise<void> {
  if (process.env.MATCH_NOTIFY_ENABLED === 'false') return;

  const ride = await strapi.db.query('api::ride.ride').findOne({
    where: { id: rideId },
    populate: { driver: { select: ['id'] }, waypoints: true },
  });
  if (!ride || ride.status !== 'active') {
    strapi.log.info(`[matching] ride ${rideId}: not active, skipping.`);
    return;
  }

  const seatsConfirmed = await strapi.db.query('api::booking.booking').count({
    where: { ride: ride.id, status: 'confirmed' },
  });
  const matchRide = toMatchRide(ride, seatsConfirmed);

  const gesuche = await strapi.db.query('api::ride-request.ride-request').findMany({
    where: { status: 'active', notify_on_match: true },
    populate: { passenger: { select: ['id', 'email', 'first_name'] } },
  });

  const frontendUrl = process.env.FRONTEND_URL ?? 'https://elb-fahrt.de';
  let matched = 0;
  let sent = 0;

  for (const g of gesuche) {
    try {
      if (!g.passenger?.email) continue;
      const result = matchRideToRequest(matchRide, toMatchGesuch(g));
      if (!result.match) {
        strapi.log.debug(`[matching] ride ${rideId} × gesuch ${g.id}: ${result.reason}`);
        continue;
      }
      matched++;

      const already = await strapi.db
        .query('api::match-notification.match-notification')
        .count({ where: { ride: ride.id, ride_request: g.id } });
      if (already > 0) continue;

      await sendMatchEmail(strapi, g.passenger, ride, frontendUrl);
      await strapi.db.query('api::match-notification.match-notification').create({
        data: {
          ride: ride.id,
          ride_request: g.id,
          sent_at: new Date(),
          channel: 'email',
        },
      });
      sent++;
    } catch (err) {
      strapi.log.error(`[matching] gesuch ${g?.id} failed: ${err}`);
    }
  }

  strapi.log.info(
    `[matching] ride ${rideId}: scanned ${gesuche.length} active Gesuch(e), ` +
      `${matched} matched, ${sent} emailed.`
  );
}

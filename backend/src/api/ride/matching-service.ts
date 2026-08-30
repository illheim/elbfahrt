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

const FRONTEND_URL = () => process.env.FRONTEND_URL ?? 'https://elb-fahrt.de';

/** Confirmed-booking count for a ride (one-off capacity). */
async function seatsConfirmed(strapi: any, rideId: number): Promise<number> {
  return strapi.db.query('api::booking.booking').count({
    where: { ride: rideId, status: 'confirmed' },
  });
}

/**
 * Email the Gesuch's rider about a matching ride — once per (ride, gesuch) pair.
 * The ledger makes this idempotent across BOTH match directions, so a rider is
 * never emailed twice for the same ride. Returns true if an email was sent.
 */
async function notifyMatch(
  strapi: any,
  ride: any,
  gesuch: any
): Promise<boolean> {
  if (!gesuch.passenger?.email) return false;
  const already = await strapi.db
    .query('api::match-notification.match-notification')
    .count({ where: { ride: ride.id, ride_request: gesuch.id } });
  if (already > 0) return false;

  await sendMatchEmail(strapi, gesuch.passenger, ride, FRONTEND_URL());
  await strapi.db.query('api::match-notification.match-notification').create({
    data: { ride: ride.id, ride_request: gesuch.id, sent_at: new Date(), channel: 'email' },
  });
  return true;
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

  const matchRide = toMatchRide(ride, await seatsConfirmed(strapi, ride.id));

  // Scan ALL active Gesuche and let the matcher decide on notifications: a
  // legacy row created before `notify_on_match` existed has NULL (Strapi does
  // not backfill defaults), which the matcher treats as opt-in (`?? true`).
  const gesuche = await strapi.db.query('api::ride-request.ride-request').findMany({
    where: { status: 'active' },
    populate: { passenger: { select: ['id', 'email', 'first_name'] } },
  });

  let matched = 0;
  let sent = 0;
  for (const g of gesuche) {
    try {
      const result = matchRideToRequest(matchRide, toMatchGesuch(g));
      if (!result.match) {
        strapi.log.debug(`[matching] ride ${rideId} × gesuch ${g.id}: ${result.reason}`);
        continue;
      }
      matched++;
      if (await notifyMatch(strapi, ride, g)) sent++;
    } catch (err) {
      strapi.log.error(`[matching] gesuch ${g?.id} failed: ${err}`);
    }
  }

  strapi.log.info(
    `[matching] ride ${rideId}: scanned ${gesuche.length} active Gesuch(e), ` +
      `${matched} matched, ${sent} emailed.`
  );
}

/**
 * Reverse direction (beta bug B2): match a freshly created/activated Gesuch
 * against all active rides, emailing the rider about any that already fit — so a
 * rider who posts a Gesuch after a matching ride exists is notified immediately.
 */
export async function runMatchingForGesuch(
  strapi: any,
  gesuchId: number
): Promise<void> {
  if (process.env.MATCH_NOTIFY_ENABLED === 'false') return;

  const gesuch = await strapi.db.query('api::ride-request.ride-request').findOne({
    where: { id: gesuchId },
    populate: { passenger: { select: ['id', 'email', 'first_name'] } },
  });
  if (!gesuch || gesuch.status !== 'active' || !gesuch.passenger?.email) {
    strapi.log.info(`[matching] gesuch ${gesuchId}: not active / no email, skipping.`);
    return;
  }
  const matchGesuch = toMatchGesuch(gesuch);

  const rides = await strapi.db.query('api::ride.ride').findMany({
    where: { status: 'active' },
    populate: { driver: { select: ['id'] }, waypoints: true },
  });

  let matched = 0;
  let sent = 0;
  for (const ride of rides) {
    try {
      const matchRide = toMatchRide(ride, await seatsConfirmed(strapi, ride.id));
      const result = matchRideToRequest(matchRide, matchGesuch);
      if (!result.match) {
        strapi.log.debug(`[matching] gesuch ${gesuchId} × ride ${ride.id}: ${result.reason}`);
        continue;
      }
      matched++;
      if (await notifyMatch(strapi, ride, gesuch)) sent++;
    } catch (err) {
      strapi.log.error(`[matching] ride ${ride?.id} failed: ${err}`);
    }
  }

  strapi.log.info(
    `[matching] gesuch ${gesuchId}: scanned ${rides.length} active ride(s), ` +
      `${matched} matched, ${sent} emailed.`
  );
}

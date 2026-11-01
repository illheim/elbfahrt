/**
 * Sends the booking notification emails (templates in booking-emails.ts).
 * Always fire-and-forget from the controllers: a mail problem must never fail
 * or slow down a booking or a cancellation — failures are only logged.
 *
 * Kill switch: BOOKING_NOTIFY_ENABLED=false disables these mails.
 * Links use FRONTEND_URL (default https://elb-fahrt.de).
 */

import { buildBookingEmail, type BookingEmailKind } from './booking-emails';

const PARTY_FIELDS = ['email', 'first_name', 'last_name', 'mobile'] as const;

/** Which side receives each kind of mail. */
const RECIPIENT: Record<BookingEmailKind, 'passenger' | 'driver'> = {
  confirmation: 'passenger',
  new_booking: 'driver',
  cancelled_by_passenger: 'driver',
  cancelled_by_driver: 'passenger',
  ride_cancelled: 'passenger',
};

/** Load a booking with both parties and send one notification mail. */
export async function notifyBooking(
  strapi: any,
  bookingId: number,
  kind: BookingEmailKind
): Promise<void> {
  if (process.env.BOOKING_NOTIFY_ENABLED === 'false') return;

  const booking = await strapi.db.query('api::booking.booking').findOne({
    where: { id: bookingId },
    populate: {
      passenger: { select: [...PARTY_FIELDS] },
      ride: { populate: { driver: { select: [...PARTY_FIELDS] } } },
    },
  });
  const ride = booking?.ride;
  const passenger = booking?.passenger;
  const driver = ride?.driver;
  if (!booking || !ride || !passenger || !driver) {
    strapi.log.warn(`[booking-mail] booking ${bookingId}: incomplete, ${kind} not sent.`);
    return;
  }

  const toPassenger = RECIPIENT[kind] === 'passenger';
  const recipient = toPassenger ? passenger : driver;
  const other = toPassenger ? driver : passenger;
  if (!recipient.email) {
    strapi.log.warn(`[booking-mail] booking ${bookingId}: recipient has no email, ${kind} not sent.`);
    return;
  }

  const mail = buildBookingEmail({
    kind,
    recipient,
    other,
    ride,
    instanceDate: booking.instance_date ?? null,
    frontendUrl: process.env.FRONTEND_URL ?? 'https://elb-fahrt.de',
  });
  await strapi.plugin('email').service('email').send({ to: recipient.email, ...mail });
  strapi.log.info(`[booking-mail] booking ${bookingId}: ${kind} sent to ${RECIPIENT[kind]}.`);
}

/** Fire-and-forget wrapper: never throws, logs failures. */
export function notifyBookingLater(strapi: any, bookingId: number, kind: BookingEmailKind): void {
  void notifyBooking(strapi, bookingId, kind).catch((err: unknown) =>
    strapi.log.error(`[booking-mail] booking ${bookingId}: ${kind} failed: ${err}`)
  );
}

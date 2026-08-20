/**
 * "Me" controller — endpoints that act on the currently-authenticated
 * user only. Sidesteps Strapi 5's users-permissions update controller,
 * which silently strips custom fields like `roles` from the body.
 *
 * Security model:
 *   - Always operates on ctx.state.user (the JWT-resolved user). The
 *     URL never carries an id, so a user can't update someone else by
 *     swapping a path param.
 *   - Storable fields are listed explicitly. Sensitive things
 *     (driver_status, driver_verified_at, role, password, etc.) are
 *     never writable from the request body.
 *
 * Driver verification (validate-and-discard — PLAN.md Q2):
 *   - `driver_id_number` is accepted as TRANSIENT input only. We run the
 *     Modulo-10 check on it and then throw it away — it is never persisted.
 *     A self-asserted, checksum-only ID number is a weak signal and a heavy
 *     GDPR liability, so we keep only the OUTCOME: driver_id_type (which
 *     document was claimed), driver_status, and driver_verified_at.
 *   - On a valid number: driver_status becomes "approved" (+ verified_at) if
 *     the site's auto-approve setting is on, else "pending_review" for the
 *     admin queue.
 */

import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { isValidIdNumber, type IdType } from '../../../utils/modulo10';
import { CONTACT_USER_FIELDS } from '../../../utils/safe-user';
import { isContactVisible } from '../../booking/booking-rules';

const { ValidationError } = errors;

/** Drop the phone number from a populated party unless the booking is confirmed. */
function redactContact(party: any, bookingStatus: string) {
  if (party && !isContactVisible(bookingStatus)) {
    const { mobile, ...rest } = party;
    return rest;
  }
  return party;
}

// Fields a user may set on themselves directly. Note: NOT driver_id_number
// (transient, handled below) and NOT driver_status (server-controlled).
const STORED_FIELDS = [
  'roles',
  'driver_id_type',
  'first_name',
  'last_name',
  'mobile',
  'postal_code',
  'city',
  'street',
  'house_number',
] as const;

/** Site-wide policy: skip the admin queue when a number passes the checksum. */
async function getAutoApprove(strapi: Core.Strapi): Promise<boolean> {
  try {
    const settings = await strapi
      .documents('api::driver-settings.driver-settings')
      .findFirst();
    return Boolean(settings?.auto_approve_drivers);
  } catch {
    // Settings single-type may not exist yet on first boot.
    return false;
  }
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async updateProfile(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Not authenticated');
    }

    const body = (ctx.request.body || {}) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    for (const key of STORED_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    // Driver ID: validate the transient number, then discard it. Only the
    // verification outcome is stored.
    const rawId = body.driver_id_number;
    if (rawId !== undefined && rawId !== null && rawId !== '') {
      const idType = (body.driver_id_type ?? user.driver_id_type) as IdType | undefined;
      if (idType !== 'personalausweis' && idType !== 'fuehrerschein') {
        throw new ValidationError('driver_id_type is required to verify a driver.');
      }
      if (!isValidIdNumber(idType, String(rawId))) {
        throw new ValidationError('The ID number failed validation.');
      }

      const autoApprove = await getAutoApprove(strapi);
      data.driver_id_type = idType;
      data.driver_status = autoApprove ? 'approved' : 'pending_review';
      data.driver_verified_at = autoApprove ? new Date().toISOString() : null;
    }

    if (Object.keys(data).length === 0) {
      return ctx.badRequest('No updatable fields provided');
    }

    await strapi.db
      .query('plugin::users-permissions.user')
      .update({ where: { id: user.id }, data });

    // Re-read to return a clean, current object.
    const fresh = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: user.id } });

    // Strip sensitive fields before returning.
    const { password, resetPasswordToken, confirmationToken, ...safe } = fresh ?? {};
    return safe;
  },

  /**
   * GET /me/bookings — the caller's trips, from both sides:
   *   as_passenger: bookings I made, each with the driver's contact.
   *   as_driver:    bookings on rides I offer, each with the passenger's contact.
   *
   * This is the ONLY endpoint that exposes phone numbers, and only for
   * confirmed bookings (cancelled ones keep the name but lose the number).
   * The open booking endpoints never return contact details.
   */
  async listBookings(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Not authenticated');
    }

    // Only confirmed bookings are shown — a cancelled one can't be acted on, so
    // it's hidden from both tabs (the row stays in the DB as a record).
    const asPassenger = await strapi.documents('api::booking.booking').findMany({
      filters: { passenger: { id: user.id }, status: 'confirmed' },
      populate: {
        ride: { populate: { driver: { fields: [...CONTACT_USER_FIELDS] } } },
      },
      sort: ['booked_at:desc'],
    });

    const asDriver = await strapi.documents('api::booking.booking').findMany({
      filters: { ride: { driver: { id: user.id } }, status: 'confirmed' },
      populate: {
        ride: true,
        passenger: { fields: [...CONTACT_USER_FIELDS] },
      },
      sort: ['booked_at:desc'],
    });

    // The caller's own open Gesuche. Filtering by the passenger relation here in
    // the controller is fine — the 403 only applies to client-supplied filters
    // on the content API. No contact needed (it's the caller's own data).
    const asRequester = await strapi
      .documents('api::ride-request.ride-request')
      .findMany({
        filters: { passenger: { id: user.id }, status: 'active' },
        sort: ['departure_at:asc'],
      });

    // The caller's own active rides they offer (shown greyed under Als Fahrer:in,
    // even before anyone books — the booking rows above only cover booked seats).
    const offeredRides = await strapi.documents('api::ride.ride').findMany({
      filters: { driver: { id: user.id }, status: 'active' },
      sort: ['departure_at:asc'],
    });

    return {
      as_passenger: asPassenger.map((b: any) => ({
        ...b,
        ride: b.ride
          ? { ...b.ride, driver: redactContact(b.ride.driver, b.status) }
          : b.ride,
      })),
      as_driver: asDriver.map((b: any) => ({
        ...b,
        passenger: redactContact(b.passenger, b.status),
      })),
      as_requester: asRequester,
      offered_rides: offeredRides,
    };
  },

  /**
   * DELETE /me/account — the caller deletes their own account (GDPR erasure).
   * Removes their content first so nothing is orphaned: bookings they made,
   * their Gesuche, and their rides (plus any bookings others made on those
   * rides). Then the user record itself. Acts only on ctx.state.user.
   */
  async deleteAccount(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Not authenticated');
    }
    const uid = user.id;

    // Bookings the user made as a passenger.
    const myBookings = await strapi.db
      .query('api::booking.booking')
      .findMany({ where: { passenger: uid }, select: ['id'] });
    for (const b of myBookings) {
      await strapi.db.query('api::booking.booking').delete({ where: { id: b.id } });
    }

    // The user's own Gesuche.
    const myRequests = await strapi.db
      .query('api::ride-request.ride-request')
      .findMany({ where: { passenger: uid }, select: ['id'] });
    for (const r of myRequests) {
      await strapi.db
        .query('api::ride-request.ride-request')
        .delete({ where: { id: r.id } });
    }

    // The user's rides, plus any bookings others made on them.
    const myRides = await strapi.db
      .query('api::ride.ride')
      .findMany({ where: { driver: uid }, select: ['id'] });
    for (const ride of myRides) {
      const onRide = await strapi.db
        .query('api::booking.booking')
        .findMany({ where: { ride: ride.id }, select: ['id'] });
      for (const b of onRide) {
        await strapi.db.query('api::booking.booking').delete({ where: { id: b.id } });
      }
      await strapi.db.query('api::ride.ride').delete({ where: { id: ride.id } });
    }

    // Finally, the account.
    await strapi.db
      .query('plugin::users-permissions.user')
      .delete({ where: { id: uid } });

    return { deleted: true };
  },
});

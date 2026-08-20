/**
 * Booking controller — write-path guards (PLAN.md M3 hardening).
 *
 * The default core controller would let a caller book a seat for someone
 * else, overbook a ride, or book the same seat twice. A Booking is a real
 * commitment between two people, so create enforces:
 *
 *   - caller must be signed in; `passenger` is forced to the caller.
 *   - the ride must exist and be `status = active`.
 *   - you can't book your own ride.
 *   - seats: confirmed bookings for the ride (per instance_date) must be
 *     below `seats_total`.
 *   - no double-booking: one confirmed seat per passenger per instance_date.
 *   - recurring rides require an `instance_date` (PLAN.md Q5 — a booking is
 *     for one specific date, not the whole series).
 *   - `booked_at` and `status` are set server-side, never trusted from input.
 *
 * update/delete: allowed only for the booking's passenger OR the ride's
 * driver (the driver may cancel → cancelled_by_driver). The `ride` and
 * `passenger` relations can never be reassigned.
 *
 * Concurrency: the seat count is a read-then-write, so two simultaneous
 * bookings for the last seat could both pass. At this scale (~1k users) that
 * window is negligible; if it ever matters, wrap create in a transaction with
 * a row lock on the ride.
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { SAFE_USER_FIELDS } from '../../../utils/safe-user';
import {
  buildBookingScope,
  evaluateBooking,
  isBookingOwner,
  mergeFilters,
  type BookingDenialReason,
} from '../booking-rules';

const { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } = errors;

/**
 * Turn a pure-rule denial into the matching Strapi HTTP error. Every error
 * carries a stable `reason` code in details so the frontend can show a precise
 * message rather than guessing from the status.
 */
function denialError(reason: BookingDenialReason) {
  // All denials use ValidationError on purpose: ForbiddenError/NotFoundError etc.
  // drop the `details` payload in Strapi's serialized response, so the frontend
  // never sees the `reason`. ValidationError preserves it. The frontend keys on
  // `reason`, not the HTTP status, so 400-for-all is fine here.
  const messages: Record<BookingDenialReason, string> = {
    ride_not_active: 'This ride is not accepting bookings.',
    own_ride: 'You cannot book a seat on your own ride.',
    needs_instance_date: 'instance_date is required to book a recurring ride.',
    in_the_past: 'This ride date is in the past.',
    already_booked: 'You already have a seat on this ride.',
    no_seats: 'No seats left on this ride.',
  };
  return new ValidationError(messages[reason], { reason });
}

// Read endpoints REPLACE the client's populate so neither `passenger` nor the
// nested `ride.driver` can be widened to full PII via ?populate. Row-level
// scoping (who may see which bookings) is enforced separately in find/findOne.
const READ_POPULATE = {
  passenger: { fields: [...SAFE_USER_FIELDS] },
  ride: { populate: { driver: { fields: [...SAFE_USER_FIELDS] } } },
} as const;

/** Pull a relation id out of the various shapes Strapi accepts in a payload. */
function extractRelationId(val: any): string | number | null {
  if (val == null) return null;
  if (typeof val === 'object') {
    if (Array.isArray(val.connect) && val.connect.length) {
      const c = val.connect[0];
      return typeof c === 'object' ? c.documentId ?? c.id : c;
    }
    return val.documentId ?? val.id ?? null;
  }
  return val;
}

/** Resolve a ride from a payload reference (documentId preferred, numeric id fallback). */
async function resolveRide(strapi: any, ref: any) {
  const id = extractRelationId(ref);
  if (id == null) return null;

  const byDoc = await strapi.documents('api::ride.ride').findOne({
    documentId: String(id),
    populate: { driver: { fields: ['id'] } },
  });
  if (byDoc) return byDoc;

  if (/^\d+$/.test(String(id))) {
    return strapi.db.query('api::ride.ride').findOne({
      where: { id: Number(id) },
      populate: { driver: true },
    });
  }
  return null;
}

/** Load a booking by documentId with the relations we need for authz. */
async function loadBookingForAuth(strapi: any, documentId: string) {
  return strapi.documents('api::booking.booking').findOne({
    documentId,
    populate: {
      passenger: { fields: ['id'] },
      ride: { populate: { driver: { fields: ['id'] } } },
    },
  });
}

export default factories.createCoreController('api::booking.booking', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError('You must be signed in.');

    // A booking is private to its passenger and the ride's driver. Scope the
    // result set to those two, AND-combined with whatever the caller filtered
    // on, so nobody can enumerate who is riding where. Rides and ride-requests
    // stay openly searchable — only this passenger↔ride linkage is private.
    ctx.query = {
      ...ctx.query,
      populate: READ_POPULATE,
      filters: mergeFilters(ctx.query?.filters, buildBookingScope(user.id)),
    };
    return super.find(ctx);
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError('You must be signed in.');

    const booking = await loadBookingForAuth(strapi, ctx.params.id);
    // 404 rather than 403 for someone else's booking — don't confirm it exists.
    if (!isBookingOwner(booking, user.id)) throw new NotFoundError('Booking not found.');

    ctx.query = { ...ctx.query, populate: READ_POPULATE };
    return super.findOne(ctx);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError('You must be signed in to book a seat.');

    const data = ctx.request.body?.data ?? {};

    const ride = await resolveRide(strapi, data.ride);
    if (!ride) throw new NotFoundError('Ride not found.');

    // Recurring rides are booked one date at a time; one-off rides ignore it.
    const instanceDate = data.instance_date ?? null;

    const seatFilter = {
      ride: ride.id,
      status: 'confirmed',
      instance_date: instanceDate,
    };
    const passengerAlreadyBooked =
      (await strapi.db.query('api::booking.booking').count({
        where: { ...seatFilter, passenger: user.id },
      })) > 0;
    const seatsTaken = await strapi.db
      .query('api::booking.booking')
      .count({ where: seatFilter });

    const denial = evaluateBooking({
      rideStatus: ride.status,
      rideRecurrence: ride.recurrence,
      rideDriverId: ride.driver?.id ?? null,
      seatsTotal: ride.seats_total,
      userId: user.id,
      instanceDate,
      departureAt: ride.departure_at,
      nowMs: Date.now(),
      seatsTaken,
      passengerAlreadyBooked,
    });
    if (denial) throw denialError(denial);

    // The passenger relation (→ User) can't go through content-API input
    // ("Invalid key passenger"), so validate/sanitize the client fields (ride,
    // instance_date) and attach passenger/booked_at/status via the service.
    await this.validateInput(data, ctx);
    const sanitized = (await this.sanitizeInput(data, ctx)) as Record<string, unknown>;

    const entity = await strapi.service('api::booking.booking').create({
      data: {
        ...sanitized,
        passenger: user.id,
        booked_at: new Date().toISOString(),
        status: 'confirmed',
      },
    });

    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    ctx.status = 201;
    return this.transformResponse(sanitizedEntity);
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError('You must be signed in.');

    const booking = await loadBookingForAuth(strapi, ctx.params.id);
    if (!booking) throw new NotFoundError('Booking not found.');
    if (!isBookingOwner(booking, user.id)) {
      throw new ForbiddenError('You can only modify your own bookings.');
    }

    // The only supported mutation is cancellation. Force the cancel status that
    // matches who is cancelling (passenger vs. the ride's driver) and ignore any
    // other fields in the body — the seat and its holder are otherwise fixed.
    const isPassenger = booking.passenger?.id === user.id;
    ctx.request.body = {
      data: {
        status: isPassenger ? 'cancelled_by_passenger' : 'cancelled_by_driver',
      },
    };
    return super.update(ctx);
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError('You must be signed in.');

    const booking = await loadBookingForAuth(strapi, ctx.params.id);
    if (!booking) throw new NotFoundError('Booking not found.');
    if (!isBookingOwner(booking, user.id)) {
      throw new ForbiddenError('You can only delete your own bookings.');
    }
    return super.delete(ctx);
  },
}));

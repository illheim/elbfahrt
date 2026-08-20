/**
 * Pure booking rules — no Strapi, no I/O.
 *
 * The booking controller does the DB reads (resolve the ride, count confirmed
 * seats) and then hands the plain values to these functions. Keeping the
 * decisions here means they can be unit-tested exhaustively without spinning
 * up Strapi, and the controller stays a thin orchestration layer.
 */

export type BookingDenialReason =
  | 'ride_not_active'
  | 'own_ride'
  | 'needs_instance_date'
  | 'in_the_past'
  | 'already_booked'
  | 'no_seats';

export interface BookingRuleInput {
  /** Ride.status — only "active" accepts bookings. */
  rideStatus: string;
  /** Ride.recurrence — "none" | "weekly" | "daily". */
  rideRecurrence: string;
  /** id of the ride's driver (a driver can't book their own ride). */
  rideDriverId: number | null | undefined;
  /** Ride.seats_total — passenger seats, driver excluded. */
  seatsTotal: number;
  /** The booking passenger (the authenticated caller). */
  userId: number;
  /** Resolved instance date for this booking, or null for a one-off ride. */
  instanceDate: string | null;
  /** Ride.departure_at (ISO) — used to reject past one-off rides. */
  departureAt: string;
  /** Current time in ms (injected so the rule stays pure/testable). */
  nowMs: number;
  /** Confirmed bookings already on this ride for this instanceDate. */
  seatsTaken: number;
  /** Does this passenger already hold a confirmed seat for this instanceDate? */
  passengerAlreadyBooked: boolean;
}

/**
 * Is the thing being booked already in the past? For a one-off ride that's its
 * departure time; for a recurring ride it's the chosen instance date (compared
 * as a calendar date — booking today's instance is still allowed).
 */
function isInPast(input: BookingRuleInput): boolean {
  const isRecurring = !!input.rideRecurrence && input.rideRecurrence !== 'none';
  if (isRecurring) {
    if (!input.instanceDate) return false; // caught by needs_instance_date
    const today = new Date(input.nowMs).toISOString().slice(0, 10);
    return input.instanceDate < today;
  }
  return new Date(input.departureAt).getTime() < input.nowMs;
}

/**
 * Decide whether a booking may be created. Returns the first failing reason,
 * or null if the booking is allowed. The check order is significant — it
 * matches the order the controller reports errors in, so the caller sees the
 * most relevant message when several conditions fail at once.
 */
export function evaluateBooking(input: BookingRuleInput): BookingDenialReason | null {
  if (input.rideStatus !== 'active') return 'ride_not_active';
  if (input.rideDriverId != null && input.rideDriverId === input.userId) {
    return 'own_ride';
  }

  const isRecurring = !!input.rideRecurrence && input.rideRecurrence !== 'none';
  if (isRecurring && !input.instanceDate) return 'needs_instance_date';

  if (isInPast(input)) return 'in_the_past';

  if (input.passengerAlreadyBooked) return 'already_booked';
  if (input.seatsTaken >= input.seatsTotal) return 'no_seats';

  return null;
}

/**
 * Contact details (phone number) are exchanged only once a booking is
 * confirmed. A cancelled booking must not keep leaking the counterpart's
 * number through the /me/bookings channel.
 */
export function isContactVisible(bookingStatus: string): boolean {
  return bookingStatus === 'confirmed';
}

/** Minimal shape of a booking with the relations needed to decide ownership. */
export interface BookingOwnership {
  passenger?: { id?: number } | null;
  ride?: { driver?: { id?: number } | null } | null;
}

/**
 * A booking is visible/mutable only to its passenger or the ride's driver.
 */
export function isBookingOwner(
  booking: BookingOwnership | null | undefined,
  userId: number
): boolean {
  if (!booking) return false;
  return booking.passenger?.id === userId || booking.ride?.driver?.id === userId;
}

/**
 * Strapi filter that limits a booking result set to the caller's own rows —
 * as passenger, or as the driver of the booked ride.
 */
export function buildBookingScope(userId: number) {
  return {
    $or: [{ passenger: { id: userId } }, { ride: { driver: { id: userId } } }],
  };
}

/**
 * AND-combine a caller-supplied filter with our scope, so scoping can never be
 * bypassed by passing filters. When the caller sent none, the scope stands alone.
 */
export function mergeFilters<S>(existing: unknown, scope: S) {
  return existing ? { $and: [existing, scope] } : scope;
}

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
  | 'outside_schedule'
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
  /** Ride.recurrence_until (YYYY-MM-DD) — last day of a recurring series, or null. */
  recurrenceUntil?: string | null;
  /** Ride.recurrence_weekdays (1=Mon…7=Sun) — the days a weekly ride runs. */
  recurrenceWeekdays?: number[] | null;
  /** Current time in ms (injected so the rule stays pure/testable). */
  nowMs: number;
  /** Confirmed bookings already on this ride for this instanceDate. */
  seatsTaken: number;
  /** Does this passenger already hold a confirmed seat for this instanceDate? */
  passengerAlreadyBooked: boolean;
}

const BOOKING_TZ = 'Europe/Berlin';
const WD_SHORT: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

/** Europe/Berlin calendar date (YYYY-MM-DD) of an ISO timestamp. */
function berlinYmd(iso: string): string {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOOKING_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/**
 * Weekday (1=Mon…7=Sun, matching the matcher's convention) of a plain calendar
 * date. Anchored at noon UTC so the date never slips across midnight in Berlin.
 */
function weekdayOfDate(ymd: string): number {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOOKING_TZ, weekday: 'short',
  }).formatToParts(new Date(`${ymd}T12:00:00Z`));
  const wd = p.find((x) => x.type === 'weekday')?.value ?? '';
  return WD_SHORT[wd] ?? 0;
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
 * Is the chosen instance date outside the ride's own recurring schedule? The
 * "in the past" check alone let a rider book a date the series doesn't cover —
 * before it starts, after it ends, or (for weekly) on a day it doesn't run
 * (beta test T3: a daily ride starting 15.09 accepted a booking for 14.09).
 * One-off rides have no schedule window, so this never fires for them.
 *
 * The weekday rule only applies when we actually know the run-days; a weekly
 * ride with no weekdays recorded is malformed data, and we don't block a rider
 * over it (the start/end bounds still apply either way).
 */
function isOutsideSchedule(input: BookingRuleInput): boolean {
  const isRecurring = !!input.rideRecurrence && input.rideRecurrence !== 'none';
  if (!isRecurring || !input.instanceDate) return false;

  if (input.instanceDate < berlinYmd(input.departureAt)) return true; // before start

  const until = input.recurrenceUntil?.slice(0, 10);
  if (until && input.instanceDate > until) return true; // after the last day

  if (input.rideRecurrence === 'weekly') {
    const days = input.recurrenceWeekdays ?? [];
    if (days.length > 0 && !days.includes(weekdayOfDate(input.instanceDate))) {
      return true; // a weekday the ride doesn't run
    }
  }
  return false;
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
  if (isOutsideSchedule(input)) return 'outside_schedule';

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

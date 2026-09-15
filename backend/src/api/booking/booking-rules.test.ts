import { describe, it, expect } from 'vitest';
import {
  evaluateBooking,
  isBookingOwner,
  isContactVisible,
  buildBookingScope,
  mergeFilters,
  type BookingRuleInput,
} from './booking-rules';

const NOW_MS = Date.parse('2026-06-01T12:00:00Z');

/** A booking that should be allowed; individual tests override one field. */
function base(overrides: Partial<BookingRuleInput> = {}): BookingRuleInput {
  return {
    rideStatus: 'active',
    rideRecurrence: 'none',
    rideDriverId: 1,
    seatsTotal: 3,
    userId: 2,
    instanceDate: null,
    departureAt: '2026-06-02T09:00:00Z', // after NOW_MS
    recurrenceUntil: null,
    recurrenceWeekdays: null,
    nowMs: NOW_MS,
    seatsTaken: 0,
    passengerAlreadyBooked: false,
    ...overrides,
  };
}

describe('evaluateBooking', () => {
  it('allows a valid one-off booking', () => {
    expect(evaluateBooking(base())).toBeNull();
  });

  it('allows a recurring booking that carries an instance date', () => {
    expect(
      evaluateBooking(base({ rideRecurrence: 'weekly', instanceDate: '2026-08-01' }))
    ).toBeNull();
  });

  it('rejects a ride that is not active', () => {
    expect(evaluateBooking(base({ rideStatus: 'cancelled' }))).toBe('ride_not_active');
    expect(evaluateBooking(base({ rideStatus: 'completed' }))).toBe('ride_not_active');
  });

  it('rejects booking your own ride', () => {
    expect(evaluateBooking(base({ rideDriverId: 2, userId: 2 }))).toBe('own_ride');
  });

  it('does not treat a null driver id as the caller', () => {
    expect(evaluateBooking(base({ rideDriverId: null }))).toBeNull();
  });

  it('requires an instance date for recurring rides', () => {
    expect(evaluateBooking(base({ rideRecurrence: 'weekly', instanceDate: null }))).toBe(
      'needs_instance_date'
    );
    expect(evaluateBooking(base({ rideRecurrence: 'daily', instanceDate: null }))).toBe(
      'needs_instance_date'
    );
  });

  it('does not require an instance date for one-off rides', () => {
    expect(evaluateBooking(base({ rideRecurrence: 'none', instanceDate: null }))).toBeNull();
  });

  it('rejects a passenger who already holds a seat', () => {
    expect(evaluateBooking(base({ passengerAlreadyBooked: true }))).toBe('already_booked');
  });

  it('rejects when the ride is full', () => {
    expect(evaluateBooking(base({ seatsTaken: 3, seatsTotal: 3 }))).toBe('no_seats');
    expect(evaluateBooking(base({ seatsTaken: 4, seatsTotal: 3 }))).toBe('no_seats');
  });

  it('allows when a seat remains', () => {
    expect(evaluateBooking(base({ seatsTaken: 2, seatsTotal: 3 }))).toBeNull();
  });

  // Check ordering: when several conditions fail, the earliest one wins so the
  // caller gets the most relevant message.
  it('reports inactivity before own-ride', () => {
    expect(
      evaluateBooking(base({ rideStatus: 'cancelled', rideDriverId: 2, userId: 2 }))
    ).toBe('ride_not_active');
  });

  it('reports own-ride before a missing instance date', () => {
    expect(
      evaluateBooking(
        base({ rideDriverId: 2, userId: 2, rideRecurrence: 'weekly', instanceDate: null })
      )
    ).toBe('own_ride');
  });

  it('reports a missing instance date before already-booked', () => {
    expect(
      evaluateBooking(
        base({ rideRecurrence: 'weekly', instanceDate: null, passengerAlreadyBooked: true })
      )
    ).toBe('needs_instance_date');
  });

  it('reports already-booked before no-seats', () => {
    expect(
      evaluateBooking(base({ passengerAlreadyBooked: true, seatsTaken: 3, seatsTotal: 3 }))
    ).toBe('already_booked');
  });

  it('rejects a one-off ride whose departure has passed', () => {
    expect(evaluateBooking(base({ departureAt: '2026-05-01T09:00:00Z' }))).toBe(
      'in_the_past'
    );
  });

  it('rejects a recurring instance date before today', () => {
    expect(
      evaluateBooking(base({ rideRecurrence: 'weekly', instanceDate: '2026-05-30' }))
    ).toBe('in_the_past');
  });

  it("allows a recurring instance dated today", () => {
    // Series starts on/before the booked day, so only the past-check applies.
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'weekly',
          instanceDate: '2026-06-01',
          departureAt: '2026-06-01T09:00:00Z',
        })
      )
    ).toBeNull();
  });

  // T3 (beta test log): a recurring booking must fall inside the ride's own
  // schedule — not before it starts, after it ends, or on a day it skips.
  it('rejects a daily instance before the series start date', () => {
    // Daily ride starts 15.09; booking 14.09 must be refused (the reported bug).
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'daily',
          instanceDate: '2026-09-14',
          departureAt: '2026-09-15T06:00:00Z',
        })
      )
    ).toBe('outside_schedule');
  });

  it('rejects an instance after recurrence_until', () => {
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'daily',
          instanceDate: '2026-10-05',
          departureAt: '2026-09-15T06:00:00Z',
          recurrenceUntil: '2026-09-30',
        })
      )
    ).toBe('outside_schedule');
  });

  it('rejects a weekly instance on a weekday the ride does not run', () => {
    // Runs Tuesdays ([2]); 2026-09-21 is a Monday → refused.
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'weekly',
          instanceDate: '2026-09-21',
          departureAt: '2026-09-15T06:00:00Z',
          recurrenceWeekdays: [2],
        })
      )
    ).toBe('outside_schedule');
  });

  it('allows a weekly instance on a scheduled weekday within range', () => {
    // 2026-09-22 is a Tuesday, within [start, until] → allowed.
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'weekly',
          instanceDate: '2026-09-22',
          departureAt: '2026-09-15T06:00:00Z',
          recurrenceUntil: '2026-12-31',
          recurrenceWeekdays: [2],
        })
      )
    ).toBeNull();
  });

  it('allows a daily instance within the series range', () => {
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'daily',
          instanceDate: '2026-09-20',
          departureAt: '2026-09-15T06:00:00Z',
          recurrenceUntil: '2026-09-30',
        })
      )
    ).toBeNull();
  });

  it('does not enforce weekdays when none are recorded (malformed weekly)', () => {
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'weekly',
          instanceDate: '2026-09-22',
          departureAt: '2026-09-15T06:00:00Z',
          recurrenceWeekdays: null,
        })
      )
    ).toBeNull();
  });

  it('reports past before outside-schedule', () => {
    // Before the series start AND before today → the past message wins.
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'daily',
          instanceDate: '2026-05-20',
          departureAt: '2026-09-15T06:00:00Z',
        })
      )
    ).toBe('in_the_past');
  });

  it('reports a missing instance date before the past check', () => {
    expect(
      evaluateBooking(
        base({
          rideRecurrence: 'weekly',
          instanceDate: null,
          departureAt: '2026-05-01T09:00:00Z',
        })
      )
    ).toBe('needs_instance_date');
  });

  it('reports past before already-booked', () => {
    expect(
      evaluateBooking(
        base({ departureAt: '2026-05-01T09:00:00Z', passengerAlreadyBooked: true })
      )
    ).toBe('in_the_past');
  });
});

describe('isBookingOwner', () => {
  it('is true for the passenger', () => {
    expect(isBookingOwner({ passenger: { id: 7 } }, 7)).toBe(true);
  });

  it("is true for the ride's driver", () => {
    expect(isBookingOwner({ ride: { driver: { id: 9 } } }, 9)).toBe(true);
  });

  it('is false for an unrelated user', () => {
    expect(
      isBookingOwner({ passenger: { id: 7 }, ride: { driver: { id: 9 } } }, 42)
    ).toBe(false);
  });

  it('is false for a null/undefined booking or missing relations', () => {
    expect(isBookingOwner(null, 1)).toBe(false);
    expect(isBookingOwner(undefined, 1)).toBe(false);
    expect(isBookingOwner({}, 1)).toBe(false);
  });
});

describe('isContactVisible', () => {
  it('is true only for confirmed bookings', () => {
    expect(isContactVisible('confirmed')).toBe(true);
  });

  it('is false for cancelled bookings', () => {
    expect(isContactVisible('cancelled_by_passenger')).toBe(false);
    expect(isContactVisible('cancelled_by_driver')).toBe(false);
  });
});

describe('buildBookingScope', () => {
  it('scopes to the caller as passenger or as ride driver', () => {
    expect(buildBookingScope(5)).toEqual({
      $or: [{ passenger: { id: 5 } }, { ride: { driver: { id: 5 } } }],
    });
  });
});

describe('mergeFilters', () => {
  it('ANDs the scope with a caller-supplied filter', () => {
    const scope = buildBookingScope(5);
    const existing = { status: 'confirmed' };
    expect(mergeFilters(existing, scope)).toEqual({ $and: [existing, scope] });
  });

  it('returns the scope alone when there is no caller filter', () => {
    const scope = buildBookingScope(5);
    expect(mergeFilters(undefined, scope)).toBe(scope);
    expect(mergeFilters(null, scope)).toBe(scope);
  });
});

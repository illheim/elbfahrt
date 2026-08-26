import { describe, it, expect } from 'vitest';
import {
  matchRideToRequest,
  localParts,
  haversineM,
  effectiveRadiusM,
  type MatchRide,
  type MatchGesuch,
} from './matching';

// Ride origin ≈ Drage, destination ≈ Winsen (Luhe). 2026-09-01 is a Tuesday;
// 06:00Z = 08:00 local (CEST, UTC+2).
const RIDE: MatchRide = {
  status: 'active',
  recurrence: 'none',
  recurrence_weekdays: null,
  recurrence_until: null,
  departure_at: '2026-09-01T06:00:00Z',
  seats_total: 3,
  seats_confirmed: 0,
  driver_id: 1,
  origin: { lat: 53.39, lng: 10.35 },
  destination: { lat: 53.36, lng: 10.21 },
};

const GESUCH: MatchGesuch = {
  status: 'active',
  notify_on_match: true,
  passenger_id: 2,
  recurrence: 'none',
  recurrence_weekdays: null,
  recurrence_until: null,
  departure_at: '2026-09-01T06:30:00Z', // 30 min after the ride
  departure_window_min: null,
  seats_needed: 1,
  origin: { lat: 53.392, lng: 10.352 }, // ~260 m from ride origin
  destination: { lat: 53.362, lng: 10.212 }, // ~260 m from ride destination
  origin_radius_m: 1000,
  destination_radius_m: 1000,
  flexible_origin: false,
  flexible_destination: false,
};

const ride = (o: Partial<MatchRide> = {}): MatchRide => ({ ...RIDE, ...o });
const gesuch = (o: Partial<MatchGesuch> = {}): MatchGesuch => ({ ...GESUCH, ...o });

const FAR = { lat: 53.44, lng: 10.35 }; // ~5.5 km north of the ride origin

describe('helpers', () => {
  it('localParts converts to Europe/Berlin (summer = UTC+2)', () => {
    const p = localParts('2026-09-01T06:00:00Z');
    expect(p.ymd).toBe('2026-09-01');
    expect(p.weekday).toBe(2); // Tuesday
    expect(p.minutes).toBe(8 * 60); // 08:00 local
  });

  it('haversine ~260 m for the base offset', () => {
    const d = haversineM(RIDE.origin, GESUCH.origin);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(400);
  });

  it('effectiveRadiusM falls back to the legacy boolean', () => {
    expect(effectiveRadiusM(null, true)).toBe(1000);
    expect(effectiveRadiusM(null, false)).toBe(0);
    expect(effectiveRadiusM(2500, false)).toBe(2500);
  });
});

describe('matchRideToRequest — happy path', () => {
  it('matches a near, same-day, in-window Gesuch', () => {
    expect(matchRideToRequest(ride(), gesuch()).match).toBe(true);
  });
});

describe('eligibility', () => {
  it('rejects an inactive ride', () => {
    expect(matchRideToRequest(ride({ status: 'cancelled' }), gesuch()).reason).toBe(
      'ride_inactive'
    );
  });
  it('rejects an inactive Gesuch', () => {
    expect(matchRideToRequest(ride(), gesuch({ status: 'fulfilled' })).reason).toBe(
      'gesuch_inactive'
    );
  });
  it('respects notify_on_match = false', () => {
    expect(matchRideToRequest(ride(), gesuch({ notify_on_match: false })).reason).toBe(
      'notify_off'
    );
  });
  it('never notifies the driver about their own ride', () => {
    expect(matchRideToRequest(ride({ driver_id: 2 }), gesuch()).reason).toBe(
      'own_ride'
    );
  });
});

describe('capacity', () => {
  it('rejects a full one-off ride', () => {
    expect(
      matchRideToRequest(ride({ seats_total: 2, seats_confirmed: 2 }), gesuch()).reason
    ).toBe('no_seats');
  });
  it('allows a one-off ride with a free seat', () => {
    expect(
      matchRideToRequest(ride({ seats_total: 3, seats_confirmed: 2 }), gesuch()).match
    ).toBe(true);
  });
  it('ignores capacity for recurring rides (per-instance seats)', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'daily', seats_total: 1, seats_confirmed: 9 }),
        gesuch({ recurrence: 'daily' })
      ).match
    ).toBe(true);
  });
});

describe('geography', () => {
  it('rejects an origin outside the radius', () => {
    expect(matchRideToRequest(ride(), gesuch({ origin: FAR })).reason).toBe(
      'geography'
    );
  });
  it('accepts a far origin when the radius is wide enough', () => {
    expect(
      matchRideToRequest(ride(), gesuch({ origin: FAR, origin_radius_m: 6000 })).match
    ).toBe(true);
  });
  it('uses the legacy flexible flag when radius is null', () => {
    // exact (radius 0-derived) with a 260 m offset → no match
    expect(
      matchRideToRequest(
        ride(),
        gesuch({ origin_radius_m: null, destination_radius_m: null, flexible_origin: false, flexible_destination: false })
      ).reason
    ).toBe('geography');
    // flexible → 1000 m → matches
    expect(
      matchRideToRequest(
        ride(),
        gesuch({ origin_radius_m: null, destination_radius_m: null, flexible_origin: true, flexible_destination: true })
      ).match
    ).toBe(true);
  });
  it('matches via a waypoint near the Gesuch origin (Stage 1b forward-compat)', () => {
    expect(
      matchRideToRequest(
        ride({ origin: FAR, waypoints: [{ lat: 53.392, lng: 10.352 }] }),
        gesuch()
      ).match
    ).toBe(true);
  });
  it('requires pickup before drop-off in travel order', () => {
    // swap the Gesuch's origin/destination so the "pickup" is only reachable
    // at the ride's destination — no valid earlier→later pairing.
    expect(
      matchRideToRequest(
        ride(),
        gesuch({ origin: GESUCH.destination, destination: GESUCH.origin })
      ).reason
    ).toBe('geography');
  });
});

describe('schedule', () => {
  it('rejects a departure outside the time window', () => {
    expect(
      matchRideToRequest(ride(), gesuch({ departure_at: '2026-09-01T08:00:00Z' })).reason
    ).toBe('schedule'); // 2 h after the ride, window 90 min
  });
  it('honours a wider per-Gesuch window', () => {
    expect(
      matchRideToRequest(
        ride(),
        gesuch({ departure_at: '2026-09-01T08:00:00Z', departure_window_min: 150 })
      ).match
    ).toBe(true);
  });
  it('rejects a different calendar day (one-off)', () => {
    expect(
      matchRideToRequest(ride(), gesuch({ departure_at: '2026-09-02T06:30:00Z' })).reason
    ).toBe('schedule');
  });
  it('matches a weekly ride to a one-off Gesuch on a covered weekday', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'weekly', recurrence_weekdays: [2], recurrence_until: '2026-12-31' }),
        gesuch() // one-off on Tue 2026-09-01
      ).match
    ).toBe(true);
  });
  it('rejects a weekly ride whose weekdays miss the Gesuch day', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'weekly', recurrence_weekdays: [3], recurrence_until: '2026-12-31' }),
        gesuch()
      ).reason
    ).toBe('schedule');
  });
  it('rejects recurring↔recurring with non-overlapping date ranges', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'weekly', recurrence_weekdays: [2], recurrence_until: '2026-08-31' }),
        gesuch({ recurrence: 'weekly', recurrence_weekdays: [2], departure_at: '2026-10-01T06:30:00Z', recurrence_until: '2026-12-31' })
      ).reason
    ).toBe('schedule');
  });
});

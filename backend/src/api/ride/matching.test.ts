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
// 06:00Z = 08:00 local (CEST). route_duration 1200 s = 20 min → arrival 08:20.
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
  flexible_origin: false,
  flexible_destination: false,
  route_duration_s: 1200,
};

const GESUCH: MatchGesuch = {
  status: 'active',
  notify_on_match: true,
  passenger_id: 2,
  recurrence: 'none',
  recurrence_weekdays: null,
  recurrence_until: null,
  departure_at: '2026-09-01T06:00:00Z', // same time → 0 min pickup diff
  seats_needed: 1,
  origin: { lat: 53.392, lng: 10.352 }, // ~260 m from ride origin
  destination: { lat: 53.362, lng: 10.212 }, // ~260 m from ride destination
  origin_radius_m: 1000,
  destination_radius_m: 1000,
  flexible_origin: false,
  flexible_destination: false,
  time_window_min: null, // → default 30
  route_duration_s: 1200, // → drop-off 08:20, same as ride
};

const ride = (o: Partial<MatchRide> = {}): MatchRide => ({ ...RIDE, ...o });
const gesuch = (o: Partial<MatchGesuch> = {}): MatchGesuch => ({ ...GESUCH, ...o });

const FAR = { lat: 53.44, lng: 10.35 }; // ~5.5 km north of the ride origin

describe('helpers', () => {
  it('localParts converts to Europe/Berlin (summer = UTC+2)', () => {
    const p = localParts('2026-09-01T06:00:00Z');
    expect(p.ymd).toBe('2026-09-01');
    expect(p.weekday).toBe(2);
    expect(p.minutes).toBe(8 * 60);
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

describe('happy path', () => {
  it('matches a near, same-time Gesuch', () => {
    expect(matchRideToRequest(ride(), gesuch()).match).toBe(true);
  });
});

describe('eligibility', () => {
  it('inactive ride', () => {
    expect(matchRideToRequest(ride({ status: 'cancelled' }), gesuch()).reason).toBe('ride_inactive');
  });
  it('inactive Gesuch', () => {
    expect(matchRideToRequest(ride(), gesuch({ status: 'fulfilled' })).reason).toBe('gesuch_inactive');
  });
  it('notify_on_match off', () => {
    expect(matchRideToRequest(ride(), gesuch({ notify_on_match: false })).reason).toBe('notify_off');
  });
  it('own ride', () => {
    expect(matchRideToRequest(ride({ driver_id: 2 }), gesuch()).reason).toBe('own_ride');
  });
});

describe('capacity', () => {
  it('full one-off', () => {
    expect(matchRideToRequest(ride({ seats_total: 2, seats_confirmed: 2 }), gesuch()).reason).toBe('no_seats');
  });
  it('free seat', () => {
    expect(matchRideToRequest(ride({ seats_total: 3, seats_confirmed: 2 }), gesuch()).match).toBe(true);
  });
  it('recurring ignores capacity', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'daily', seats_total: 1, seats_confirmed: 9 }),
        gesuch({ recurrence: 'daily' })
      ).match
    ).toBe(true);
  });
});

describe('M1 — spatial (summed radii)', () => {
  it('rejects a far origin outside both radii', () => {
    expect(matchRideToRequest(ride(), gesuch({ origin: FAR })).reason).toBe('geo_time');
  });
  it('accepts when the Gesuch radius alone covers it', () => {
    expect(matchRideToRequest(ride(), gesuch({ origin: FAR, origin_radius_m: 6000 })).match).toBe(true);
  });
  it('sums the ride flexibility radius with the Gesuch radius', () => {
    // 5000 m Gesuch radius alone is < 5.5 km → no match…
    expect(matchRideToRequest(ride(), gesuch({ origin: FAR, origin_radius_m: 5000 })).reason).toBe('geo_time');
    // …but + the ride's ±1 km flexible origin (→ 6000) covers it.
    expect(
      matchRideToRequest(ride({ flexible_origin: true }), gesuch({ origin: FAR, origin_radius_m: 5000 })).match
    ).toBe(true);
  });
  it('legacy radius null falls back to the Gesuch flexible flag', () => {
    expect(
      matchRideToRequest(ride(), gesuch({ origin_radius_m: null, destination_radius_m: null, flexible_origin: false, flexible_destination: false })).reason
    ).toBe('geo_time');
    expect(
      matchRideToRequest(ride(), gesuch({ origin_radius_m: null, destination_radius_m: null, flexible_origin: true, flexible_destination: true })).match
    ).toBe(true);
  });
  it('matches via a waypoint near the Gesuch origin', () => {
    expect(
      matchRideToRequest(ride({ origin: FAR, waypoints: [{ lat: 53.392, lng: 10.352 }] }), gesuch()).match
    ).toBe(true);
  });
});

describe('M2 — temporal corridor', () => {
  it('rejects a pickup time outside the window', () => {
    // Gesuch departs 40 min later, default window 30.
    expect(matchRideToRequest(ride(), gesuch({ departure_at: '2026-09-01T06:40:00Z' })).reason).toBe('geo_time');
  });
  it('honours a wider per-Gesuch window', () => {
    expect(
      matchRideToRequest(ride(), gesuch({ departure_at: '2026-09-01T06:40:00Z', time_window_min: 60 })).match
    ).toBe(true);
  });
  it('rejects when the drop-off times are too far apart', () => {
    // Same pickup time, but the rider's trip is 60 min (drop 09:00) vs the
    // ride's 20 min (arrival 08:20) → 40 min apart, window 30.
    expect(matchRideToRequest(ride(), gesuch({ route_duration_s: 3600 })).reason).toBe('geo_time');
  });
  it('skips the drop-off time check when a duration is missing (legacy)', () => {
    expect(matchRideToRequest(ride(), gesuch({ route_duration_s: null })).match).toBe(true);
  });
});

describe('schedule (day gate)', () => {
  it('different calendar day', () => {
    expect(matchRideToRequest(ride(), gesuch({ departure_at: '2026-09-02T06:00:00Z' })).reason).toBe('schedule');
  });
  it('weekly ride covers a one-off Gesuch weekday', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'weekly', recurrence_weekdays: [2], recurrence_until: '2026-12-31' }),
        gesuch()
      ).match
    ).toBe(true);
  });
  it('weekly ride misses the Gesuch weekday', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'weekly', recurrence_weekdays: [3], recurrence_until: '2026-12-31' }),
        gesuch()
      ).reason
    ).toBe('schedule');
  });
  it('recurring ranges do not overlap', () => {
    expect(
      matchRideToRequest(
        ride({ recurrence: 'weekly', recurrence_weekdays: [2], recurrence_until: '2026-08-31' }),
        gesuch({ recurrence: 'weekly', recurrence_weekdays: [2], departure_at: '2026-10-01T06:00:00Z', recurrence_until: '2026-12-31' })
      ).reason
    ).toBe('schedule');
  });
});

/**
 * Pure matching logic — decides whether a ride (Angebot) satisfies a ride
 * request (Gesuch). No I/O, no Strapi: the service coerces entities into these
 * plain shapes and calls `matchRideToRequest`, so this stays fully unit-testable.
 *
 * v2.0 model (beta spec, slides 1–6):
 *  - M1: spatial match = circles OVERLAP, i.e. distance ≤ Gesuch radius + the
 *        ride point's own flexibility radius (±1 km flag at origin/destination).
 *  - M2: temporal corridor at BOTH ends — the ride's time at a point and the
 *        Gesuch's time must be within the Gesuch's window. Times are known at
 *        the ride's origin (departure) and destination (departure + route
 *        duration); waypoint arrival times are unknown (per-leg durations are a
 *        follow-up), so temporal is enforced only at origin/destination.
 *  - Waypoints (Stage 1b) remain candidate pickup/drop-off points.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type Recur = 'none' | 'weekly' | 'daily';

export interface MatchRide {
  status: string;
  recurrence: Recur;
  recurrence_weekdays: number[] | null;
  recurrence_until: string | null;
  departure_at: string;
  seats_total: number;
  seats_confirmed: number;
  driver_id: number | null;
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: GeoPoint[];
  flexible_origin: boolean; // ±1 km leeway at the ride's start (M1)
  flexible_destination: boolean; // ±1 km leeway at the ride's end (M1)
  route_duration_s: number | null; // whole ride origin→destination (M2)
}

export interface MatchGesuch {
  status: string;
  notify_on_match: boolean;
  passenger_id: number;
  recurrence: Recur;
  recurrence_weekdays: number[] | null;
  recurrence_until: string | null;
  departure_at: string;
  seats_needed: number;
  origin: GeoPoint;
  destination: GeoPoint;
  origin_radius_m: number | null;
  destination_radius_m: number | null;
  flexible_origin: boolean;
  flexible_destination: boolean;
  time_window_min: number | null; // temporal corridor ± minutes (M2)
  route_duration_s: number | null; // rider's own origin→destination time (M2)
}

export interface MatchResult {
  match: boolean;
  reason?: string;
}

export const DEFAULT_WINDOW_MIN = 30; // beta spec uses ±15–30 min
export const MATCH_TZ = 'Europe/Berlin';
const FLEX_RADIUS_M = 1000; // the ride's ±1 km "flexibel" flag

/** Effective flexibility radius: explicit value, else the legacy ±1km boolean. */
export function effectiveRadiusM(
  explicit: number | null,
  flexible: boolean
): number {
  return explicit ?? (flexible ? FLEX_RADIUS_M : 0);
}

/** Great-circle distance in metres. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

interface LocalParts {
  ymd: string;
  weekday: number; // 1=Mon … 7=Sun
  minutes: number; // minutes since local midnight
}

const WD: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

/** Local (Europe/Berlin) calendar date, weekday and minute-of-day for an ISO ts. */
export function localParts(iso: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MATCH_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WD[get('weekday')] ?? 0,
    minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  };
}

const FAR_FUTURE = '9999-12-31';

function weekdaysOf(e: {
  recurrence: Recur;
  recurrence_weekdays: number[] | null;
  departure_at: string;
}): number[] {
  if (e.recurrence === 'daily') return [1, 2, 3, 4, 5, 6, 7];
  if (e.recurrence === 'weekly') return e.recurrence_weekdays ?? [];
  return [localParts(e.departure_at).weekday];
}

function dateRange(e: {
  recurrence: Recur;
  recurrence_until: string | null;
  departure_at: string;
}): [string, string] {
  const start = localParts(e.departure_at).ymd;
  if (e.recurrence === 'none') return [start, start];
  return [start, e.recurrence_until ?? FAR_FUTURE];
}

function rangesOverlap(a: [string, string], b: [string, string]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/** Coarse day gate: active date ranges overlap AND weekday sets intersect. */
export function datesCompatible(ride: MatchRide, gesuch: MatchGesuch): boolean {
  if (!rangesOverlap(dateRange(ride), dateRange(gesuch))) return false;
  const rw = weekdaysOf(ride);
  const gw = weekdaysOf(gesuch);
  return rw.some((d) => gw.includes(d));
}

/** The ride's own flexibility radius at sequence index i (waypoints are exact). */
function rideRadiusAt(ride: MatchRide, i: number, len: number): number {
  if (i === 0) return ride.flexible_origin ? FLEX_RADIUS_M : 0;
  if (i === len - 1) return ride.flexible_destination ? FLEX_RADIUS_M : 0;
  return 0;
}

/** The ride's local minute-of-day at index i, or null if unknown (waypoint). */
function rideMinuteAt(ride: MatchRide, i: number, len: number): number | null {
  const dep = localParts(ride.departure_at).minutes;
  if (i === 0) return dep;
  if (i === len - 1) {
    return ride.route_duration_s != null
      ? dep + Math.round(ride.route_duration_s / 60)
      : null;
  }
  return null;
}

/**
 * Combined spatial + temporal point matching (M1 + M2): a pickup point on the
 * ride within the summed radii of the Gesuch origin, and a LATER drop-off within
 * the summed radii of the Gesuch destination — with times (where known) inside
 * the Gesuch's window. Temporal is only enforced where the ride's time is known
 * (its origin and destination), and the drop-off time check only runs when both
 * sides have a route duration.
 */
export function pointTimeMatch(ride: MatchRide, gesuch: MatchGesuch): boolean {
  const seq: GeoPoint[] = [ride.origin, ...(ride.waypoints ?? []), ride.destination];
  const len = seq.length;
  const oRad = effectiveRadiusM(gesuch.origin_radius_m, gesuch.flexible_origin);
  const dRad = effectiveRadiusM(gesuch.destination_radius_m, gesuch.flexible_destination);
  const window = gesuch.time_window_min ?? DEFAULT_WINDOW_MIN;

  const gPickup = localParts(gesuch.departure_at).minutes;
  const gDrop =
    gesuch.route_duration_s != null
      ? gPickup + Math.round(gesuch.route_duration_s / 60)
      : null;

  for (let i = 0; i < len; i++) {
    if (haversineM(seq[i], gesuch.origin) > oRad + rideRadiusAt(ride, i, len)) continue;
    const rPickup = rideMinuteAt(ride, i, len);
    if (rPickup !== null && Math.abs(rPickup - gPickup) > window) continue;

    for (let j = len - 1; j > i; j--) {
      if (haversineM(seq[j], gesuch.destination) > dRad + rideRadiusAt(ride, j, len)) {
        continue;
      }
      const rDrop = rideMinuteAt(ride, j, len);
      if (rDrop !== null && gDrop !== null && Math.abs(rDrop - gDrop) > window) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/** Decide whether `ride` satisfies `gesuch`. Cheap checks first. */
export function matchRideToRequest(
  ride: MatchRide,
  gesuch: MatchGesuch
): MatchResult {
  if (ride.status !== 'active') return { match: false, reason: 'ride_inactive' };
  if (gesuch.status !== 'active') return { match: false, reason: 'gesuch_inactive' };
  if (!gesuch.notify_on_match) return { match: false, reason: 'notify_off' };
  if (ride.driver_id != null && ride.driver_id === gesuch.passenger_id) {
    return { match: false, reason: 'own_ride' };
  }
  if (
    ride.recurrence === 'none' &&
    ride.seats_total - ride.seats_confirmed < gesuch.seats_needed
  ) {
    return { match: false, reason: 'no_seats' };
  }
  if (!datesCompatible(ride, gesuch)) return { match: false, reason: 'schedule' };
  if (!pointTimeMatch(ride, gesuch)) return { match: false, reason: 'geo_time' };
  return { match: true };
}

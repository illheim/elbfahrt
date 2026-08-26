/**
 * Pure matching logic — decides whether a ride (Angebot) satisfies a ride
 * request (Gesuch). No I/O, no Strapi: the controller/service coerces entities
 * into these plain shapes and calls `matchRideToRequest`, so this stays fully
 * unit-testable (see matching.test.ts).
 *
 * v2.0 Stage 2. Geometry is compared against the Gesuch's flexibility radius
 * (Stage 1a). Waypoints (Stage 1b) are already threaded through as optional
 * candidate points, so folding them in later needs no change here.
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
  recurrence_until: string | null; // YYYY-MM-DD
  departure_at: string; // ISO
  seats_total: number;
  seats_confirmed: number; // confirmed bookings (only meaningful for one-off)
  driver_id: number | null;
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: GeoPoint[]; // Stage 1b; empty/undefined for now
}

export interface MatchGesuch {
  status: string;
  notify_on_match: boolean;
  passenger_id: number;
  recurrence: Recur;
  recurrence_weekdays: number[] | null;
  recurrence_until: string | null;
  departure_at: string;
  departure_window_min: number | null;
  seats_needed: number;
  origin: GeoPoint;
  destination: GeoPoint;
  origin_radius_m: number | null;
  destination_radius_m: number | null;
  flexible_origin: boolean;
  flexible_destination: boolean;
}

export interface MatchResult {
  match: boolean;
  reason?: string;
}

export const DEFAULT_WINDOW_MIN = 90;
/** All users are in one region; derive local calendar/time from this zone. */
export const MATCH_TZ = 'Europe/Berlin';

/** Effective flexibility radius: explicit value, else the legacy ±1km boolean. */
export function effectiveRadiusM(
  explicit: number | null,
  flexible: boolean
): number {
  return explicit ?? (flexible ? 1000 : 0);
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
  ymd: string; // YYYY-MM-DD in MATCH_TZ
  weekday: number; // 1=Mon … 7=Sun
  minutes: number; // minutes since local midnight
}

const WD: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

/** Local (Europe/Berlin) calendar date, weekday and minute-of-day for an ISO ts. */
export function localParts(iso: string): LocalParts {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MATCH_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WD[get('weekday')] ?? 0,
    minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  };
}

const FAR_FUTURE = '9999-12-31';

/** The weekdays an entity runs on (daily = all, none = its own weekday). */
function weekdaysOf(e: {
  recurrence: Recur;
  recurrence_weekdays: number[] | null;
  departure_at: string;
}): number[] {
  if (e.recurrence === 'daily') return [1, 2, 3, 4, 5, 6, 7];
  if (e.recurrence === 'weekly') return e.recurrence_weekdays ?? [];
  return [localParts(e.departure_at).weekday];
}

/** [startYmd, endYmd] the entity is active over (none = a single day). */
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

/**
 * Do the ride and Gesuch schedules line up? True when their active date ranges
 * overlap, their weekday sets intersect, and their departure time-of-day is
 * within the Gesuch's window. Handles all one-off/recurring combinations
 * uniformly.
 */
export function schedulesCompatible(
  ride: MatchRide,
  gesuch: MatchGesuch
): boolean {
  const window = gesuch.departure_window_min ?? DEFAULT_WINDOW_MIN;
  const r = localParts(ride.departure_at);
  const g = localParts(gesuch.departure_at);
  if (Math.abs(r.minutes - g.minutes) > window) return false;
  if (!rangesOverlap(dateRange(ride), dateRange(gesuch))) return false;
  const rw = weekdaysOf(ride);
  const gw = weekdaysOf(gesuch);
  return rw.some((d) => gw.includes(d));
}

/**
 * Geographic fit: is there a pickup point on the ride within the Gesuch's origin
 * radius, and a LATER point within its destination radius? Candidate points are
 * origin → waypoints → destination, in travel order.
 */
export function routeCovers(ride: MatchRide, gesuch: MatchGesuch): boolean {
  const seq: GeoPoint[] = [ride.origin, ...(ride.waypoints ?? []), ride.destination];
  const oRad = effectiveRadiusM(gesuch.origin_radius_m, gesuch.flexible_origin);
  const dRad = effectiveRadiusM(
    gesuch.destination_radius_m,
    gesuch.flexible_destination
  );
  let firstPickup = -1;
  for (let i = 0; i < seq.length; i++) {
    if (haversineM(seq[i], gesuch.origin) <= oRad) {
      firstPickup = i;
      break;
    }
  }
  if (firstPickup === -1) return false;
  for (let j = seq.length - 1; j > firstPickup; j--) {
    if (haversineM(seq[j], gesuch.destination) <= dRad) return true;
  }
  return false;
}

/** Decide whether `ride` satisfies `gesuch`. Order: cheap checks first. */
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
  // Capacity only constrains one-off rides; recurring seats are per-instance.
  if (
    ride.recurrence === 'none' &&
    ride.seats_total - ride.seats_confirmed < gesuch.seats_needed
  ) {
    return { match: false, reason: 'no_seats' };
  }
  if (!schedulesCompatible(ride, gesuch)) {
    return { match: false, reason: 'schedule' };
  }
  if (!routeCovers(ride, gesuch)) {
    return { match: false, reason: 'geography' };
  }
  return { match: true };
}

/**
 * Client-side geo helpers. These hit our OWN same-origin Next routes
 * (/api/geo/*), which proxy to the self-hosted Nominatim/OSRM — so the browser
 * never talks to those services cross-origin.
 */

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distance_m: number;
  duration_s: number;
}

/** Address search. Returns [] on empty/short input or any failure. */
export async function geocode(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as GeoResult[]) : [];
  } catch {
    return [];
  }
}

/** Turn a map-clicked coordinate into an address (GeoResult), or null. */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeoResult | null> {
  try {
    const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const d = (await res.json()) as GeoResult;
    if (typeof d?.lat !== 'number' || typeof d?.lng !== 'number') return null;
    return d;
  } catch {
    return null;
  }
}

interface LngLat {
  lat: number;
  lng: number;
}

/** Build the directions query, routing through optional ordered waypoints. */
function directionsQuery(from: LngLat, to: LngLat, via?: LngLat[]): string {
  if (via && via.length > 0) {
    const coords = [from, ...via, to]
      .map((p) => `${p.lng},${p.lat}`)
      .join(';');
    return `coords=${coords}`;
  }
  return `from=${from.lng},${from.lat}&to=${to.lng},${to.lat}`;
}

/** Driving distance/time from origin to destination (through `via`), or null. */
export async function getRoute(
  from: LngLat,
  to: LngLat,
  via?: LngLat[]
): Promise<RouteInfo | null> {
  try {
    const res = await fetch(`/api/geo/directions?${directionsQuery(from, to, via)}`);
    if (!res.ok) return null;
    return (await res.json()) as RouteInfo;
  } catch {
    return null;
  }
}

/**
 * Driving-route line for drawing on the map: an array of [lng, lat] coordinates
 * through optional ordered waypoints, or null if the route can't be fetched.
 * Callers should fall back to straight segments between the points.
 */
export async function getRouteGeometry(
  from: LngLat,
  to: LngLat,
  via?: LngLat[]
): Promise<[number, number][] | null> {
  try {
    const res = await fetch(
      `/api/geo/directions?${directionsQuery(from, to, via)}&geometry=1`
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { geometry?: [number, number][] | null };
    return Array.isArray(d.geometry) && d.geometry.length > 1 ? d.geometry : null;
  } catch {
    return null;
  }
}

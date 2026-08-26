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

/** Driving distance/time between two points, or null if unavailable. */
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteInfo | null> {
  try {
    const res = await fetch(
      `/api/geo/directions?from=${from.lng},${from.lat}&to=${to.lng},${to.lat}`
    );
    if (!res.ok) return null;
    return (await res.json()) as RouteInfo;
  } catch {
    return null;
  }
}

/**
 * Driving-route line for drawing on the map: an array of [lng, lat] coordinates,
 * or null if the route can't be fetched. Callers should fall back to a straight
 * line between the two points.
 */
export async function getRouteGeometry(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<[number, number][] | null> {
  try {
    const res = await fetch(
      `/api/geo/directions?from=${from.lng},${from.lat}&to=${to.lng},${to.lat}&geometry=1`
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { geometry?: [number, number][] | null };
    return Array.isArray(d.geometry) && d.geometry.length > 1 ? d.geometry : null;
  } catch {
    return null;
  }
}

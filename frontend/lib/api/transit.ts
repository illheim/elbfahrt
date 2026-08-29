/**
 * Client for the same-origin transit departures proxy (/api/geo-style). Returns
 * an empty result on any failure so the UI degrades to showing nothing.
 */

export interface Departure {
  line: string;
  headsign: string;
  time: string; // ISO
  realtime: boolean;
  mode: string;
}

export interface DeparturesResult {
  stop: string | null;
  departures: Departure[];
}

export async function getDepartures(
  lat: number,
  lng: number,
  time?: string
): Promise<DeparturesResult> {
  try {
    const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (time) q.set('time', time);
    const res = await fetch(`/api/transit/departures?${q.toString()}`);
    if (!res.ok) return { stop: null, departures: [] };
    return (await res.json()) as DeparturesResult;
  } catch {
    return { stop: null, departures: [] };
  }
}

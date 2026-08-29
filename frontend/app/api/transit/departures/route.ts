/**
 * Public-transit departures proxy (v2.0 prototype).
 *
 * Server-side proxy to a MOTIS instance's /api/v6/stoptimes — given a
 * coordinate + time it returns the next departures from the nearest stop, so a
 * ride card can show "your carpool connects to the 08:14 train".
 *
 * PROTOTYPE: defaults to the free community Transitous API (api.transitous.org),
 * which is a THIRD PARTY. It's disabled by default (TRANSIT_ENABLED != 'true')
 * so production never calls out unless explicitly turned on. Only a coordinate
 * + time are sent — no user PII. For the real feature we'll self-host GTFS/MOTIS
 * and point MOTIS_URL at it (see LocalArchive departures-board tasks).
 */

import type { NextRequest } from 'next/server';

const MOTIS_URL = process.env.MOTIS_URL ?? 'https://api.transitous.org';
const NUM = /^-?\d+(\.\d+)?$/;

export async function GET(req: NextRequest) {
  if (process.env.TRANSIT_ENABLED !== 'true') {
    return Response.json({ stop: null, departures: [] });
  }

  const sp = req.nextUrl.searchParams;
  const lat = sp.get('lat');
  const lng = sp.get('lng');
  const time = sp.get('time') || undefined;
  const radius = Math.min(Number(sp.get('radius') ?? 500) || 500, 2000);

  if (!lat || !lng || !NUM.test(lat) || !NUM.test(lng)) {
    return Response.json({ error: 'lat_lng_required' }, { status: 400 });
  }

  const q = new URLSearchParams({
    center: `${lat},${lng}`,
    radius: String(radius),
    n: '5',
    arriveBy: 'false',
    mode: 'TRANSIT',
  });
  if (time) q.set('time', time);

  try {
    const res = await fetch(`${MOTIS_URL}/api/v6/stoptimes?${q.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return Response.json({ stop: null, departures: [] });

    const data = (await res.json()) as {
      place?: { name?: string };
      stopTimes?: Array<{
        routeShortName?: string;
        displayName?: string;
        headsign?: string;
        mode?: string;
        realTime?: boolean;
        place?: { departure?: string; scheduledDeparture?: string };
      }>;
    };

    const departures = (data.stopTimes ?? [])
      .slice(0, 5)
      .map((st) => {
        const p = st.place ?? {};
        return {
          line: st.routeShortName || st.displayName || st.headsign || '',
          headsign: st.headsign || '',
          time: p.departure || p.scheduledDeparture || null,
          realtime: !!st.realTime,
          mode: st.mode || '',
        };
      })
      .filter((d) => d.time);

    return Response.json({ stop: data.place?.name ?? null, departures });
  } catch {
    return Response.json({ stop: null, departures: [] });
  }
}

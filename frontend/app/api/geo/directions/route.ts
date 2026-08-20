/**
 * Routing proxy → self-hosted OSRM.
 *
 * Same rationale as the geocoding proxy: server-side, reaches OSRM over the
 * internal Docker network, browser stays same-origin.
 *
 * Query: ?from=lng,lat&to=lng,lat  (OSRM coordinate order is lng,lat).
 * Returns { distance_m, duration_s }.
 */

import type { NextRequest } from 'next/server';

const OSRM_URL = process.env.OSRM_URL ?? 'http://localhost:5000';

const COORD = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  if (!from || !to || !COORD.test(from) || !COORD.test(to)) {
    return Response.json({ error: 'from_and_to_required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${OSRM_URL}/route/v1/driving/${from};${to}?overview=false`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      return Response.json({ error: 'routing_failed' }, { status: 502 });
    }
    const data = (await res.json()) as {
      routes?: { distance?: number; duration?: number }[];
    };
    const route = data.routes?.[0];
    if (!route || route.distance == null || route.duration == null) {
      return Response.json({ error: 'no_route' }, { status: 404 });
    }
    return Response.json({
      distance_m: Math.round(route.distance),
      duration_s: Math.round(route.duration),
    });
  } catch {
    return Response.json({ error: 'routing_unavailable' }, { status: 502 });
  }
}

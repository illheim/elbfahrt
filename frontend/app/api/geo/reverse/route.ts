/**
 * Reverse-geocoding proxy → self-hosted Nominatim.
 *
 * Turns a map-clicked coordinate into an address label. Same rationale as the
 * search/directions proxies: server-side, reaches Nominatim over the internal
 * Docker network, browser stays same-origin.
 *
 * Query: ?lat=..&lng=..  Returns { label, lat, lng }.
 */

import type { NextRequest } from 'next/server';

const NOMINATIM_URL = process.env.NOMINATIM_URL ?? 'http://localhost:8080';
const NUM = /^-?\d+(\.\d+)?$/;

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lng = req.nextUrl.searchParams.get('lng');
  if (!lat || !lng || !NUM.test(lat) || !NUM.test(lng)) {
    return Response.json({ error: 'lat_and_lng_required' }, { status: 400 });
  }

  const params = new URLSearchParams({
    lat,
    lon: lng,
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'de',
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'elb-fahrt.de' },
    });
    if (!res.ok) {
      return Response.json({ error: 'reverse_failed' }, { status: 502 });
    }
    const d = (await res.json()) as {
      display_name?: string;
      lat?: string;
      lon?: string;
    };
    if (!d || !d.display_name) {
      return Response.json({ error: 'no_result' }, { status: 404 });
    }
    return Response.json({
      label: d.display_name,
      lat: Number(d.lat),
      lng: Number(d.lon),
    });
  } catch {
    return Response.json({ error: 'reverse_unavailable' }, { status: 502 });
  }
}

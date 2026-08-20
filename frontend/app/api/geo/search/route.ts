/**
 * Geocoding proxy → self-hosted Nominatim.
 *
 * Runs server-side (in the Next container) and reaches Nominatim over the
 * internal Docker network, so the browser calls this same-origin route instead
 * of Nominatim directly — no CORS, and Nominatim stays unexposed. A natural
 * place to add rate-limiting later (PLAN §5).
 *
 * NOMINATIM_URL is injected by docker-compose.override.yml (dev). The default
 * is only a local fallback.
 */

import type { NextRequest } from 'next/server';

const NOMINATIM_URL = process.env.NOMINATIM_URL ?? 'http://localhost:8080';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 3) return Response.json([]);

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    'accept-language': 'de',
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'elb-fahrt.de' },
    });
    if (!res.ok) {
      return Response.json({ error: 'geocoding_failed' }, { status: 502 });
    }
    const raw: unknown = await res.json();
    const results = (Array.isArray(raw) ? raw : []).map((d) => {
      const item = d as { display_name?: string; lat?: string; lon?: string };
      return {
        label: item.display_name ?? '',
        lat: Number(item.lat),
        lng: Number(item.lon),
      };
    });
    return Response.json(results);
  } catch {
    return Response.json({ error: 'geocoding_unavailable' }, { status: 502 });
  }
}

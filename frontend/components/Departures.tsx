'use client';

/**
 * "Weiter mit Bus & Bahn" — shows the next public-transit departures from the
 * stop nearest a coordinate (the ride's destination), around a given time.
 * Renders nothing while loading, when disabled, or when nothing is nearby, so
 * it's safe to drop onto any ride view. Prototype: data via Transitous.
 */

import { useEffect, useState } from 'react';
import { getDepartures, type Departure } from '@/lib/api/transit';

export function Departures({
  lat,
  lng,
  time,
}: {
  lat: number;
  lng: number;
  time?: string;
}) {
  const [stop, setStop] = useState<string | null>(null);
  const [deps, setDeps] = useState<Departure[] | null>(null);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let active = true;
    getDepartures(lat, lng, time).then((r) => {
      if (!active) return;
      setStop(r.stop);
      setDeps(r.departures);
    });
    return () => {
      active = false;
    };
  }, [lat, lng, time]);

  if (!deps || deps.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <h2 className="text-sm font-semibold text-neutral-900">
        Weiter mit Bus &amp; Bahn{stop ? ` ab ${stop}` : ''}
      </h2>
      <ul className="flex flex-col gap-1 text-sm text-neutral-700">
        {deps.map((d, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className="w-14 shrink-0 font-medium text-neutral-900">
              {fmtTime(d.time)}
            </span>
            {d.line && (
              <span className="shrink-0 rounded bg-neutral-200 px-1.5 text-xs font-medium text-neutral-800">
                {d.line}
              </span>
            )}
            <span className="truncate text-neutral-600">→ {d.headsign}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-400">Fahrplandaten: Transitous (Prototyp).</p>
    </section>
  );
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

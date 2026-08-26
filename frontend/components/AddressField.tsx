'use client';

/**
 * Debounced address autocomplete backed by our /api/geo/search proxy
 * (self-hosted Nominatim). On pick it hands back a GeoResult with lat/lng;
 * editing the text after a pick invalidates the selection (onSelect(null)) so
 * the parent knows the coordinates are stale. Closes on outside-click and shows
 * a searching / no-results state.
 *
 * Shared by the ride composer and the request composer.
 */

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { geocode, reverseGeocode, type GeoResult } from '@/lib/api/geo';

const LocationPicker = dynamic(
  () => import('@/components/LocationPicker').then((m) => m.LocationPicker),
  { ssr: false }
);

export function AddressField({
  label,
  value,
  onSelect,
  flexible = false,
  radiusM,
}: {
  label: string;
  value: GeoResult | null;
  onSelect: (r: GeoResult | null) => void;
  /** When true, the picker map shows a fixed ±1 km area around the point. */
  flexible?: boolean;
  /**
   * Flexibility radius in metres. When given it drives the picker ring (and
   * overrides `flexible`), so the circle matches a radius slider live. Omit to
   * fall back to the ±1 km boolean.
   */
  radiusM?: number | null;
}) {
  const ringActive = radiusM != null ? radiusM > 0 : flexible;
  const ringKm = radiusM != null ? radiusM / 1000 : 1;
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [picking, setPicking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // Close the dropdown when clicking outside the field.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    if (value) onSelect(null); // editing invalidates the previous pick
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    timer.current = setTimeout(async () => {
      const r = await geocode(v);
      setResults(r);
      setLoading(false);
      setOpen(true);
    }, 300);
  }

  function pick(r: GeoResult) {
    setQuery(r.label);
    setResults([]);
    setOpen(false);
    onSelect(r);
  }

  // Map tap → reverse-geocode the point to an address; fall back to the raw
  // coordinates if the lookup fails so a pick is never lost.
  async function handleMapPick(lng: number, lat: number) {
    setPicking(true);
    setResults([]);
    setOpen(false);
    const r = await reverseGeocode(lat, lng);
    const chosen: GeoResult = r ?? {
      label: `Punkt ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng,
    };
    setQuery(chosen.label);
    onSelect(chosen);
    setPicking(false);
  }

  const showEmpty =
    open && !loading && results.length === 0 && query.trim().length >= 3;

  return (
    <div ref={wrapRef} className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-800">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-pressed={showMap}
          aria-label={`${label} auf der Karte wählen`}
          title="Auf der Karte wählen"
          className={
            'rounded p-1 transition ' +
            (showMap
              ? 'text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-900')
          }
        >
          <MapIcon />
        </button>
      </div>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Adresse eingeben oder Karte antippen"
          autoComplete="off"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          aria-invalid={query.length > 0 && !value}
        />

        {open && results.length > 0 && (
          <ul className="absolute top-full z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-300 bg-white shadow-lg">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lng},${i}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {showEmpty && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500 shadow-lg">
            Keine Treffer.
          </div>
        )}
      </div>

      {picking ? (
        <span className="text-xs text-neutral-500">Adresse wird ermittelt…</span>
      ) : value ? (
        <span className="text-xs text-green-700">Ausgewählt.</span>
      ) : loading ? (
        <span className="text-xs text-neutral-500">Suche…</span>
      ) : null}

      {showMap && (
        <LocationPicker
          marker={value ? [value.lng, value.lat] : null}
          onPick={handleMapPick}
          flexible={ringActive}
          radiusKm={ringKm}
        />
      )}
    </div>
  );
}

function MapIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </svg>
  );
}

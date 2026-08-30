'use client';

/**
 * Ride composer — PLAN.md §2 step 6a (M3). Drivers offer a ride.
 *
 * Approved-drivers-only: non-drivers / unverified drivers are bounced to
 * /verify-driver. Address fields use Nominatim autocomplete (via our
 * /api/geo/search proxy) and resolve to lat/lng; once both ends are set we show
 * an OSRM distance/time preview (/api/geo/directions).
 *
 * We POST only the user-entered fields — the backend controller forces
 * driver = me, requires driver_status = approved, and sets status. See
 * lib/api/rides.ts CreateRideInput.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { ApiError } from '@/lib/api/client';
import { getRoute, type GeoResult, type RouteInfo } from '@/lib/api/geo';
import { createRide } from '@/lib/api/rides';
import { AddressField } from '@/components/AddressField';
import { toDateTimeLocalValue } from '@/lib/datetime';
import type { Recurrence } from '@/lib/api/types';

const RoutePreview = dynamic(
  () => import('@/components/RoutePreview').then((m) => m.RoutePreview),
  { ssr: false }
);

const WEEKDAYS: { n: number; label: string }[] = [
  { n: 1, label: 'Mo' },
  { n: 2, label: 'Di' },
  { n: 3, label: 'Mi' },
  { n: 4, label: 'Do' },
  { n: 5, label: 'Fr' },
  { n: 6, label: 'Sa' },
  { n: 7, label: 'So' },
];

export default function NewRidePage() {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();

  const [origin, setOrigin] = useState<GeoResult | null>(null);
  const [destination, setDestination] = useState<GeoResult | null>(null);
  // Stable ids so reordering/removing keeps each AddressField's own text state.
  const nextWpId = useRef(0);
  const [waypoints, setWaypoints] = useState<
    { id: number; value: GeoResult | null }[]
  >([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const [flexibleOrigin, setFlexibleOrigin] = useState(false);
  const [flexibleDestination, setFlexibleDestination] = useState(false);
  const [departure, setDeparture] = useState('');
  const [ret, setRet] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState('');
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const minDateTime = toDateTimeLocalValue(new Date(nowMs));

  // The filled (resolved) waypoints in travel order.
  const filledWaypoints = useMemo(
    () =>
      waypoints
        .map((w) => w.value)
        .filter((v): v is GeoResult => !!v),
    [waypoints]
  );

  // OSRM preview once both ends are set — routed through any waypoints. setState
  // only in the async callback, never synchronously in the effect body.
  useEffect(() => {
    if (!origin || !destination) return;
    let active = true;
    getRoute(origin, destination, filledWaypoints).then(
      (r) => active && setRouteInfo(r)
    );
    return () => {
      active = false;
    };
  }, [origin, destination, filledWaypoints]);

  const pickOrigin = (r: GeoResult | null) => {
    setOrigin(r);
    setRouteInfo(null);
  };
  const pickDestination = (r: GeoResult | null) => {
    setDestination(r);
    setRouteInfo(null);
  };

  const addWaypoint = () =>
    setWaypoints((w) => [...w, { id: nextWpId.current++, value: null }]);
  const setWaypointAt = (id: number, r: GeoResult | null) =>
    setWaypoints((w) => w.map((x) => (x.id === id ? { ...x, value: r } : x)));
  const removeWaypoint = (id: number) =>
    setWaypoints((w) => w.filter((x) => x.id !== id));
  const moveWaypoint = (id: number, dir: -1 | 1) =>
    setWaypoints((w) => {
      const i = w.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= w.length) return w;
      const next = [...w];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const toggleWeekday = (n: number) =>
    setWeekdays((cur) =>
      cur.includes(n) ? cur.filter((d) => d !== n) : [...cur, n].sort()
    );

  const valid =
    !!origin &&
    !!destination &&
    departure !== '' &&
    seats >= 1 &&
    (recurrence !== 'weekly' || weekdays.length > 0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || !origin || !destination) return;
    if (new Date(departure).getTime() < Date.now()) {
      setError('Die Abfahrt liegt in der Vergangenheit.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createRide({
        origin_address: origin.label,
        destination_address: destination.label,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        waypoints: filledWaypoints.map((w) => ({
          address: w.label,
          lat: w.lat,
          lng: w.lng,
        })),
        flexible_origin: flexibleOrigin,
        flexible_destination: flexibleDestination,
        departure_at: new Date(departure).toISOString(),
        return_at: ret ? new Date(ret).toISOString() : null,
        recurrence,
        recurrence_weekdays: recurrence === 'weekly' ? weekdays : null,
        recurrence_until: recurrence !== 'none' && until ? until : null,
        seats_total: seats,
        notes: notes.trim() || null,
        route_duration_s: routeInfo?.duration_s ?? null,
      });
      router.push('/');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? 'Nur verifizierte Fahrer:innen können Fahrten anbieten.'
          : 'Fahrt konnte nicht gespeichert werden. Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut.'
      );
      setSubmitting(false);
    }
  }

  if (isLoading || !user) return null;

  // driver_status is the gate (matches the API); roles is a soft preference (B1).
  const approved = user.driver_status === 'approved';

  if (!approved) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Fahrt anbieten</h1>
          <p className="text-sm text-neutral-600">
            Um Fahrten anzubieten, ist eine kurze Verifizierung als Fahrer:in
            nötig.
          </p>
        </header>
        <Link
          href="/verify-driver"
          className="rounded-md bg-neutral-900 px-4 py-3 text-center text-base font-medium text-white"
        >
          Jetzt verifizieren
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Fahrt anbieten</h1>
          <p className="text-sm text-neutral-600">Wohin fahren Sie?</p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          Abbrechen
        </Link>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <AddressField
          label="Start"
          value={origin}
          onSelect={pickOrigin}
          flexible={flexibleOrigin}
        />
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={flexibleOrigin}
            onChange={(e) => setFlexibleOrigin(e.target.checked)}
          />
          Start ist flexibel (±1 km)
        </label>

        <AddressField
          label="Ziel"
          value={destination}
          onSelect={pickDestination}
          flexible={flexibleDestination}
        />
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={flexibleDestination}
            onChange={(e) => setFlexibleDestination(e.target.checked)}
          />
          Ziel ist flexibel (±1 km)
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-800">
            Zwischenstopps <span className="text-neutral-400">(optional)</span>
          </span>
          <p className="text-xs text-neutral-500">
            Orte entlang der Strecke, an denen Sie zusteigen lassen – in
            Reihenfolge der Fahrt.
          </p>
          {waypoints.map((w, i) => (
            <div
              key={w.id}
              className="flex flex-col gap-1 rounded-md border border-neutral-200 p-2"
            >
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => moveWaypoint(w.id, -1)}
                  disabled={i === 0}
                  aria-label="Stopp nach oben"
                  className="rounded p-1 text-neutral-500 transition hover:text-neutral-900 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveWaypoint(w.id, 1)}
                  disabled={i === waypoints.length - 1}
                  aria-label="Stopp nach unten"
                  className="rounded p-1 text-neutral-500 transition hover:text-neutral-900 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeWaypoint(w.id)}
                  aria-label="Stopp entfernen"
                  className="rounded p-1 text-red-600 transition hover:text-red-800"
                >
                  ✕
                </button>
              </div>
              <AddressField
                label={`Stopp ${i + 1}`}
                value={w.value}
                onSelect={(r) => setWaypointAt(w.id, r)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addWaypoint}
            className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
          >
            + Zwischenstopp hinzufügen
          </button>
        </div>

        {origin && destination && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            {routeInfo
              ? `Strecke: ${fmtDistance(routeInfo.distance_m)} · ca. ${fmtDuration(
                  routeInfo.duration_s
                )}`
              : 'Strecke wird berechnet…'}
          </div>
        )}

        {origin && destination && (
          <RoutePreview
            origin={{ lat: origin.lat, lng: origin.lng }}
            destination={{ lat: destination.lat, lng: destination.lng }}
            waypoints={filledWaypoints.map((w) => ({ lat: w.lat, lng: w.lng }))}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-800">Abfahrt</span>
            <input
              type="datetime-local"
              required
              min={minDateTime}
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-800">
              Rückfahrt <span className="text-neutral-400">(optional)</span>
            </span>
            <input
              type="datetime-local"
              min={departure || minDateTime}
              value={ret}
              onChange={(e) => setRet(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-800">
            Freie Plätze
          </span>
          <input
            type="number"
            min={1}
            max={8}
            required
            value={seats}
            onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
            className={inputClass}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-neutral-800">
            Wiederholung
          </legend>
          <div className="flex gap-2">
            {(['none', 'weekly', 'daily'] as Recurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecurrence(r)}
                aria-pressed={recurrence === r}
                className={
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ' +
                  (recurrence === r
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-900')
                }
              >
                {r === 'none' ? 'Einmalig' : r === 'weekly' ? 'Wöchentlich' : 'Täglich'}
              </button>
            ))}
          </div>

          {recurrence === 'weekly' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {WEEKDAYS.map(({ n, label }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleWeekday(n)}
                  aria-pressed={weekdays.includes(n)}
                  className={
                    'h-9 w-9 rounded-full border text-xs font-medium transition ' +
                    (weekdays.includes(n)
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {recurrence !== 'none' && (
            <label className="flex flex-col gap-1 pt-1">
              <span className="text-sm font-medium text-neutral-800">
                Bis <span className="text-neutral-400">(optional)</span>
              </span>
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className={inputClass}
              />
            </label>
          )}
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-800">
            Notiz <span className="text-neutral-400">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !valid}
          className="rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {submitting ? 'Bitte warten…' : 'Fahrt veröffentlichen'}
        </button>
      </form>
    </main>
  );
}

function fmtDistance(m: number): string {
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

function fmtDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base ' +
  'focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

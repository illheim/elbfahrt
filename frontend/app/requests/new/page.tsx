'use client';

/**
 * Ride-request composer — PLAN.md §2 step 6b. A passenger posts "I need a lift".
 * Same shape as the ride composer minus the driver bits: any signed-in user can
 * post, and it's seats_needed rather than seats_total. Produces a RideRequest.
 */

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { ApiError } from '@/lib/api/client';
import { getRoute, type GeoResult, type RouteInfo } from '@/lib/api/geo';
import { createRideRequest } from '@/lib/api/requests';
import { AddressField } from '@/components/AddressField';
import { toDateTimeLocalValue } from '@/lib/datetime';
import type { Recurrence } from '@/lib/api/types';

const WEEKDAYS: { n: number; label: string }[] = [
  { n: 1, label: 'Mo' },
  { n: 2, label: 'Di' },
  { n: 3, label: 'Mi' },
  { n: 4, label: 'Do' },
  { n: 5, label: 'Fr' },
  { n: 6, label: 'Sa' },
  { n: 7, label: 'So' },
];

export default function NewRequestPage() {
  const { user, isLoading } = useRequireAuth();

  const [origin, setOrigin] = useState<GeoResult | null>(null);
  const [destination, setDestination] = useState<GeoResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Pickup/drop-off flexibility as a radius in metres (0 = exact). Powers
  // matching (v2.0 Stage 1a). Default to a small 1 km leeway.
  const [originRadiusM, setOriginRadiusM] = useState(1000);
  const [destinationRadiusM, setDestinationRadiusM] = useState(1000);
  const [departure, setDeparture] = useState('');
  const [ret, setRet] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState('');
  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const minDateTime = toDateTimeLocalValue(new Date(nowMs));

  useEffect(() => {
    if (!origin || !destination) return;
    let active = true;
    getRoute(origin, destination).then((r) => active && setRouteInfo(r));
    return () => {
      active = false;
    };
  }, [origin, destination]);

  const pickOrigin = (r: GeoResult | null) => {
    setOrigin(r);
    setRouteInfo(null);
  };
  const pickDestination = (r: GeoResult | null) => {
    setDestination(r);
    setRouteInfo(null);
  };

  const toggleWeekday = (n: number) =>
    setWeekdays((cur) =>
      cur.includes(n) ? cur.filter((d) => d !== n) : [...cur, n].sort()
    );

  const valid =
    !!origin &&
    !!destination &&
    departure !== '' &&
    seatsNeeded >= 1 &&
    (recurrence !== 'weekly' || weekdays.length > 0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || !origin || !destination) return;
    if (new Date(departure).getTime() < Date.now()) {
      setError('Der gewünschte Zeitpunkt liegt in der Vergangenheit.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createRideRequest({
        origin_address: origin.label,
        destination_address: destination.label,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        flexible_origin: originRadiusM > 0,
        flexible_destination: destinationRadiusM > 0,
        origin_radius_m: originRadiusM,
        destination_radius_m: destinationRadiusM,
        departure_at: new Date(departure).toISOString(),
        return_at: ret ? new Date(ret).toISOString() : null,
        recurrence,
        recurrence_weekdays: recurrence === 'weekly' ? weekdays : null,
        recurrence_until: recurrence !== 'none' && until ? until : null,
        seats_needed: seatsNeeded,
        notes: notes.trim() || null,
      });
      setPosted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? 'Gesuch konnte nicht gespeichert werden. Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut.'
          : 'Gesuch konnte nicht gespeichert werden. Bitte erneut versuchen.'
      );
      setSubmitting(false);
    }
  }

  if (isLoading || !user) return null;

  if (posted) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Gesuch veröffentlicht</h1>
          <p className="text-sm text-neutral-600">
            Ihr Mitfahrgesuch ist jetzt sichtbar. Passende Fahrer:innen können sich
            bei Ihnen melden.
          </p>
        </header>
        <Link
          href="/"
          className="self-start rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white"
        >
          Zur Übersicht
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Mitfahrt suchen</h1>
          <p className="text-sm text-neutral-600">
            Wohin möchten Sie? Ihr Gesuch erscheint für Fahrer:innen in der
            Region.
          </p>
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
          flexible={originRadiusM > 0}
        />
        <RadiusSlider
          label="Wie weit vom Start darf die Mitfahrt beginnen?"
          value={originRadiusM}
          onChange={setOriginRadiusM}
        />

        <AddressField
          label="Ziel"
          value={destination}
          onSelect={pickDestination}
          flexible={destinationRadiusM > 0}
        />
        <RadiusSlider
          label="Wie weit vom Ziel darf die Mitfahrt enden?"
          value={destinationRadiusM}
          onChange={setDestinationRadiusM}
        />

        {origin && destination && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            {routeInfo
              ? `Strecke: ${fmtDistance(routeInfo.distance_m)} · ca. ${fmtDuration(
                  routeInfo.duration_s
                )}`
              : 'Strecke wird berechnet…'}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-800">Wann</span>
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
            Benötigte Plätze
          </span>
          <input
            type="number"
            min={1}
            max={8}
            required
            value={seatsNeeded}
            onChange={(e) =>
              setSeatsNeeded(Math.max(1, Number(e.target.value) || 1))
            }
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
          {submitting ? 'Bitte warten…' : 'Gesuch veröffentlichen'}
        </button>
      </form>
    </main>
  );
}

/** Slider for a pickup/drop-off radius in metres (0 = exact). */
function RadiusSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (m: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-sm text-neutral-700">
        <span>{label}</span>
        <strong className="font-medium text-neutral-900">
          {fmtRadius(value)}
        </strong>
      </span>
      <input
        type="range"
        min={0}
        max={10000}
        step={500}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neutral-900"
        aria-label={label}
      />
    </label>
  );
}

/** Radius label: 0 → "genau hier", else "± X,X km". */
function fmtRadius(m: number): string {
  if (m <= 0) return 'genau hier';
  return `± ${(m / 1000).toFixed(1).replace('.', ',')} km`;
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

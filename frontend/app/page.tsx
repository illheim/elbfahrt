'use client';

/**
 * Overview — PLAN.md §2 step 5. The default post-auth landing for both roles.
 *
 * Two tabs: "Angebote" (ride offers — list/map, filterable) and "Gesuche" (ride
 * requests — a list of who's looking for a lift). This is how a driver sees the
 * demand. Approved drivers can reveal a requester's contact on a Gesuch card
 * (on-demand, per Gesuch) to arrange the ride directly.
 *
 * Data: GET /api/rides and GET /api/ride-requests, both returning only PII-safe
 * person fields. Filtering is client-side.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { ApiError } from '@/lib/api/client';
import { listActiveRides, type RideListItem } from '@/lib/api/rides';
import {
  listActiveRideRequests,
  getRideRequestContact,
  type RideRequestListItem,
  type GesuchContact,
} from '@/lib/api/requests';
import { CardSummary } from '@/components/CardSummary';

const RideMap = dynamic(
  () => import('@/components/RideMap').then((m) => m.RideMap),
  { ssr: false }
);

type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';
type Tab = 'rides' | 'requests';

interface Filters {
  from: string;
  to: string;
  date: string;
  timeOfDay: TimeOfDay;
  minSeats: number;
}

const EMPTY_FILTERS: Filters = {
  from: '',
  to: '',
  date: '',
  timeOfDay: 'any',
  minSeats: 0,
};

const WEEKDAYS = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']; // 1=Mon … 7=Sun

export default function OverviewPage() {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('rides');
  const [rides, setRides] = useState<RideListItem[] | null>(null);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RideRequestListItem[] | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const goToRide = useCallback(
    (documentId: string) => router.push(`/rides/${documentId}`),
    [router]
  );

  // Rides load on mount.
  useEffect(() => {
    if (!user) return;
    let active = true;
    listActiveRides()
      .then((r) => active && (setRides(r), setRidesError(null)))
      .catch((err) => {
        if (!active) return;
        setRidesError(
          err instanceof ApiError && err.status === 403
            ? 'Keine Berechtigung, Angebote zu laden (ride → find).'
            : 'Angebote konnten nicht geladen werden.'
        );
      });
    return () => {
      active = false;
    };
  }, [user]);

  // Gesuche load lazily the first time that tab is opened.
  useEffect(() => {
    if (tab !== 'requests' || requests !== null || !user) return;
    let active = true;
    listActiveRideRequests()
      .then((r) => active && (setRequests(r), setRequestsError(null)))
      .catch(() => active && setRequestsError('Gesuche konnten nicht geladen werden.'));
    return () => {
      active = false;
    };
  }, [tab, requests, user]);

  const filteredRides = useMemo(
    () =>
      (rides ?? []).filter(
        (r) =>
          !isPast(r.departure_at, r.recurrence) &&
          matchesTrip(r.origin_address, r.destination_address, r.departure_at, r.recurrence, r.seats_total, filters)
      ),
    [rides, filters]
  );

  const filteredRequests = useMemo(
    () =>
      (requests ?? []).filter(
        (r) =>
          !isPast(r.departure_at, r.recurrence) &&
          matchesTrip(r.origin_address, r.destination_address, r.departure_at, r.recurrence, r.seats_needed, filters)
      ),
    [requests, filters]
  );

  if (isLoading || !user) return null;

  const isApprovedDriver =
    (user.roles?.includes('driver') ?? false) &&
    user.driver_status === 'approved';
  const filtersActive =
    filters.from !== '' ||
    filters.to !== '' ||
    filters.date !== '' ||
    filters.timeOfDay !== 'any' ||
    filters.minSeats > 0;

  // Controls (Liste/Karte + Filter) only make sense with more than one item in
  // the active tab; with 0 or 1 we just show the message / the single card.
  const activeCount =
    tab === 'rides' ? (rides?.length ?? 0) : (requests?.length ?? 0);
  const showControls = activeCount > 1;
  const effectiveView = showControls ? view : 'list';

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/requests/new"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-900"
        >
          Gesuch aufgeben
        </Link>
        {isApprovedDriver ? (
          <Link
            href="/rides/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Fahrt anbieten
          </Link>
        ) : (
          <Link
            href="/verify-driver"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-900"
          >
            Fahrer:in werden
          </Link>
        )}
      </div>

      <div className="flex border-b border-neutral-200">
        <TabButton active={tab === 'rides'} onClick={() => setTab('rides')}>
          Angebote
        </TabButton>
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')}>
          Gesuche
        </TabButton>
      </div>

      {showControls && (
        <div className="flex items-center gap-2">
          <ViewToggle active={view === 'list'} onClick={() => setView('list')}>
            Liste
          </ViewToggle>
          <ViewToggle active={view === 'map'} onClick={() => setView('map')}>
            Karte
          </ViewToggle>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={
              'ml-auto rounded-md border px-3 py-1.5 text-sm font-medium transition ' +
              (filtersOpen || filtersActive
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900')
            }
          >
            Filter{filtersActive ? ' ·' : ''}
          </button>
        </div>
      )}

      {showControls && filtersOpen && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(EMPTY_FILTERS)}
          showReset={filtersActive}
        />
      )}

      {tab === 'rides' ? (
        <RidesPanel
          rides={rides}
          filtered={filteredRides}
          error={ridesError}
          view={effectiveView}
          filtersActive={filtersActive}
          onSelect={goToRide}
        />
      ) : (
        <RequestsPanel
          requests={requests}
          filtered={filteredRequests}
          error={requestsError}
          canSeeContact={isApprovedDriver}
          view={effectiveView}
          filtersActive={filtersActive}
        />
      )}
    </main>
  );
}

function RidesPanel({
  rides,
  filtered,
  error,
  view,
  filtersActive,
  onSelect,
}: {
  rides: RideListItem[] | null;
  filtered: RideListItem[];
  error: string | null;
  view: 'list' | 'map';
  filtersActive: boolean;
  onSelect: (documentId: string) => void;
}) {
  if (error) return <Alert>{error}</Alert>;
  if (rides === null) return <Loading>Angebote werden geladen…</Loading>;

  if (view === 'map') return <RideMap items={filtered} onSelect={onSelect} />;

  if (filtered.length === 0) {
    return (
      <Loading>
        {filtersActive
          ? 'Keine Angebote passen zu den Filtern.'
          : 'Aktuell sind keine Angebote eingetragen.'}
      </Loading>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {filtered.map((ride) => (
        <li key={ride.documentId ?? ride.id}>
          <RideCard ride={ride} />
        </li>
      ))}
    </ul>
  );
}

function RequestsPanel({
  requests,
  filtered,
  error,
  canSeeContact,
  view,
  filtersActive,
}: {
  requests: RideRequestListItem[] | null;
  filtered: RideRequestListItem[];
  error: string | null;
  canSeeContact: boolean;
  view: 'list' | 'map';
  filtersActive: boolean;
}) {
  if (error) return <Alert>{error}</Alert>;
  if (requests === null) return <Loading>Gesuche werden geladen…</Loading>;

  // Gesuche have no detail page, so the map markers aren't clickable — they just
  // show where lifts are wanted.
  if (view === 'map') return <RideMap items={filtered} />;

  if (filtered.length === 0) {
    return (
      <Loading>
        {filtersActive
          ? 'Keine Gesuche passen zu den Filtern.'
          : 'Aktuell sind keine Gesuche eingetragen.'}
      </Loading>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {filtered.map((req) => (
        <li key={req.documentId ?? req.id}>
          <RequestCard request={req} canSeeContact={canSeeContact} />
        </li>
      ))}
    </ul>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'flex-1 border-b-2 px-2 pb-2 text-sm font-semibold uppercase tracking-wide transition ' +
        (active
          ? 'border-neutral-900 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-800')
      }
    >
      {children}
    </button>
  );
}

function ViewToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-md border px-3 py-1.5 text-sm font-medium transition ' +
        (active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900')
      }
    >
      {children}
    </button>
  );
}

function FilterBar({
  filters,
  onChange,
  onReset,
  showReset,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  showReset: boolean;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <section className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Von</span>
          <input
            type="text"
            value={filters.from}
            onChange={(e) => set('from', e.target.value)}
            placeholder="Ort"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Nach</span>
          <input
            type="text"
            value={filters.to}
            onChange={(e) => set('to', e.target.value)}
            placeholder="Ort"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Datum</span>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => set('date', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Tageszeit</span>
          <select
            value={filters.timeOfDay}
            onChange={(e) => set('timeOfDay', e.target.value as TimeOfDay)}
            className={inputClass}
          >
            <option value="any">Egal</option>
            <option value="morning">Morgens (bis 12)</option>
            <option value="afternoon">Mittags (12–17)</option>
            <option value="evening">Abends (ab 17)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">
            Min. Plätze
          </span>
          <input
            type="number"
            min={0}
            max={8}
            value={filters.minSeats || ''}
            onChange={(e) => set('minSeats', Number(e.target.value) || 0)}
            placeholder="0"
            className={inputClass}
          />
        </label>
      </div>
      {showReset && (
        <button
          type="button"
          onClick={onReset}
          className="self-start text-xs font-medium text-accent-700 underline"
        >
          Filter zurücksetzen
        </button>
      )}
    </section>
  );
}

function RideCard({ ride }: { ride: RideListItem }) {
  const [open, setOpen] = useState(false);
  const recur = recurrenceLabel(ride);
  const when = recur
    ? `${recur} · ab ${fmtTime(ride.departure_at)} Uhr`
    : `${fmtDay(ride.departure_at)} · ${fmtTime(ride.departure_at)} Uhr`;

  return (
    <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
      <CardSummary
        origin={ride.origin_address}
        destination={ride.destination_address}
        when={when}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        badge={
          <SeatsBadge>
            {ride.seats_total} {ride.seats_total === 1 ? 'Platz' : 'Plätze'}
          </SeatsBadge>
        }
      />
      {open && (
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 pb-4 pt-3">
          <Route origin={ride.origin_address} destination={ride.destination_address} />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {ride.driver?.first_name && (
              <span className="text-neutral-600">{ride.driver.first_name}</span>
            )}
            {(ride.flexible_origin || ride.flexible_destination) && (
              <Badge>±1 km flexibel</Badge>
            )}
          </div>
          <Link
            href={`/rides/${ride.documentId}`}
            className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Ansehen & buchen
          </Link>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  canSeeContact,
}: {
  request: RideRequestListItem;
  canSeeContact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const recur = recurrenceLabel(request);
  const when = recur
    ? `${recur} · ab ${fmtTime(request.departure_at)} Uhr`
    : `${fmtDay(request.departure_at)} · ${fmtTime(request.departure_at)} Uhr`;

  return (
    <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
      <CardSummary
        origin={request.origin_address}
        destination={request.destination_address}
        when={when}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        badge={
          <SeatsBadge>
            sucht {request.seats_needed}{' '}
            {request.seats_needed === 1 ? 'Platz' : 'Plätze'}
          </SeatsBadge>
        }
      />
      {open && (
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 pb-4 pt-3">
          <Route
            origin={request.origin_address}
            destination={request.destination_address}
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {request.passenger?.first_name && (
              <span className="text-neutral-600">
                {request.passenger.first_name}
              </span>
            )}
            {radiusLabel(request) && <Badge>{radiusLabel(request)}</Badge>}
          </div>
          {canSeeContact && <ContactReveal documentId={request.documentId ?? ''} />}
        </div>
      )}
    </div>
  );
}

/**
 * Approved-driver-only contact reveal on a Gesuch. The number isn't in the list
 * payload; clicking fetches it just for this Gesuch (GET /ride-requests/:id),
 * so a driver pulls a number deliberately rather than scraping the whole board.
 */
function ContactReveal({ documentId }: { documentId: string }) {
  const [contact, setContact] = useState<GesuchContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(false);
    try {
      const c = await getRideRequestContact(documentId);
      if (c) setContact(c);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (contact) {
    return (
      <div className="mt-1 border-t border-neutral-200 pt-2 text-sm text-neutral-700">
        <span className="font-medium text-neutral-900">{contact.name}</span>
        {contact.is_guardian && (
          <span className="text-neutral-500"> (Elternteil)</span>
        )}
        {contact.phone && (
          <>
            {' · '}
            <a href={`tel:${contact.phone}`} className="text-accent-700 underline">
              {contact.phone}
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={reveal}
      disabled={loading}
      className="mt-1 self-start text-sm font-medium text-accent-700 underline disabled:opacity-50"
    >
      {loading ? 'Wird geladen…' : error ? 'Erneut versuchen' : 'Kontakt anzeigen'}
    </button>
  );
}

function Route({ origin, destination }: { origin: string; destination: string }) {
  return (
    <div className="flex flex-col text-sm font-medium text-neutral-900">
      <span>{origin}</span>
      <span className="text-neutral-400">↓</span>
      <span>{destination}</span>
    </div>
  );
}

function SeatsBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-warm-100 px-2 py-1 text-xs font-medium text-warm-600">
      {children}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-neutral-600">
      {children}
    </span>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
    >
      {children}
    </div>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-neutral-500">{children}</p>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** A one-off trip whose departure has already passed is dead — hide it. */
function isPast(departureAt: string, recurrence: string): boolean {
  return recurrence === 'none' && new Date(departureAt).getTime() < Date.now();
}

/** Shared client-side filter for rides and requests (same trip fields). */
function matchesTrip(
  origin: string,
  destination: string,
  departureAt: string,
  recurrence: string,
  seats: number,
  f: Filters
): boolean {
  if (f.from && !origin.toLowerCase().includes(f.from.trim().toLowerCase()))
    return false;
  if (f.to && !destination.toLowerCase().includes(f.to.trim().toLowerCase()))
    return false;
  // A one-off trip must fall on the chosen day; recurring ones run across many
  // dates, so they pass the date filter (matched by time instead).
  if (f.date && recurrence === 'none' && departureAt.slice(0, 10) !== f.date)
    return false;
  if (f.timeOfDay !== 'any') {
    const h = new Date(departureAt).getHours();
    const bucket: TimeOfDay = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    if (bucket !== f.timeOfDay) return false;
  }
  if (f.minSeats > 0 && seats < f.minSeats) return false;
  return true;
}

/**
 * Flexibility badge for a Gesuch. Derives the effective radius, falling back to
 * the legacy boolean (`radius ?? flexible ? 1000 : 0`) for pre-v2.0 rows, and
 * returns the larger of origin/destination, or null when exact.
 */
function radiusLabel(r: {
  flexible_origin: boolean;
  flexible_destination: boolean;
  origin_radius_m: number | null;
  destination_radius_m: number | null;
}): string | null {
  const o = r.origin_radius_m ?? (r.flexible_origin ? 1000 : 0);
  const d = r.destination_radius_m ?? (r.flexible_destination ? 1000 : 0);
  const m = Math.max(o, d);
  if (m <= 0) return null;
  return `± ${(m / 1000).toFixed(1).replace('.', ',')} km flexibel`;
}

function recurrenceLabel(t: {
  recurrence: string;
  recurrence_weekdays: number[] | null;
}): string | null {
  if (t.recurrence === 'daily') return 'täglich';
  if (t.recurrence === 'weekly') {
    const days = (t.recurrence_weekdays ?? [])
      .map((d) => WEEKDAYS[d])
      .filter(Boolean)
      .join(', ');
    return days ? `wöchentlich · ${days}` : 'wöchentlich';
  }
  return null;
}

function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ' +
  'focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

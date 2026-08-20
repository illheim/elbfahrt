'use client';

/**
 * Meine Fahrten — the caller's trips from /me/bookings, from both sides:
 *   Als Mitfahrer:in — seats I booked (with the driver's contact).
 *   Als Fahrer:in    — bookings on rides I offer (with the passenger's contact).
 *
 * Contact (mobile) shows only for confirmed bookings; the backend withholds it
 * otherwise. This is the one screen that surfaces phone numbers.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import {
  getMyBookings,
  cancelBooking,
  type MyBookings,
  type MyBookingRide,
  type MyDriverBooking,
  type MyRideRequest,
  type MyOfferedRide,
  type Contact,
} from '@/lib/api/bookings';
import { cancelRide } from '@/lib/api/rides';
import { CardSummary } from '@/components/CardSummary';
import type { BookingStatus } from '@/lib/api/types';

export default function MyTripsPage() {
  const { user, isLoading } = useRequireAuth();
  const [data, setData] = useState<MyBookings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'passenger' | 'driver'>('passenger');

  // Reload used by the cancel handlers (event-driven, so no effect lint issue).
  const load = useCallback(async () => {
    try {
      const d = await getMyBookings();
      setData(d);
      setError(null);
    } catch {
      setError('Ihre Fahrten konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let live = true;
    getMyBookings()
      .then((d) => {
        if (live) {
          setData(d);
          setError(null);
        }
      })
      .catch(() => live && setError('Ihre Fahrten konnten nicht geladen werden.'));
    return () => {
      live = false;
    };
  }, [user]);

  async function onCancelBooking(documentId: string) {
    if (!window.confirm('Buchung wirklich stornieren?')) return;
    try {
      await cancelBooking(documentId);
      await load();
    } catch {
      setError('Stornieren nicht möglich. Bitte erneut versuchen.');
    }
  }

  async function onCancelRide(documentId: string) {
    if (
      !window.confirm(
        'Fahrt wirklich absagen? Bereits gebuchte Mitfahrer:innen werden storniert.'
      )
    ) {
      return;
    }
    try {
      await cancelRide(documentId);
      await load();
    } catch {
      setError('Absagen nicht möglich. Bitte erneut versuchen.');
    }
  }

  const myRequests = data?.as_requester ?? [];
  const offeredRides = data?.offered_rides ?? [];

  // Group the bookings others made on my rides, by ride, so each offered ride
  // can show its own passengers instead of a separate duplicate list.
  const bookingsByRide = new Map<string, MyDriverBooking[]>();
  for (const b of data?.as_driver ?? []) {
    const rid = b.ride?.documentId;
    if (!rid) continue;
    const arr = bookingsByRide.get(rid);
    if (arr) arr.push(b);
    else bookingsByRide.set(rid, [b]);
  }

  if (isLoading || !user) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <h1 className="text-2xl font-semibold">Meine Fahrten</h1>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          {error}
        </div>
      )}

      {!error && data === null && (
        <p className="py-8 text-center text-sm text-neutral-500">Wird geladen…</p>
      )}

      {data && (
        <>
          <div className="flex border-b border-neutral-200">
            <TabButton
              active={tab === 'passenger'}
              onClick={() => setTab('passenger')}
            >
              Als Mitfahrer:in
            </TabButton>
            <TabButton
              active={tab === 'driver'}
              onClick={() => setTab('driver')}
            >
              Als Fahrer:in
            </TabButton>
          </div>

          <div className="flex flex-col gap-3">
            {tab === 'passenger' ? (
              data.as_passenger.length === 0 && myRequests.length === 0 ? (
                <Empty>
                  Sie haben noch keine Mitfahrten gebucht oder gesucht.
                </Empty>
              ) : (
                <>
                  {data.as_passenger.map((b) => (
                    <TripCard
                      key={b.documentId}
                      ride={b.ride}
                      status={b.status}
                      instanceDate={b.instance_date}
                      contactLabel="Fahrer:in"
                      contact={b.ride?.driver ?? null}
                      onCancel={() => onCancelBooking(b.documentId)}
                    />
                  ))}
                  {myRequests.length > 0 && (
                    <p className="pt-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Offene Gesuche
                    </p>
                  )}
                  {myRequests.map((r) => (
                    <RequestCard key={`req-${r.documentId ?? r.id}`} request={r} />
                  ))}
                </>
              )
            ) : offeredRides.length === 0 ? (
              <Empty>Sie bieten noch keine Fahrten an.</Empty>
            ) : (
              offeredRides.map((r) => (
                <OfferedRideCard
                  key={`ride-${r.documentId ?? r.id}`}
                  ride={r}
                  bookings={bookingsByRide.get(r.documentId) ?? []}
                  onCancel={() => onCancelRide(r.documentId)}
                />
              ))
            )}
          </div>
        </>
      )}
    </main>
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

function TripCard({
  ride,
  status,
  instanceDate,
  contactLabel,
  contact,
  onCancel,
}: {
  ride: MyBookingRide | null;
  status: BookingStatus;
  instanceDate: string | null;
  contactLabel: string;
  contact: Contact | null;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!ride) return null;
  const when = instanceDate
    ? fmtDate(instanceDate)
    : `${fmtDay(ride.departure_at)} · ${fmtTime(ride.departure_at)} Uhr`;
  const name = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : null;
  const canCancel = !!onCancel && status === 'confirmed';

  return (
    <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
      <CardSummary
        origin={ride.origin_address}
        destination={ride.destination_address}
        when={when}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        badge={<StatusBadge status={status} />}
      />
      {open && (
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 pb-4 pt-3">
          <div className="flex flex-col text-sm font-medium text-neutral-900">
            <span>{ride.origin_address}</span>
            <span className="text-neutral-400">↓</span>
            <span>{ride.destination_address}</span>
          </div>
          {name && (
            <div className="text-sm text-neutral-600">
              {contactLabel}: {name}
              {contact?.mobile && (
                <>
                  {' · '}
                  <a
                    href={`tel:${contact.mobile}`}
                    className="text-accent-700 underline"
                  >
                    {contact.mobile}
                  </a>
                </>
              )}
            </div>
          )}
          {canCancel && <CancelButton onClick={onCancel}>Stornieren</CancelButton>}
        </div>
      )}
    </div>
  );
}

/**
 * A greyed card for the caller's own open Gesuch — posted but not yet a booked
 * ride, so it's visually muted and badged to set it apart from actual bookings.
 */
function RequestCard({ request }: { request: MyRideRequest }) {
  const [open, setOpen] = useState(false);
  const recurring = request.recurrence && request.recurrence !== 'none';
  const when = `${fmtDay(request.departure_at)} · ${fmtTime(
    request.departure_at
  )} Uhr${recurring ? ' · regelmäßig' : ''}`;

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
      <CardSummary
        origin={request.origin_address}
        destination={request.destination_address}
        when={when}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        badge={<MutedBadge>Gesuch</MutedBadge>}
      />
      {open && (
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 pb-4 pt-3">
          <div className="flex flex-col text-sm font-medium text-neutral-600">
            <span>{request.origin_address}</span>
            <span className="text-neutral-300">↓</span>
            <span>{request.destination_address}</span>
          </div>
          <div className="text-xs text-neutral-400">
            Sichtbar für Fahrer:innen · wartet auf eine passende Fahrt.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A ride the caller offers. Expanded, it lists the passengers who booked it
 * (with contact) — so there's a single "my rides" list, not a duplicate
 * "bookings" section. Visible even before anyone books.
 */
function OfferedRideCard({
  ride,
  bookings,
  onCancel,
}: {
  ride: MyOfferedRide;
  bookings: MyDriverBooking[];
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const recurring = ride.recurrence && ride.recurrence !== 'none';
  const when = `${fmtDay(ride.departure_at)} · ${fmtTime(
    ride.departure_at
  )} Uhr${recurring ? ' · regelmäßig' : ''}`;

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
      <CardSummary
        origin={ride.origin_address}
        destination={ride.destination_address}
        when={when}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        badge={
          <MutedBadge>
            {bookings.length > 0
              ? `${bookings.length} ${bookings.length === 1 ? 'Buchung' : 'Buchungen'}`
              : 'angeboten'}
          </MutedBadge>
        }
      />
      {open && (
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 pb-4 pt-3">
          <div className="flex flex-col text-sm font-medium text-neutral-600">
            <span>{ride.origin_address}</span>
            <span className="text-neutral-300">↓</span>
            <span>{ride.destination_address}</span>
          </div>

          {bookings.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Mitfahrer:innen
              </span>
              {bookings.map((b) => {
                const name = b.passenger
                  ? [b.passenger.first_name, b.passenger.last_name]
                      .filter(Boolean)
                      .join(' ')
                  : '—';
                return (
                  <span key={b.documentId} className="text-sm text-neutral-700">
                    {name}
                    {b.instance_date && (
                      <span className="text-neutral-400">
                        {' '}
                        · {fmtDate(b.instance_date)}
                      </span>
                    )}
                    {b.passenger?.mobile && (
                      <>
                        {' · '}
                        <a
                          href={`tel:${b.passenger.mobile}`}
                          className="text-accent-700 underline"
                        >
                          {b.passenger.mobile}
                        </a>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-neutral-400">
              {ride.seats_total} {ride.seats_total === 1 ? 'Platz' : 'Plätze'} ·
              noch keine Buchung.
            </div>
          )}

          <CancelButton onClick={onCancel}>Fahrt absagen</CancelButton>
        </div>
      )}
    </div>
  );
}

/** Small muted pill for the greyed cards ("Gesuch" / "angeboten"). */
function MutedBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-500">
      {children}
    </span>
  );
}

/** Small red-outline cancel button. */
function CancelButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 transition hover:bg-red-50"
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const label =
    status === 'confirmed'
      ? 'bestätigt'
      : status === 'cancelled_by_passenger'
        ? 'von Ihnen storniert'
        : 'storniert';
  const tone =
    status === 'confirmed'
      ? 'border-green-300 bg-green-50 text-green-800'
      : 'border-neutral-300 bg-neutral-50 text-neutral-600';
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function fmtDate(ymd: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${ymd}T00:00:00`));
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

'use client';

/**
 * Ride detail + booking — PLAN.md §2 (book a seat). Reached from the overview.
 *
 * Shows one ride and lets a passenger book a seat. For recurring rides the
 * passenger must pick a specific day (instance_date), matching the backend
 * rule (PLAN Q5). The ride's own driver sees a "this is your ride" note instead
 * of a booking action.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { ApiError } from '@/lib/api/client';
import { getRide, type RideListItem } from '@/lib/api/rides';
import { createBooking } from '@/lib/api/bookings';

const WEEKDAYS = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']; // 1=Mon … 7=Sun

export default function RideDetailPage() {
  const { user, isLoading } = useRequireAuth();
  const { documentId } = useParams<{ documentId: string }>();

  const [ride, setRide] = useState<RideListItem | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>(
    'loading'
  );

  const [instanceDate, setInstanceDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  // Capture "now" once (reading the clock during render is impure).
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!user || !documentId) return;
    let active = true;
    getRide(documentId)
      .then((r) => {
        if (!active) return;
        setRide(r);
        setStatus('ok');
      })
      .catch((e) => {
        if (!active) return;
        setStatus(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error');
      });
    return () => {
      active = false;
    };
  }, [user, documentId]);

  async function book() {
    if (!ride) return;
    const isRecurring = ride.recurrence !== 'none';
    if (isRecurring && !instanceDate) {
      setBookingError('Bitte wählen Sie einen Tag für die Fahrt.');
      return;
    }
    setBookingError(null);
    setSubmitting(true);
    try {
      await createBooking({
        ride: ride.documentId,
        instance_date: isRecurring ? instanceDate : null,
      });
      setBooked(true);
    } catch (e) {
      setBookingError(bookingErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) return null;

  if (status === 'loading') {
    return <Centered>Fahrt wird geladen…</Centered>;
  }
  if (status === 'notfound') {
    return (
      <Centered>
        Diese Fahrt gibt es nicht (mehr).{' '}
        <Link href="/" className="text-accent-700 underline">
          Zur Übersicht
        </Link>
      </Centered>
    );
  }
  if (status === 'error' || !ride) {
    return <Centered>Fahrt konnte nicht geladen werden.</Centered>;
  }

  const recur = recurrenceLabel(ride);
  const isOwnRide = ride.driver?.id === user.id;
  const isPastOneOff =
    ride.recurrence === 'none' &&
    new Date(ride.departure_at).getTime() < nowMs;
  const todayStr = new Date(nowMs).toISOString().slice(0, 10);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/" className="text-sm text-accent-700 underline">
        ← Zur Übersicht
      </Link>

      <section className="flex flex-col gap-3 rounded-md border border-neutral-300 bg-white p-4">
        <div className="flex flex-col text-base font-medium text-neutral-900">
          <span>{ride.origin_address}</span>
          {ride.waypoints?.map((w, i) => (
            <span key={i} className="flex flex-col">
              <span className="text-neutral-400">↓</span>
              <span className="text-sm font-normal text-neutral-600">
                {w.address}
              </span>
            </span>
          ))}
          <span className="text-neutral-400">↓</span>
          <span>{ride.destination_address}</span>
        </div>

        <div className="text-sm text-neutral-700">
          {recur ? (
            <span>
              {recur} · ab {fmtTime(ride.departure_at)} Uhr
            </span>
          ) : (
            <span>
              {fmtDay(ride.departure_at)} · {fmtTime(ride.departure_at)} Uhr
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-warm-100 px-2 py-1 font-medium text-warm-600">
            {ride.seats_total} {ride.seats_total === 1 ? 'Platz' : 'Plätze'}
          </span>
          {ride.driver?.first_name && (
            <Badge>Fahrer:in: {ride.driver.first_name}</Badge>
          )}
          {(ride.flexible_origin || ride.flexible_destination) && (
            <Badge>±1 km flexibel</Badge>
          )}
        </div>

        {ride.notes && (
          <p className="whitespace-pre-line text-sm text-neutral-600">
            {ride.notes}
          </p>
        )}
      </section>

      {isOwnRide ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
          Das ist Ihre angebotene Fahrt.
        </p>
      ) : isPastOneOff ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
          Diese Fahrt liegt in der Vergangenheit und kann nicht gebucht werden.
        </p>
      ) : booked ? (
        <section className="flex flex-col gap-3 rounded-md border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            Platz gebucht! Die Fahrer:in wird informiert. Die Kontaktdaten finden
            Sie unter „Meine Fahrten“.
          </p>
          <Link
            href="/"
            className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Zur Übersicht
          </Link>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {ride.recurrence !== 'none' && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-800">
                Für welchen Tag?
              </span>
              <input
                type="date"
                value={instanceDate}
                min={todayStr}
                onChange={(e) => setInstanceDate(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              {ride.recurrence === 'weekly' && ride.recurrence_weekdays?.length ? (
                <span className="text-xs text-neutral-500">
                  Diese Fahrt fährt:{' '}
                  {ride.recurrence_weekdays.map((d) => WEEKDAYS[d]).join(', ')}
                </span>
              ) : null}
            </label>
          )}

          {bookingError && (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
            >
              {bookingError}
            </div>
          )}

          <button
            type="button"
            onClick={book}
            disabled={submitting}
            className="rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {submitting ? 'Bitte warten…' : 'Platz buchen'}
          </button>
        </section>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4">
      <p className="py-8 text-center text-sm text-neutral-500">{children}</p>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-neutral-600">
      {children}
    </span>
  );
}

/** Map the backend's stable booking-denial reason code to a German message. */
function bookingErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) {
    return 'Verbindungsproblem. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.';
  }
  // The reason lives under Strapi's error.details.reason; read the plain shape
  // too, in case an error type flattens it.
  const d = e.details as
    | { reason?: string; details?: { reason?: string } }
    | undefined;
  const reason = d?.details?.reason ?? d?.reason;
  switch (reason) {
    case 'in_the_past':
      return 'Diese Fahrt liegt in der Vergangenheit.';
    case 'already_booked':
      return 'Sie haben auf dieser Fahrt bereits einen Platz.';
    case 'no_seats':
      return 'Auf dieser Fahrt sind keine Plätze mehr frei.';
    case 'ride_not_active':
      return 'Diese Fahrt ist nicht mehr buchbar.';
    case 'own_ride':
      return 'Sie können Ihre eigene Fahrt nicht buchen.';
    case 'needs_instance_date':
      return 'Bitte wählen Sie einen Tag für die Fahrt.';
    default:
      return 'Diese Fahrt kann gerade nicht gebucht werden. Bitte laden Sie die Seite neu.';
  }
}

function recurrenceLabel(r: RideListItem): string | null {
  if (r.recurrence === 'daily') return 'täglich';
  if (r.recurrence === 'weekly') {
    const days = (r.recurrence_weekdays ?? [])
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

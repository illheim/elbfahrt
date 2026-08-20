'use client';

/**
 * Driver verification — PLAN.md §2 step 4 (M3.d).
 *
 * A driver enters their Personalausweis OR Führerschein number. We run the
 * Modulo-10 checksum client-side for instant feedback, then submit to
 * /me/profile, where the server re-validates and — per the validate-and-discard
 * policy (PLAN Q2) — checks the number and throws it away, storing only the
 * outcome (driver_id_type + driver_status). So we reassure the user the number
 * is never stored.
 *
 * Outcomes from the server:
 *   - driver_status = "approved"       → auto-approve setting was on; done.
 *   - driver_status = "pending_review" → goes to the admin queue.
 *
 * Requires: Strapi → Roles → Authenticated → me.updateProfile = on
 * (see PLAN Appendix C). Without it the PUT returns 403.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { updateProfile } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { isValidIdNumber, normaliseIdNumber } from '@/lib/modulo10';
import type { DriverIdType, UserRole } from '@/lib/api/types';

const ID_META: Record<DriverIdType, { label: string; hint: string }> = {
  personalausweis: {
    label: 'Personalausweis',
    hint: '10 Zeichen, die letzte ist eine Ziffer (z. B. T220001293).',
  },
  fuehrerschein: {
    label: 'Führerschein',
    hint: '11 Zeichen, die letzte ist eine Ziffer.',
  },
};

export default function VerifyDriverPage() {
  const { user, isLoading } = useRequireAuth();
  const { refresh } = useAuth();
  const router = useRouter();

  const [idType, setIdType] = useState<DriverIdType>('personalausweis');
  const [idNumber, setIdNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'approved' | 'pending' | null>(null);

  const clientValid = useMemo(
    () => isValidIdNumber(idType, idNumber),
    [idType, idNumber]
  );
  const touched = idNumber.trim().length > 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !clientValid) return;
    setError(null);
    setSubmitting(true);
    try {
      // Preserve any existing role (e.g. passenger); just ensure "driver".
      const roles: UserRole[] = user.roles?.includes('driver')
        ? user.roles
        : [...(user.roles ?? []), 'driver'];

      const updated = await updateProfile({
        roles,
        driver_id_type: idType,
        driver_id_number: normaliseIdNumber(idNumber),
      });
      await refresh();
      setResult(updated.driver_status === 'approved' ? 'approved' : 'pending');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 400
            ? 'Die Ausweisnummer ist ungültig. Bitte prüfen Sie Ihre Eingabe.'
            : err.status === 403
              ? 'Berechtigungsfehler. Bitte die Strapi-Rolle „Authenticated" prüfen (me.updateProfile).'
              : err.message
          : 'Speichern fehlgeschlagen. Bitte erneut versuchen.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) return null;

  // Already verified, and not just now → nothing to do here.
  if (user.driver_status === 'approved' && !result) {
    return (
      <Shell
        title="Bereits verifiziert"
        subtitle="Sie sind als Fahrer:in freigeschaltet und können Fahrten anbieten."
      >
        <PrimaryButton onClick={() => router.push('/')}>
          Weiter zur Übersicht
        </PrimaryButton>
      </Shell>
    );
  }

  if (result === 'approved') {
    return (
      <Shell
        title="Verifizierung abgeschlossen"
        subtitle="Ihre Angaben wurden geprüft und Sie sind als Fahrer:in freigeschaltet."
      >
        <PrimaryButton onClick={() => router.push('/')}>
          Weiter zur Übersicht
        </PrimaryButton>
      </Shell>
    );
  }

  if (result === 'pending') {
    return (
      <Shell
        title="Angaben eingereicht"
        subtitle="Ihre Ausweisnummer wurde geprüft. Ein:e Administrator:in schaltet Sie in Kürze frei — Sie können die Übersicht schon nutzen."
      >
        <PrimaryButton onClick={() => router.push('/')}>
          Weiter zur Übersicht
        </PrimaryButton>
      </Shell>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Fahrer:in verifizieren</h1>
        <p className="text-sm text-neutral-600">
          Ein kurzer Schritt, bevor Sie Fahrten anbieten können. Bitte geben Sie
          Ihre Ausweis- oder Führerscheinnummer ein.
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-neutral-800">
            Dokument
          </legend>
          <div className="flex gap-2">
            {(Object.keys(ID_META) as DriverIdType[]).map((type) => {
              const active = idType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setIdType(type)}
                  aria-pressed={active}
                  className={
                    'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ' +
                    (active
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-900')
                  }
                >
                  {ID_META[type].label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-800">
            {ID_META[idType].label}-Nummer
          </span>
          <input
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            aria-invalid={touched && !clientValid}
            className={inputClass}
          />
          <span
            className={
              'text-xs ' +
              (!touched
                ? 'text-neutral-500'
                : clientValid
                  ? 'text-green-700'
                  : 'text-amber-700')
            }
          >
            {!touched
              ? ID_META[idType].hint
              : clientValid
                ? 'Eingabe sieht gültig aus.'
                : 'Noch nicht gültig — bitte Eingabe prüfen.'}
          </span>
        </label>

        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
          Ihre Ausweisnummer wird nur zur Prüfung verwendet und{' '}
          <strong>nicht gespeichert</strong>. Wir merken uns lediglich, dass die
          Prüfung erfolgt ist.
        </p>

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
          disabled={submitting || !clientValid}
          className="rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {submitting ? 'Bitte warten…' : 'Verifizierung absenden'}
        </button>
      </form>
    </main>
  );
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-neutral-600">{subtitle}</p>
      </header>
      {children}
    </main>
  );
}

function PrimaryButton({
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
      className="rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white"
    >
      {children}
    </button>
  );
}

const inputClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-base tracking-wide ' +
  'uppercase focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

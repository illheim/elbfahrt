'use client';

/**
 * Role picker — PLAN.md §2 step 3.
 *
 * The user has just confirmed their email (or signed up with email
 * confirmation off in dev) and needs to declare what they're here for.
 * v1 = single primary choice. A user can add the other role later from
 * a settings page (post-MVP).
 *
 * Driver path: writes roles = ["driver"] then routes to /verify-driver
 * for the Modulo-10 step (M3.d).
 * Passenger path: writes roles = ["passenger"] then routes to / which
 * will be the ride overview once M3.e ships.
 *
 * Requires: Strapi → Settings → Users & Permissions → Roles → Authenticated
 * → User → update = on. Without it, this PUT returns 403.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { updateProfile } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export default function RolePickerPage() {
  const { user, isLoading } = useRequireAuth();
  const { refresh } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState<'driver' | 'passenger' | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function pick(role: 'driver' | 'passenger') {
    if (!user) return;
    setError(null);
    setSubmitting(role);
    try {
      await updateProfile({ roles: [role] });
      await refresh();
      router.push(role === 'driver' ? '/verify-driver' : '/');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 403
            ? 'Berechtigungsfehler. Bitte die Strapi-Rolle "Authenticated" überprüfen (user → update).'
            : err.message
          : 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
      setError(msg);
      setSubmitting(null);
    }
  }

  if (isLoading || !user) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start gap-6 p-4 md:justify-center">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Hallo {user.first_name || user.username}!
        </h1>
        <p className="text-sm text-neutral-600">
          Wie möchten Sie elb-fahrt.de nutzen? Sie können später beides
          aktivieren.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <RoleCard
          title="Ich biete Mitfahrten an"
          description="Sie fahren regelmäßig oder gelegentlich und nehmen andere mit. Zusätzlicher Schritt: kurze Ausweis-Verifizierung."
          busy={submitting === 'driver'}
          disabled={submitting !== null}
          onClick={() => pick('driver')}
        />
        <RoleCard
          title="Ich suche Mitfahrten"
          description="Sie möchten als Mitfahrer:in Fahrten finden und buchen."
          busy={submitting === 'passenger'}
          disabled={submitting !== null}
          onClick={() => pick('passenger')}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          {error}
        </div>
      )}
    </main>
  );
}

function RoleCard({
  title,
  description,
  busy,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col gap-1 rounded-md border border-neutral-300 bg-white p-4 text-left transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-base font-medium text-neutral-900">
        {busy ? 'Bitte warten…' : title}
      </span>
      <span className="text-sm text-neutral-600">{description}</span>
    </button>
  );
}

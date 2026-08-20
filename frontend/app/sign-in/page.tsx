'use client';

/**
 * Sign-in form.
 *
 * Calls /api/auth/local via our auth context. On success the JWT lands
 * in localStorage and we route based on what the user still needs to do:
 *
 *   - No roles set yet   → /role-picker
 *   - Driver, not yet verified → /verify-driver
 *   - Otherwise          → / (will be the ride overview at M3.e)
 *
 * That routing logic also lives in /role-picker so a user landing there
 * via any path is funnelled to the right next step.
 */

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { ApiError } from '@/lib/api/client';
import { PasswordInput } from '@/components/PasswordInput';

export default function SignInPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await signIn(identifier, password);
      // Route by user state. /me may not include roles until refresh
      // settles, so we trust what came back from signIn here.
      if (!u.roles || u.roles.length === 0) {
        router.push('/role-picker');
      } else if (
        u.roles.includes('driver') &&
        u.driver_status !== 'approved'
      ) {
        router.push('/verify-driver');
      } else {
        router.push('/');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? 'E-Mail oder Passwort ist falsch.'
          : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <p className="text-sm text-neutral-600">
          Willkommen zurück bei elb-fahrt.de.
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-800">E-Mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-800">Passwort</span>
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {submitting ? 'Bitte warten…' : 'Anmelden'}
        </button>

        <p className="text-center text-sm text-neutral-600">
          Noch kein Konto?{' '}
          <Link href="/sign-up" className="text-accent-700 underline">
            Konto erstellen
          </Link>
        </p>
      </form>
    </main>
  );
}

const inputClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-base ' +
  'focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

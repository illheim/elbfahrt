'use client';

/**
 * Email-verification landing page.
 *
 * Strapi's "Redirection URL" (Settings → Users & Permissions → Advanced)
 * is set to http://localhost:3000/verify-email for dev. When a user
 * clicks the confirmation link in their email, Strapi:
 *   1. validates the token at /api/auth/email-confirmation
 *   2. marks the user as confirmed in the DB
 *   3. issues a 302 → the redirection URL
 *
 * So if we're here, the confirmation already happened server-side.
 * Our job is to:
 *   - tell the user it worked
 *   - send them on to the next step:
 *       - signed in + no roles → /role-picker
 *       - signed in + roles    → /
 *       - not signed in        → /sign-in
 *
 * In dev with email confirmation OFF, this page is mostly idle — a user
 * never lands here organically. Kept in place so M4 (real SMTP) doesn't
 * need to add a missing route.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

export default function VerifyEmailPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return; // let user click "sign in" link below
    if (!user) return;

    if (!user.roles || user.roles.length === 0) {
      router.replace('/role-picker');
    } else {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start gap-4 p-4 md:justify-center">
      <h1 className="text-2xl font-semibold">E-Mail bestätigt</h1>
      <p>
        Vielen Dank — Ihre E-Mail-Adresse ist jetzt bestätigt.
      </p>

      {isLoading && (
        <p className="text-sm text-neutral-600">
          Sie werden weitergeleitet…
        </p>
      )}

      {!isLoading && !isAuthenticated && (
        <p className="text-sm">
          Bitte{' '}
          <Link href="/sign-in" className="text-accent-700 underline">
            melden Sie sich an
          </Link>
          , um fortzufahren.
        </p>
      )}
    </main>
  );
}

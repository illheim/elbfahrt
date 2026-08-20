'use client';

/**
 * Logout button shown in the footer — only when a user is signed in. Kept out of
 * the top nav so that row stays short (Übersicht · Meine Fahrten · Profil).
 */

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

export function LogoutLink() {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const router = useRouter();

  if (isLoading || !isAuthenticated) return null;

  async function handleLogout() {
    await signOut();
    router.push('/sign-in');
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
    >
      Abmelden
    </button>
  );
}

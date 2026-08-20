'use client';

/**
 * Client-side auth gate for pages that require a signed-in user.
 *
 * Usage:
 *   const { user, isLoading } = useRequireAuth();
 *   if (isLoading || !user) return null;  // first paint while redirect kicks in
 *   // ... render protected UI ...
 *
 * Why client-side? Next.js middleware runs on the edge and can't read
 * localStorage, where our JWT lives. Doing the gate in React after mount
 * is the simplest path; the brief render-of-nothing on first paint is
 * acceptable for an MVP at this scale. PLAN.md M4 / hardening can revisit.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context';

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/sign-in');
    }
  }, [isLoading, user, router]);

  return { user, isLoading };
}

'use client';

/**
 * Auth context — wraps the app so any client component can `useAuth()`.
 *
 * Lifecycle:
 *   - On mount, if a JWT is in localStorage, call /api/users/me to populate
 *     `user`. If the call fails (expired token, server says no), clear and
 *     set user = null.
 *   - `signIn` / `signUp` calls go through ../api/auth.ts, which sets the
 *     JWT in storage. We refetch /me after a successful auth.
 *   - `signOut` clears storage and user state.
 *
 * Loading semantics:
 *   - `isLoading` is true until the initial /me round-trip finishes (or
 *     bails fast because there's no token). Use it to gate "redirect to
 *     login" logic in pages so first-paint doesn't flash the wrong route.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import * as authApi from '../api/auth';
import { getToken } from '../api/client';
import type { User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (identifier: string, password: string) => Promise<User>;
  signUp: (input: authApi.SignUpInput) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      // Token rejected or server unreachable — drop session.
      await authApi.signOut();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh]);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const u = await authApi.signIn(identifier, password);
      // /api/auth/local returns the user, but it doesn't populate custom
      // fields the same way /me does; refresh to get the full shape.
      await refresh();
      return u;
    },
    [refresh]
  );

  const signUp = useCallback(
    async (input: authApi.SignUpInput) => {
      const u = await authApi.signUp(input);
      // Email confirmation may be required before a JWT is issued — only
      // refresh if a token landed.
      if (getToken()) await refresh();
      return u;
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    signIn,
    signUp,
    signOut,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

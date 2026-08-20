/**
 * Auth-related API calls against Strapi's users-permissions plugin.
 *
 * Endpoints:
 *   POST /api/auth/local              — log in (identifier + password)
 *   POST /api/auth/local/register     — sign up; Strapi sends a confirmation email
 *   GET  /api/auth/email-confirmation — Strapi handles this internally when the
 *                                       user clicks the link; the frontend just
 *                                       lands on a confirmation result page
 *   POST /api/auth/send-email-confirmation — resend the confirmation email
 *   GET  /api/users/me                — current user (requires JWT)
 *   PUT  /api/users/:id               — update profile (requires JWT)
 */

import { api, setToken, clearToken } from './client';
import type {
  User,
  Gender,
  UserRole,
  DriverIdType,
} from './types';

export interface SignUpInput {
  username: string;
  email: string;
  password: string;

  first_name: string;
  last_name: string;
  date_of_birth: string;
  mobile: string;

  postal_code: string;
  city: string;
  street: string;
  house_number: string;

  gender?: Gender;

  parent_first_name?: string;
  parent_last_name?: string;
  parent_mobile?: string;
}

interface AuthResponse {
  jwt: string;
  user: User;
}

export async function signIn(
  identifier: string,
  password: string
): Promise<User> {
  const res = await api<AuthResponse>('/api/auth/local', {
    method: 'POST',
    body: { identifier, password },
  });
  setToken(res.jwt);
  return res.user;
}

export async function signUp(input: SignUpInput): Promise<User> {
  // Strapi returns a user but no JWT until the email is confirmed (when
  // the users-permissions plugin's email confirmation is on). We don't
  // setToken here; the user must click the link, then sign in.
  const res = await api<{ user: User; jwt?: string }>(
    '/api/auth/local/register',
    {
      method: 'POST',
      body: input,
    }
  );
  if (res.jwt) setToken(res.jwt);
  return res.user;
}

export async function signOut(): Promise<void> {
  clearToken();
}

export async function getMe(): Promise<User> {
  return api<User>('/api/users/me?populate=*');
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  await api('/api/auth/send-email-confirmation', {
    method: 'POST',
    body: { email },
  });
}

export interface UpdateProfileInput {
  roles?: UserRole[];
  driver_id_type?: DriverIdType;
  // Transient: validated server-side (Modulo-10) then discarded, never stored.
  driver_id_number?: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  gender?: Gender | null;
  is_smoker?: boolean;
  travels_with_pets?: boolean;
  prefer_same_gender?: boolean;
  postal_code?: string;
  city?: string;
  street?: string;
  house_number?: string;
}

/**
 * Updates the currently-signed-in user's profile via our custom
 * /api/me/profile endpoint. Stock /api/users/:id silently strips
 * custom fields like `roles`, so we sidestep it. Auth is by JWT —
 * the userId param is no longer needed.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  return api<User>('/api/me/profile', {
    method: 'PUT',
    body: input,
  });
}

/** Permanently delete the caller's own account and all their content. */
export async function deleteAccount(): Promise<void> {
  await api('/api/me/account', { method: 'DELETE' });
}

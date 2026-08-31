/**
 * Ride-request API. A RideRequest is a passenger's "I need a lift" post. The
 * backend controller forces passenger = me and sets status, so the client sends
 * only the trip fields. Shape mirrors CreateRideInput but with `seats_needed`
 * instead of `seats_total` and no driver.
 */

import { api } from './client';
import type {
  RideRequest,
  Recurrence,
  ListResponse,
  SingleResponse,
} from './types';

export interface CreateRideRequestInput {
  origin_address: string;
  destination_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  flexible_origin: boolean;
  flexible_destination: boolean;
  origin_radius_m?: number;
  destination_radius_m?: number;
  time_window_min?: number;
  route_duration_s?: number | null;
  notify_on_match?: boolean;
  departure_at: string; // ISO
  return_at?: string | null;
  recurrence: Recurrence;
  recurrence_weekdays?: number[] | null;
  recurrence_until?: string | null;
  seats_needed: number;
  notes?: string | null;
}

export async function createRideRequest(
  input: CreateRideRequestInput
): Promise<RideRequest> {
  const res = await api<SingleResponse<RideRequest>>('/api/ride-requests', {
    method: 'POST',
    body: { data: input },
  });
  return res.data;
}

/**
 * Toggle match-notifications on the caller's own Gesuch. The controller's
 * ownership guard rejects edits to anyone else's request.
 */
export async function setRequestNotify(
  documentId: string,
  notify_on_match: boolean
): Promise<void> {
  await api(`/api/ride-requests/${documentId}`, {
    method: 'PUT',
    body: { data: { notify_on_match } },
  });
}

/**
 * The ride-request controller returns only PII-safe passenger fields (like the
 * ride controller's driver), so we type the passenger narrowly.
 */
export interface RequestPassenger {
  id: number;
  documentId?: string;
  first_name: string;
}

export type RideRequestListItem = Omit<RideRequest, 'passenger'> & {
  passenger: RequestPassenger | null;
};

/** Active ride requests (Gesuche) in the region, soonest first. */
export async function listActiveRideRequests(): Promise<RideRequestListItem[]> {
  const query =
    'filters[status][$eq]=active&sort=departure_at:asc&pagination[pageSize]=100';
  const res = await api<ListResponse<RideRequestListItem>>(
    `/api/ride-requests?${query}`
  );
  return res.data ?? [];
}

/**
 * A Gesuch's contact details. The backend only attaches this to the single-item
 * read (findOne) and only for approved drivers; everyone else gets `null`.
 * `is_guardian` is a rollback hook: false = the requester's own contact (current
 * policy, incl. teens), true = a guardian's contact for an under-18 requester.
 */
export interface GesuchContact {
  name: string;
  phone: string | null;
  is_guardian: boolean;
}

/** Fetch a Gesuch's contact. Returns null if the caller isn't an approved driver. */
export async function getRideRequestContact(
  documentId: string
): Promise<GesuchContact | null> {
  const res = await api<SingleResponse<RideRequestListItem & { contact?: GesuchContact }>>(
    `/api/ride-requests/${documentId}`
  );
  return res.data?.contact ?? null;
}

/**
 * A ride that matches one of the caller's own Gesuche, as ranked by the backend
 * (`GET /me/requests/:id/matches`). PII-safe: the driver is reduced to a first
 * name. `tier` is "full" (all criteria met) or "partial" (a near-miss on space
 * or time); `penalty` sorts within a tier (lower = closer fit).
 */
export interface GesuchMatch {
  documentId: string;
  origin_address: string;
  destination_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  departure_at: string;
  recurrence: Recurrence;
  recurrence_weekdays: number[] | null;
  seats_total: number;
  driver: { first_name: string } | null;
  tier: 'full' | 'partial';
  penalty: number;
}

/** Ranked rides that fit the caller's own Gesuch. Ownership is enforced server-side. */
export async function getGesuchMatches(
  documentId: string
): Promise<GesuchMatch[]> {
  const res = await api<{ data: GesuchMatch[] }>(
    `/api/me/requests/${documentId}/matches`
  );
  return res.data ?? [];
}

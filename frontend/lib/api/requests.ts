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

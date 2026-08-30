/**
 * Ride list API.
 *
 * The backend ride controller REPLACES the client's populate with a fixed,
 * PII-safe driver projection (see backend safe-user.ts / PLAN Appendix B), so
 * the `driver` we get back is only { first_name } (+ id/documentId) — never
 * contact details. We type that narrowly here instead of reusing the full
 * `User`.
 *
 * We still send `filters`, `sort` and `pagination`; the controller preserves
 * those and only overrides `populate`.
 */

import { api } from './client';
import type {
  Ride,
  Recurrence,
  ListResponse,
  SingleResponse,
} from './types';

export interface PublicDriver {
  id: number;
  documentId?: string;
  first_name: string;
}

export type RideListItem = Omit<Ride, 'driver'> & {
  driver: PublicDriver | null;
};

/**
 * Active rides in the region, soonest departure first. Filtering by
 * from/to/date/time/seats happens client-side on the overview page — cheap at
 * this scale and avoids hand-building Strapi filter queries for fuzzy text.
 */
export async function listActiveRides(): Promise<RideListItem[]> {
  const query =
    'filters[status][$eq]=active&sort=departure_at:asc&pagination[pageSize]=100';
  const res = await api<ListResponse<RideListItem>>(`/api/rides?${query}`);
  return res.data ?? [];
}

/** Single ride by documentId. Throws ApiError (404 if not found). */
export async function getRide(documentId: string): Promise<RideListItem> {
  const res = await api<SingleResponse<RideListItem>>(`/api/rides/${documentId}`);
  return res.data;
}

/**
 * Fields the composer sends. The backend controller forces `driver = me` and
 * requires an approved driver, sets `status`, and precomputes route distance —
 * so we deliberately DON'T send driver/status/route_*.
 */
export interface CreateRideInput {
  origin_address: string;
  destination_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  waypoints?: { address: string; lat: number; lng: number }[];
  flexible_origin: boolean;
  flexible_destination: boolean;
  departure_at: string; // ISO
  return_at?: string | null;
  recurrence: Recurrence;
  recurrence_weekdays?: number[] | null; // 1=Mon … 7=Sun
  recurrence_until?: string | null; // YYYY-MM-DD
  seats_total: number;
  notes?: string | null;
  route_duration_s?: number | null; // OSRM duration through waypoints (matching)
}

export async function createRide(input: CreateRideInput): Promise<Ride> {
  const res = await api<SingleResponse<Ride>>('/api/rides', {
    method: 'POST',
    body: { data: input },
  });
  return res.data;
}

/** Cancel a ride you offer. The backend also cancels its bookings. */
export async function cancelRide(documentId: string): Promise<void> {
  await api(`/api/rides/${documentId}`, {
    method: 'PUT',
    body: { data: { status: 'cancelled' } },
  });
}

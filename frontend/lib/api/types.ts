/**
 * TypeScript types matching the Strapi 5 content types defined in
 * backend/src/api/* and backend/src/extensions/users-permissions/.
 *
 * Strapi 5 returns entities flat (no v4 `attributes` wrapper). List
 * endpoints wrap in `{ data: [...], meta: {...} }`; single-entity
 * endpoints wrap in `{ data: {...}, meta: {...} }`. /api/users/me and
 * /api/auth/local skip the wrapper entirely.
 */

export type UserRole = 'driver' | 'passenger';

export type DriverStatus = 'pending_review' | 'approved' | 'rejected';

export type DriverIdType = 'personalausweis' | 'fuehrerschein';

export type Recurrence = 'none' | 'weekly' | 'daily';

export type RideStatus = 'active' | 'cancelled' | 'completed';

export type RideRequestStatus = 'active' | 'fulfilled' | 'cancelled';

export type BookingStatus =
  | 'confirmed'
  | 'cancelled_by_passenger'
  | 'cancelled_by_driver';

export interface User {
  id: number;
  documentId?: string;
  username: string;
  email: string;
  confirmed: boolean;
  blocked: boolean;

  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  mobile: string;

  postal_code: string;
  city: string;
  street: string;
  house_number: string;

  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_mobile: string | null;

  roles: UserRole[];

  driver_status: DriverStatus | null;
  driver_id_type: DriverIdType | null;
  driver_verified_at: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface Ride {
  id: number;
  documentId: string;

  driver: User | { id: number };

  origin_address: string;
  destination_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;

  flexible_origin: boolean;
  flexible_destination: boolean;

  departure_at: string;
  return_at: string | null;

  recurrence: Recurrence;
  recurrence_weekdays: number[] | null; // 1=Mon ... 7=Sun
  recurrence_until: string | null;

  seats_total: number;
  notes: string | null;
  status: RideStatus;

  route_distance_m: number | null;
  route_duration_s: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface RideRequest {
  id: number;
  documentId: string;

  passenger: User | { id: number };

  origin_address: string;
  destination_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;

  flexible_origin: boolean;
  flexible_destination: boolean;

  departure_at: string;
  return_at: string | null;

  recurrence: Recurrence;
  recurrence_weekdays: number[] | null;
  recurrence_until: string | null;

  seats_needed: number;
  notes: string | null;
  status: RideRequestStatus;

  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: number;
  documentId: string;

  ride: Ride | { id: number };
  passenger: User | { id: number };

  booked_at: string;
  status: BookingStatus;
  instance_date: string | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * Strapi 5 list-response envelope.
 */
export interface ListResponse<T> {
  data: T[];
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

/**
 * Strapi 5 single-entity envelope.
 */
export interface SingleResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

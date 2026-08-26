/**
 * Booking API. The backend controller forces passenger = me, sets booked_at
 * and status, and enforces seat availability — so the client sends only the
 * ride and (for recurring rides) the instance_date.
 */

import { api } from './client';
import type {
  Booking,
  BookingStatus,
  Recurrence,
  SingleResponse,
} from './types';

export interface CreateBookingInput {
  ride: string; // ride documentId
  instance_date?: string | null; // YYYY-MM-DD, required for recurring rides
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const res = await api<SingleResponse<Booking>>('/api/bookings', {
    method: 'POST',
    body: { data: input },
  });
  return res.data;
}

/** Cancel one's own booking. The backend forces the cancel status by role. */
export async function cancelBooking(documentId: string): Promise<void> {
  await api(`/api/bookings/${documentId}`, {
    method: 'PUT',
    body: { data: { status: 'cancelled_by_passenger' } },
  });
}

// ── /me/bookings ─────────────────────────────────────────────────────────────
// Contact (mobile) is present only for confirmed bookings — the backend strips
// it otherwise (see CONTACT_USER_FIELDS / isContactVisible).

export interface Contact {
  first_name: string;
  last_name?: string;
  mobile?: string;
}

export interface MyBookingRide {
  documentId: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  recurrence: Recurrence;
  recurrence_weekdays: number[] | null;
  driver?: Contact | null;
}

export interface MyPassengerBooking {
  id: number;
  documentId: string;
  status: BookingStatus;
  instance_date: string | null;
  ride: MyBookingRide | null;
}

export interface MyDriverBooking {
  id: number;
  documentId: string;
  status: BookingStatus;
  instance_date: string | null;
  ride: MyBookingRide | null;
  passenger: Contact | null;
}

/** The caller's own open Gesuch (ride request), shown in the passenger tab. */
export interface MyRideRequest {
  id: number;
  documentId: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  recurrence: Recurrence;
  notify_on_match: boolean;
}

/** A ride the caller offers, shown greyed in the driver tab. */
export interface MyOfferedRide {
  id: number;
  documentId: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  recurrence: Recurrence;
  recurrence_weekdays: number[] | null;
  seats_total: number;
}

export interface MyBookings {
  as_passenger: MyPassengerBooking[];
  as_driver: MyDriverBooking[];
  as_requester: MyRideRequest[];
  offered_rides: MyOfferedRide[];
}

/** The caller's trips from both sides. /me/bookings returns the object directly. */
export async function getMyBookings(): Promise<MyBookings> {
  return api<MyBookings>('/api/me/bookings');
}

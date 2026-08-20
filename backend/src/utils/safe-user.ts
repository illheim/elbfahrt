/**
 * Fields of a User that are safe to expose through a populated relation on a
 * browse surface (a ride listing, a ride-request listing, a booking).
 *
 * A Ride's `driver`, a RideRequest's `passenger`, and a Booking's
 * `ride.driver` / `passenger` are ordinary (non-private) relations, so
 * without this allowlist a caller could pull the full user row —
 * mobile, email, street address, date of birth, parent contacts — via
 * `?populate=*`. Only password and the auth tokens carry `private: true`
 * in the schema; everything else would leak.
 *
 * Policy: on public browse surfaces we show just enough to display and match
 * an offer — given name plus the match-relevant preference flags. Full
 * contact details (mobile) are delivered only after a booking is confirmed,
 * via the confirmation email / a dedicated "my bookings" endpoint — never
 * through the open list endpoints.
 *
 * `id` and `documentId` are always returned by Strapi regardless of this list.
 * Widen this deliberately (e.g. add `last_name`) if the Verein decides fuller
 * names should be visible before booking — it's the single source of truth.
 */
export const SAFE_USER_FIELDS = ['first_name'] as const;

/**
 * The second, wider tier: contact details shared ONLY through the
 * post-confirmation channel (`GET /me/bookings`) once a booking is confirmed —
 * this is where a rider and driver exchange phone numbers to coordinate. Never
 * exposed on browse surfaces. Kept deliberately minimal (name + phone); we do
 * not surface email or address.
 */
export const CONTACT_USER_FIELDS = ['first_name', 'last_name', 'mobile'] as const;

/**
 * Booking notification emails (batch 2, beta Lfd 16): a booking is a real
 * commitment between two people, so both sides hear about it by email.
 *
 *   confirmation           → passenger, on booking
 *   new_booking            → driver,    on booking
 *   cancelled_by_passenger → driver,    when the passenger cancels
 *   cancelled_by_driver    → passenger, when the driver cancels that booking
 *   ride_cancelled         → passenger, when the driver cancels the whole ride
 *
 * Pure: builds subject/text/html from plain values, no Strapi, so the wording
 * is unit-tested. Sending and loading live in booking-notify.ts.
 *
 * Contact: the confirmation and new-booking mails carry the other party's name
 * and mobile — the same post-confirmation channel /me/bookings uses (see
 * CONTACT_USER_FIELDS). Cancellation mails carry the name only.
 */

export type BookingEmailKind =
  | 'confirmation'
  | 'new_booking'
  | 'cancelled_by_passenger'
  | 'cancelled_by_driver'
  | 'ride_cancelled';

export interface EmailParty {
  first_name?: string | null;
  last_name?: string | null;
  mobile?: string | null;
}

export interface EmailRide {
  documentId: string;
  origin_address: string;
  destination_address: string;
  departure_at: string; // ISO; for recurring rides only the clock time counts
}

export interface BookingEmailInput {
  kind: BookingEmailKind;
  recipient: EmailParty;
  other: EmailParty | null; // the other side of the booking
  ride: EmailRide;
  instanceDate: string | null; // YYYY-MM-DD for recurring rides
  frontendUrl: string;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

const TZ = 'Europe/Berlin';

/** "Mittwoch, 7. Oktober 2026 um 08:00 Uhr" — instance date wins for recurring rides. */
export function fmtRideWhen(departureAt: string, instanceDate: string | null): string {
  const time = new Date(departureAt).toLocaleTimeString('de-DE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = instanceDate
    ? new Date(`${instanceDate}T12:00:00Z`).toLocaleDateString('de-DE', {
        timeZone: 'UTC',
        dateStyle: 'full',
      })
    : new Date(departureAt).toLocaleDateString('de-DE', {
        timeZone: TZ,
        dateStyle: 'full',
      });
  return `${day} um ${time} Uhr`;
}

function fullName(p: EmailParty | null): string {
  if (!p) return 'Ihr:e Mitfahrpartner:in';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Ihr:e Mitfahrpartner:in';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Parts {
  subject: string;
  intro: string; // one sentence before the trip block
  contactLabel?: string; // "Fahrer:in" / "Mitfahrer:in" — shows name + phone
  outro: string;
}

function parts(i: BookingEmailInput): Parts {
  const other = fullName(i.other);
  switch (i.kind) {
    case 'confirmation':
      return {
        subject: 'Ihre Mitfahrt ist gebucht',
        intro: 'Sie haben einen Platz auf dieser Fahrt gebucht:',
        contactLabel: 'Fahrer:in',
        outro: 'Bitte stimmen Sie Treffpunkt und Einzelheiten direkt mit der Fahrer:in ab.',
      };
    case 'new_booking':
      return {
        subject: 'Neue Buchung für Ihre Fahrt',
        intro: `${other} hat einen Platz auf Ihrer Fahrt gebucht:`,
        contactLabel: 'Mitfahrer:in',
        outro: 'Bitte stimmen Sie Treffpunkt und Einzelheiten direkt mit der Mitfahrer:in ab.',
      };
    case 'cancelled_by_passenger':
      return {
        subject: 'Buchung storniert',
        intro: `${other} hat die Buchung für diese Fahrt storniert:`,
        outro: 'Der Platz ist wieder frei und kann neu gebucht werden.',
      };
    case 'cancelled_by_driver':
      return {
        subject: 'Ihre Mitfahrt wurde storniert',
        intro: `Die Fahrer:in ${other} hat Ihre Buchung für diese Fahrt storniert:`,
        outro: 'Unter „Meine Fahrten“ und in der Übersicht finden Sie andere Fahrten.',
      };
    case 'ride_cancelled':
      return {
        subject: 'Ihre Mitfahrt wurde abgesagt',
        intro: `Die Fahrer:in ${other} hat diese Fahrt abgesagt. Ihre Buchung ist damit storniert:`,
        outro: 'Unter „Meine Fahrten“ und in der Übersicht finden Sie andere Fahrten.',
      };
  }
}

export function buildBookingEmail(i: BookingEmailInput): BuiltEmail {
  const p = parts(i);
  const base = i.frontendUrl.replace(/\/$/, '');
  const link = `${base}/meine-fahrten`;
  const hello = i.recipient.first_name ? `Hallo ${i.recipient.first_name},` : 'Hallo,';
  const route = `${i.ride.origin_address} → ${i.ride.destination_address}`;
  const when = fmtRideWhen(i.ride.departure_at, i.instanceDate);
  const contact =
    p.contactLabel && i.other
      ? `${p.contactLabel}: ${fullName(i.other)}${i.other.mobile ? ` · ${i.other.mobile}` : ''}`
      : null;
  const footer = 'Diese E-Mail wurde automatisch von elb-fahrt.de versendet.';

  const text =
    `${hello}\n\n${p.intro}\n\n${route}\nAbfahrt: ${when}\n` +
    (contact ? `${contact}\n` : '') +
    `\n${p.outro}\n\nIhre Fahrten im Überblick:\n${link}\n\n${footer}`;

  const html =
    `<p>${esc(hello)}</p>` +
    `<p>${esc(p.intro)}</p>` +
    `<p><strong>${esc(route)}</strong><br>Abfahrt: ${esc(when)}` +
    (contact ? `<br>${esc(contact)}` : '') +
    `</p>` +
    `<p>${esc(p.outro)}</p>` +
    `<p><a href="${esc(link)}">Ihre Fahrten im Überblick</a></p>` +
    `<p style="color:#666;font-size:13px">${esc(footer)}</p>`;

  return { subject: p.subject, text, html };
}

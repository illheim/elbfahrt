import { describe, it, expect } from 'vitest';
import { buildBookingEmail, fmtRideWhen, type BookingEmailInput } from './booking-emails';

const base: BookingEmailInput = {
  kind: 'confirmation',
  recipient: { first_name: 'Viola', last_name: 'V.', mobile: '0170 1' },
  other: { first_name: 'Gordon', last_name: 'G.', mobile: '0170 2' },
  ride: {
    documentId: 'r1',
    origin_address: 'Howisch 4, Mover',
    destination_address: 'Roddauweg 17, Rottorf',
    departure_at: '2026-10-21T14:00:00Z', // 16:00 CEST
  },
  instanceDate: null,
  frontendUrl: 'https://elb-fahrt.de/',
};
const mail = (o: Partial<BookingEmailInput>) => buildBookingEmail({ ...base, ...o });

describe('fmtRideWhen', () => {
  it('formats a one-off ride in Berlin time', () => {
    expect(fmtRideWhen('2026-10-21T14:00:00Z', null)).toBe('Mittwoch, 21. Oktober 2026 um 16:00 Uhr');
  });
  it('uses the booked day for a recurring ride, with the series clock time', () => {
    // series started in summer time; the booked day is in winter — still 16:00
    expect(fmtRideWhen('2026-10-21T14:00:00Z', '2026-11-04')).toBe(
      'Mittwoch, 4. November 2026 um 16:00 Uhr'
    );
  });
});

describe('buildBookingEmail', () => {
  it('confirmation → passenger gets driver name + phone and the link', () => {
    const m = mail({});
    expect(m.subject).toBe('Ihre Mitfahrt ist gebucht');
    expect(m.text).toContain('Hallo Viola,');
    expect(m.text).toContain('Howisch 4, Mover → Roddauweg 17, Rottorf');
    expect(m.text).toContain('Fahrer:in: Gordon G. · 0170 2');
    expect(m.text).toContain('https://elb-fahrt.de/meine-fahrten');
  });

  it('new booking → driver gets the passenger as contact', () => {
    const m = mail({ kind: 'new_booking', recipient: base.other!, other: base.recipient });
    expect(m.subject).toBe('Neue Buchung für Ihre Fahrt');
    expect(m.text).toContain('Viola V. hat einen Platz auf Ihrer Fahrt gebucht');
    expect(m.text).toContain('Mitfahrer:in: Viola V. · 0170 1');
  });

  it('cancellation mails carry no phone number', () => {
    for (const kind of ['cancelled_by_passenger', 'cancelled_by_driver', 'ride_cancelled'] as const) {
      const m = mail({ kind });
      expect(m.text).not.toContain('0170');
      expect(m.html).not.toContain('0170');
    }
    expect(mail({ kind: 'ride_cancelled' }).text).toContain('hat diese Fahrt abgesagt');
  });

  it('escapes user-entered text in the HTML part', () => {
    const m = mail({
      ride: { ...base.ride, origin_address: '<script>x</script>' },
    });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });
});

import { describe, it, expect } from 'vitest';
import { cappedRecurrenceUntil } from './recurrence';

describe('cappedRecurrenceUntil', () => {
  it('leaves one-off rides without an end date', () => {
    expect(cappedRecurrenceUntil('none', '2026-09-15T06:00:00Z', null)).toBeNull();
  });

  it('keeps an end date the user already set', () => {
    expect(
      cappedRecurrenceUntil('weekly', '2026-09-15T06:00:00Z', '2026-12-31')
    ).toBe('2026-12-31');
  });

  it('caps an open-ended weekly series at departure + 3 months', () => {
    expect(cappedRecurrenceUntil('weekly', '2026-09-15T06:00:00Z', null)).toBe(
      '2026-12-15'
    );
  });

  it('caps an open-ended daily series too', () => {
    // Jan 31 + 3 months: April has 30 days, so JS rolls the day to May 1.
    // A day of slop is immaterial for a coarse cap.
    expect(cappedRecurrenceUntil('daily', '2026-01-31T06:00:00Z', undefined)).toBe(
      '2026-05-01'
    );
  });

  it('respects a custom cap length', () => {
    expect(
      cappedRecurrenceUntil('daily', '2026-09-15T06:00:00Z', null, 1)
    ).toBe('2026-10-15');
  });

  it('returns null for an unparseable departure', () => {
    expect(cappedRecurrenceUntil('weekly', 'not-a-date', null)).toBeNull();
  });
});

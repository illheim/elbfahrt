/**
 * Recurrence helpers shared by the ride and ride-request write paths.
 */

export const DEFAULT_CAP_MONTHS = 3;

/**
 * Cap an open-ended recurring series. When a weekly/daily ride or Gesuch is
 * created without an end date, we bound it at departure + N months so nothing
 * recurs indefinitely and quietly clutters the lists (beta feedback N5). A
 * one-off ride, or one the user already gave an end date, is returned
 * unchanged.
 *
 * Returns a YYYY-MM-DD date string (the schema field is a `date`), or null.
 */
export function cappedRecurrenceUntil(
  recurrence: string | undefined,
  departureAt: string | undefined,
  recurrenceUntil: string | null | undefined,
  months: number = DEFAULT_CAP_MONTHS
): string | null {
  if (!recurrence || recurrence === 'none') return recurrenceUntil ?? null;
  if (recurrenceUntil) return recurrenceUntil.slice(0, 10); // user set one — keep it
  if (!departureAt) return null;

  const d = new Date(departureAt);
  if (Number.isNaN(d.getTime())) return null;
  // UTC throughout so the result doesn't depend on the server's timezone.
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

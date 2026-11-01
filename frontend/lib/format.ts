/**
 * Shared display formatting for rides and Gesuche — schedule, date range and
 * flexibility labels — so the overview, the ride page and Meine Fahrten all
 * describe a trip the same way (beta test Lfd 12–15).
 */

const WEEKDAY_ABBR = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']; // 1=Mon … 7=Sun

/** "Mi., 07.10." */
export function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}

/** "08:00" */
export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "Mi., 07.10. · 08:00 Uhr" */
export function fmtWhen(iso: string): string {
  return `${fmtDay(iso)} · ${fmtTime(iso)} Uhr`;
}

/** A calendar date (YYYY-MM-DD, no time zone) as "Mi., 07.10.2026". */
export function fmtYmd(ymd: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${ymd}T00:00:00`));
}

/** A calendar date + the trip's clock time: "Mi., 07.10.2026 · 08:00 Uhr". */
export function fmtYmdAt(ymd: string, timeIso: string): string {
  return `${fmtYmd(ymd)} · ${fmtTime(timeIso)} Uhr`;
}

export interface Schedule {
  departure_at: string;
  recurrence: string;
  recurrence_weekdays?: number[] | null;
  recurrence_until?: string | null;
}

export function isRecurring(s: { recurrence: string }): boolean {
  return s.recurrence === 'daily' || s.recurrence === 'weekly';
}

/** "täglich" / "wöchentlich · Mo, Mi" / null for a one-off trip. */
export function recurrenceLabel(s: Schedule, withWeekdays = true): string | null {
  if (s.recurrence === 'daily') return 'täglich';
  if (s.recurrence === 'weekly') {
    const days = withWeekdays ? weekdayList(s) : null;
    return days ? `wöchentlich · ${days}` : 'wöchentlich';
  }
  return null;
}

/** "Mo, Mi, Fr" for a weekly trip, else null. */
export function weekdayList(s: Schedule): string | null {
  if (s.recurrence !== 'weekly') return null;
  const days = (s.recurrence_weekdays ?? [])
    .map((d) => WEEKDAY_ABBR[d])
    .filter(Boolean)
    .join(', ');
  return days || null;
}

const dmy = (d: Date) =>
  new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
const dm = (d: Date) =>
  new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(d);

/**
 * The date range a recurring trip runs: "19.10.–23.10.2026", or
 * "ab 19.10.2026" when open-ended. Null for one-off trips.
 */
export function periodLabel(s: Schedule): string | null {
  if (!isRecurring(s)) return null;
  const start = new Date(s.departure_at);
  if (!s.recurrence_until) return `ab ${dmy(start)}`;
  const end = new Date(`${s.recurrence_until}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${sameYear ? dm(start) : dmy(start)}–${dmy(end)}`;
}

/**
 * One line describing when a trip runs.
 *   one-off:   "Mi., 07.10. · 08:00 Uhr"
 *   recurring: "täglich · 19.10.–23.10.2026 · 15:00 Uhr"
 */
export function scheduleLabel(s: Schedule, withWeekdays = false): string {
  const recur = recurrenceLabel(s, withWeekdays);
  if (!recur) return fmtWhen(s.departure_at);
  return `${recur} · ${periodLabel(s)} · ${fmtTime(s.departure_at)} Uhr`;
}

/**
 * Time flexibility, always shown — also at 0 (Lfd 12–15). `fallback` mirrors
 * the matcher's default for legacy rows with no value (ride 0, Gesuch 30).
 */
export function timeFlexLabel(min: number | null | undefined, fallback: number): string {
  return `± ${min ?? fallback} min`;
}

const km = (m: number) =>
  `${(m / 1000).toFixed(1).replace('.', ',').replace(/,0$/, '')} km`;

/**
 * Spatial flexibility: "± 1 km" when start and end match, else
 * "Start ± 0,5 km · Ziel ± 1 km" (or just the flexible end). Null when both
 * are exact. Falls back to the
 * legacy ±1 km boolean for rows without an explicit radius.
 */
export function radiusLabel(r: {
  flexible_origin?: boolean;
  flexible_destination?: boolean;
  origin_radius_m?: number | null;
  destination_radius_m?: number | null;
}): string | null {
  const o = r.origin_radius_m ?? (r.flexible_origin ? 1000 : 0);
  const d = r.destination_radius_m ?? (r.flexible_destination ? 1000 : 0);
  if (o <= 0 && d <= 0) return null;
  if (o === d) return `± ${km(o)}`;
  if (d <= 0) return `Start ± ${km(o)}`;
  if (o <= 0) return `Ziel ± ${km(d)}`;
  return `Start ± ${km(o)} · Ziel ± ${km(d)}`;
}

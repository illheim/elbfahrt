/**
 * The always-visible, clickable summary row of an accordion card: a short
 * origin → destination (first address segment only) plus `when`, an optional
 * badge, and a chevron. Tapping toggles the caller's expanded detail below.
 *
 * `when` is passed in already formatted so this stays independent of each
 * page's date helpers. Shared by the overview and Meine Fahrten.
 */

export function CardSummary({
  origin,
  destination,
  when,
  open,
  onToggle,
  badge,
}: {
  origin: string;
  destination: string;
  when: string;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 p-4 text-left transition hover:bg-neutral-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-neutral-900">
          {shortAddr(origin)} <span className="text-neutral-400">→</span>{' '}
          {shortAddr(destination)}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-600">{when}</span>
      </span>
      {badge}
      <Chevron open={open} />
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-neutral-400 transition-transform ${
        open ? 'rotate-180' : ''
      }`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** First segment of a Nominatim display name, e.g. "An der Ilmenau, …" → "An der Ilmenau". */
export function shortAddr(a: string): string {
  return a.split(',')[0].trim();
}

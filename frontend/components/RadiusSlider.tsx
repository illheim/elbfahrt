'use client';

/**
 * Slider for a pickup/drop-off flexibility radius in metres (0 = exact).
 * Shared by the Gesuch composer (/requests/new) and the ride composer
 * (/rides/new) so both offer the identical spatial-flexibility control.
 */
export function RadiusSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (m: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-sm text-neutral-700">
        <span>{label}</span>
        <strong className="font-medium text-neutral-900">{fmtRadius(value)}</strong>
      </span>
      <input
        type="range"
        min={0}
        max={10000}
        step={500}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neutral-900"
        aria-label={label}
      />
    </label>
  );
}

/** Radius label: 0 → "genau hier", else "± X,X km". */
export function fmtRadius(m: number): string {
  if (m <= 0) return 'genau hier';
  return `± ${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

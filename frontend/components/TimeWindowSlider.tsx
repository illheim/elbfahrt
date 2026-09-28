'use client';

/**
 * Slider for the temporal flexibility (± minutes) around a departure time.
 * Shared by the Gesuch composer (/requests/new) and the ride composer
 * (/rides/new) so both offer the identical time-flexibility control.
 */
export function TimeWindowSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (min: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-sm text-neutral-700">
        <span>{label}</span>
        <strong className="font-medium text-neutral-900">± {value} min</strong>
      </span>
      <input
        type="range"
        min={0}
        max={120}
        step={15}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neutral-900"
        aria-label="Zeitfenster in Minuten"
      />
    </label>
  );
}

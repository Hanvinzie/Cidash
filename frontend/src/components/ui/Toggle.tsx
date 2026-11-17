interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Saklar on/off dengan label — satu baris, area sentuh penuh. */
export default function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label className={`flex min-h-12 items-center justify-between gap-4 text-sm ${disabled ? 'opacity-60' : ''}`}>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-xs text-subtle">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-cidash-primary peer-checked:after:translate-x-5"
      />
    </label>
  );
}

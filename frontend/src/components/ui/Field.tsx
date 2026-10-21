import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const controlClass =
  'w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-base text-ink sm:text-sm placeholder:text-subtle outline-none transition focus:border-cidash-primary focus:bg-surface disabled:opacity-60';

const labelClass = 'mb-1.5 block text-xs font-semibold text-muted';

interface FieldProps {
  label?: string;
  hint?: ReactNode;
}

/** Labeled input. Label is linked via id (accessibility). */
export function Input({ label, hint, className = '', id, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className={labelClass}>
          {label}
        </label>
      )}
      <input id={inputId} className={`${controlClass} ${className}`} {...rest} />
      {hint && <div className="mt-1.5 text-[11px] text-subtle">{hint}</div>}
    </div>
  );
}

/** Labeled select. */
export function Select({
  label,
  hint,
  className = '',
  id,
  children,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div>
      {label && (
        <label htmlFor={selectId} className={labelClass}>
          {label}
        </label>
      )}
      <select id={selectId} className={`${controlClass} ${className}`} {...rest}>
        {children}
      </select>
      {hint && <div className="mt-1.5 text-[11px] text-subtle">{hint}</div>}
    </div>
  );
}

/** Segmented control (tabs / toggle). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex rounded-xl bg-inset p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition active:scale-[0.97] ${
            value === o.value ? 'bg-surface text-cidash-primary shadow-sm' : 'text-subtle hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

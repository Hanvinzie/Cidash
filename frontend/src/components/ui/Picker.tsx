import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';
import Modal from './Modal';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Elemen di kiri (avatar / ikon). */
  leading?: ReactNode;
  /** Judul kelompok; opsi dengan group sama ditampilkan berurutan di bawah judulnya. */
  group?: string;
}

interface PickerProps<T extends string> {
  value: T;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  /** Label field di atas tombol (juga judul sheet bila `sheetTitle` kosong). */
  label?: string;
  sheetTitle?: string;
  disabled?: boolean;
  /** 'field' = seperti input form; 'title' = teks besar tanpa kotak (mis. pemilih circle). */
  variant?: 'field' | 'title';
}

/**
 * Pengganti <select> bawaan browser: tombol yang membuka bottom sheet berisi daftar opsi
 * bergaya Cidash. Mendukung grup, deskripsi, dan elemen leading (avatar/ikon).
 */
export default function Picker<T extends string>({
  value,
  options,
  onChange,
  label,
  sheetTitle,
  disabled = false,
  variant = 'field',
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  // Kelompokkan sesuai urutan kemunculan.
  const groups: { name?: string; items: PickerOption<T>[] }[] = [];
  options.forEach((o) => {
    const last = groups[groups.length - 1];
    if (last && last.name === o.group) last.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  });

  const trigger =
    variant === 'title' ? (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-labelledby={label ? labelId : undefined}
        className="flex max-w-full items-center gap-1 text-left text-lg font-bold transition active:opacity-70 disabled:opacity-60"
      >
        <span className="truncate">{selected?.label}</span>
        <Icon name="chevronRight" size={16} className="shrink-0 rotate-90 text-subtle" />
      </button>
    ) : (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-labelledby={label ? labelId : undefined}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-inset px-3 py-2 text-left transition active:scale-[0.99] disabled:opacity-60"
      >
        {selected?.leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium sm:text-sm">{selected?.label}</span>
          {selected?.description && <span className="block truncate text-xs text-subtle">{selected.description}</span>}
        </span>
        <Icon name="chevronRight" size={16} className="shrink-0 rotate-90 text-subtle" />
      </button>
    );

  return (
    <div className="min-w-0">
      {label && (
        <span id={labelId} className={variant === 'title' ? 'sr-only' : 'mb-1.5 block text-xs font-semibold text-muted'}>
          {label}
        </span>
      )}
      {trigger}

      {open && (
        <Modal title={sheetTitle ?? label ?? 'Choose'} onClose={() => setOpen(false)}>
          {(close) => (
            <div role="listbox" aria-label={sheetTitle ?? label} className="-mx-2 space-y-4">
              {groups.map((g, gi) => (
                <div key={g.name ?? gi}>
                  {g.name && (
                    <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-subtle">{g.name}</p>
                  )}
                  <ul>
                    {g.items.map((o) => {
                      const active = o.value === value;
                      return (
                        <li key={o.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              onChange(o.value);
                              close();
                            }}
                            className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] active:bg-inset ${
                              active ? 'bg-cidash-primary/5' : ''
                            }`}
                          >
                            {o.leading}
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate font-semibold ${active ? 'text-cidash-primary' : ''}`}>
                                {o.label}
                              </span>
                              {o.description && <span className="block truncate text-xs text-subtle">{o.description}</span>}
                            </span>
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                active ? 'bg-cidash-primary text-cidash-on-primary' : 'border-2 border-line'
                              }`}
                              aria-hidden
                            >
                              {active && <Icon name="check" size={14} strokeWidth={3} />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Avatar huruf awal — leading standar untuk opsi user/circle. */
export function InitialAvatar({ text }: { text: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-sm font-bold uppercase text-cidash-primary"
      aria-hidden
    >
      {text.charAt(0)}
    </span>
  );
}

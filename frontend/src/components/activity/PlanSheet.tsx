import Icon, { type IconName } from '../ui/Icon';
import Modal from '../ui/Modal';

export interface PlanOption {
  id: string;
  label: string;
  description?: string;
  icon: IconName;
  group: string;
}

interface PlanSheetProps {
  value: string;
  options: PlanOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Satu daftar, satu keputusan: jenis aktivitas, mode grup, dan misi digabung menjadi satu pilihan
 * ("What's the plan?"), sehingga layar Activity cukup menampilkan satu baris ringkasan + tombol Start.
 */
export default function PlanSheet({ value, options, onSelect, onClose }: PlanSheetProps) {
  const groups = options.reduce<Record<string, PlanOption[]>>((acc, o) => {
    (acc[o.group] ??= []).push(o);
    return acc;
  }, {});

  return (
    <Modal title="What's the plan?" onClose={onClose}>
      {(close) => (
        <div className="max-h-[60dvh] space-y-4 overflow-y-auto pb-1">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group}>
              <h4 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-subtle">{group}</h4>
              <ul className="space-y-1.5" role="radiogroup" aria-label={group}>
                {items.map((o) => {
                  const selected = o.id === value;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          close(() => {
                            onSelect(o.id);
                            onClose();
                          })
                        }
                        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                          selected ? 'border-cidash-primary bg-cidash-primary/5' : 'border-line bg-inset'
                        }`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
                          <Icon name={o.icon} size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{o.label}</span>
                          {o.description && <span className="block truncate text-xs text-subtle">{o.description}</span>}
                        </span>
                        {selected && <Icon name="check" size={18} className="text-cidash-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

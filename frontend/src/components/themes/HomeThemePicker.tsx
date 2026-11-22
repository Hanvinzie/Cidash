import Icon from '../ui/Icon';
import { HOME_THEMES, useHomeTheme, type HomeThemeId } from '../../hooks/useHomeTheme';
import { HomeThemeScene } from './HomeThemeBackdrop';

/** Ukuran referensi (lebar ponsel × ±28vh), di-scale ke thumbnail. */
const FULL_W = 390;
const FULL_H = 236;
const THUMB_W = 96;
const THUMB_H = Math.round((FULL_H * THUMB_W) / FULL_W); // 58

function Thumb({ id }: { id: HomeThemeId }) {
  if (id === 'none') {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-[10px] font-semibold text-subtle"
        style={{ width: THUMB_W, height: THUMB_H }}
        aria-hidden
      >
        None
      </span>
    );
  }
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-xl ring-1 ring-line"
      style={{ width: THUMB_W, height: THUMB_H }}
      aria-hidden
    >
      <span
        className="absolute left-0 top-0 block origin-top-left"
        style={{ width: FULL_W, height: FULL_H, transform: `scale(${THUMB_W / FULL_W})` }}
      >
        <HomeThemeScene theme={id} />
      </span>
    </span>
  );
}

/** Pemilih tema Home (ilustrasi header). Terpisah dari mode terang/gelap. */
export default function HomeThemePicker() {
  const { homeTheme, setHomeTheme } = useHomeTheme();

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-bold uppercase tracking-wider text-subtle">Theme</p>
      <ul role="radiogroup" aria-label="Theme" className="space-y-2">
        {HOME_THEMES.map((t) => {
          const selected = t.id === homeTheme;
          return (
            <li key={t.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setHomeTheme(t.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-inset p-3 text-left transition active:scale-[0.99] ${
                  selected ? 'border-cidash-primary' : 'border-transparent'
                }`}
              >
                <Thumb id={t.id} />
                <span className="min-w-0 flex-1 font-bold">{t.name}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    selected ? 'bg-cidash-primary text-cidash-on-primary' : 'border-2 border-line'
                  }`}
                  aria-hidden
                >
                  {selected && <Icon name="check" size={14} strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
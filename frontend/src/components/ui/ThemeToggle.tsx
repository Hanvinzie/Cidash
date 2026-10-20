import Icon from './Icon';
import { useTheme } from '../../store/ThemeContext';

/** Tombol ikon cepat untuk beralih light ↔ dark. */
export default function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-inset hover:text-ink"
    >
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

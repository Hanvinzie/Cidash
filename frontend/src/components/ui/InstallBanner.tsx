import { useEffect, useState } from 'react';
import Icon from './Icon';
import Logo from './Logo';
import { isStandalone, platform } from '../../lib/location';

const DISMISS_KEY = 'cidash_install_dismissed';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// beforeinstallprompt (Android/Chrome) bisa terpicu sebelum banner dirender — simpan secara global.
let deferredPrompt: InstallEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as InstallEvent;
});

/**
 * Di tab browser, address bar & toolbar (iOS Safari: link, Share, kompas) TIDAK bisa
 * disembunyikan oleh halaman web — Safari hanya mengecilkannya saat user scroll.
 * Satu-satunya cara tampil tanpa address bar di semua halaman adalah membuka Cidash dari
 * ikon Home Screen (mode standalone). Banner ini memandu user memasangnya.
 */
export default function InstallBanner({ className = '' }: { className?: string }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [prompt, setPrompt] = useState<InstallEvent | null>(deferredPrompt);
  const os = platform();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as InstallEvent;
      setPrompt(deferredPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || isStandalone() || (os !== 'ios' && !prompt)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      className={`animate-rise relative flex items-start gap-3 rounded-2xl border border-line/70 bg-surface p-3 pr-10 shadow-card ${className}`}
    >
      <Logo size={40} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">Use Cidash full screen</p>
        {os === 'ios' ? (
          <p className="text-xs leading-relaxed text-muted">
            Tap <Icon name="share" size={13} className="-mt-0.5 inline text-cidash-primary" /> <b>Share</b> in Safari, choose{' '}
            <b>Add to Home Screen</b>, then open Cidash from the new icon.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted">Install the app to hide the browser bar.</p>
            <button
              type="button"
              onClick={async () => {
                await prompt?.prompt();
                deferredPrompt = null;
                setPrompt(null);
              }}
              className="mt-2 rounded-lg bg-cidash-primary px-3 py-1.5 text-xs font-bold text-cidash-on-primary active:scale-95"
            >
              Install Cidash
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-subtle active:bg-inset"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

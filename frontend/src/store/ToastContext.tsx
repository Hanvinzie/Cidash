import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

const TONE: Record<Tone, string> = {
  info: 'bg-ink text-canvas',
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
};

/** Notifikasi singkat dari atas layar. Satu toast aktif sekaligus (yang baru menggantikan yang lama). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((message: string, tone: Tone = 'info') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[1100] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {toast && (
          <button
            key={toast.id}
            type="button"
            role="status"
            onClick={() => setToast(null)}
            className={`animate-toast pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-left text-sm font-semibold shadow-xl ${TONE[toast.tone]}`}
          >
            {toast.message}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

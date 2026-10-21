import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

/** `close(after)` memainkan animasi turun dulu, lalu memanggil `after` (default: onClose). */
type CloseFn = (after?: () => void) => void;

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode | ((close: CloseFn) => ReactNode);
  /** Show the title visually (default true). */
  showTitle?: boolean;
}

const EXIT_MS = 200;
const DISMISS_PX = 110;

/** Bottom sheet: muncul dari bawah, bisa ditutup dengan tap backdrop, tombol ✕, Esc, atau swipe ke bawah. */
export default function Modal({ title, onClose, children, showTitle = true }: ModalProps) {
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; id: number } | null>(null);

  const close = useCallback<CloseFn>(
    (after = onClose) => {
      setClosing(true);
      setTimeout(after, EXIT_MS);
    },
    [onClose],
  );

  // Kunci scroll halaman di belakang sheet.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // ---- Swipe down dari handle untuk menutup ----
  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { startY: e.clientY, id: e.pointerId };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (drag.current?.id === e.pointerId) setDragY(Math.max(0, e.clientY - drag.current.startY));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dragY > DISMISS_PX) close();
    else setDragY(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className={`absolute inset-0 bg-black/55 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={() => close()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`scroll-area relative max-h-[92%] w-full max-w-md rounded-t-3xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2 shadow-2xl sm:max-w-sm sm:rounded-3xl sm:pb-5 ${
          closing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : { transition: 'transform 200ms ease-out' }}
      >
        {/* Drag handle */}
        <div
          className="mx-auto flex h-6 w-24 cursor-grab touch-none items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <button
          type="button"
          onClick={() => close()}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-subtle transition active:scale-90 active:bg-inset"
        >
          <Icon name="close" size={18} />
        </button>
        <h3 id={titleId} className={showTitle ? 'mb-4 mt-1 px-10 text-center text-lg font-bold' : 'sr-only'}>
          {title}
        </h3>
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>,
    document.body,
  );
}

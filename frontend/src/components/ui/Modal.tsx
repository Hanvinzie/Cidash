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

/** Modal yang sedang terbuka, urutan buka. Hanya yang paling atas yang merespons tombol Esc. */
const openModals: symbol[] = [];

const EXIT_MS = 200;
/** Tarik ke bawah lebih jauh dari ini (px) untuk menutup. */
const DISMISS_PX = 110;
/** Atau lepas dengan kecepatan di atas ini (px/ms), walau jaraknya pendek. */
const DISMISS_VELOCITY = 0.55;
/** Gerakan jari kurang dari ini dianggap ketukan, bukan tarikan. */
const DRAG_START_PX = 8;

/**
 * Apakah gestur yang dimulai di `target` boleh menarik sheet? Tidak boleh bila:
 * - ada elemen scroll (termasuk sheet itu sendiri) di antara target dan sheet yang belum berada di paling atas,
 * - target slider/area yang menandai diri `data-no-swipe`.
 * Dengan begitu menggulir daftar di dalam sheet tidak pernah bentrok dengan gestur tutup.
 */
function canStartSwipe(target: EventTarget | null, sheet: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el instanceof HTMLElement) {
      if (el.dataset.noSwipe !== undefined) return false;
      if (el instanceof HTMLInputElement && el.type === 'range') return false;
      if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) return false;
    }
    if (el === sheet) break;
    el = el.parentElement;
  }
  return true;
}

/** Bottom sheet: muncul dari bawah, bisa ditutup dengan tap backdrop, tombol ✕, Esc, atau swipe ke bawah di mana saja. */
export default function Modal({ title, onClose, children, showTitle = true }: ModalProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  /** Ditutup lewat swipe: sheet melanjutkan geraknya ke bawah, bukan memutar animasi dari awal. */
  const [swiped, setSwiped] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragYRef = useRef(0);
  const handleDrag = useRef<{ startY: number; id: number } | null>(null);
  const stackId = useRef(Symbol('modal'));

  const close = useCallback<CloseFn>(
    (after = onClose) => {
      setClosing(true);
      setTimeout(after, EXIT_MS);
    },
    [onClose],
  );

  const dismissBySwipe = useCallback(() => {
    setSwiped(true);
    setDragging(false);
    setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  // Kunci scroll halaman di belakang sheet.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // Daftarkan ke tumpukan: Esc hanya menutup modal paling atas (mis. pilihan di dalam wizard), bukan semuanya.
  useEffect(() => {
    const id = stackId.current;
    openModals.push(id);
    return () => {
      const at = openModals.indexOf(id);
      if (at >= 0) openModals.splice(at, 1);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === stackId.current) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // ---- Swipe ke bawah dari seluruh permukaan sheet (sentuh) ----
  // Listener native non-pasif: perlu preventDefault supaya browser tidak ikut menggulir/refresh saat sheet ditarik.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    let tracking = false;
    let active = false;
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;

    const reset = () => {
      tracking = false;
      active = false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return reset();
      const t = e.touches[0];
      startX = t.clientX;
      startY = lastY = t.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      tracking = canStartSwipe(e.target, sheet);
      active = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;
      if (!active) {
        if (dy > DRAG_START_PX && Math.abs(dy) > Math.abs(dx) * 1.2) {
          active = true;
          setDragging(true);
        } else if (dy < -DRAG_START_PX || Math.abs(dx) > DRAG_START_PX * 1.5) {
          return reset(); // menggulir ke atas atau menggeser samping: biarkan konten yang menangani
        } else {
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      const dt = Math.max(1, e.timeStamp - lastT);
      velocity = (t.clientY - lastY) / dt;
      lastY = t.clientY;
      lastT = e.timeStamp;
      dragYRef.current = Math.max(0, dy - DRAG_START_PX);
      setDragY(dragYRef.current);
    };

    const onEnd = () => {
      if (!active) return reset();
      const far = dragYRef.current > DISMISS_PX;
      const fast = velocity > DISMISS_VELOCITY && dragYRef.current > 24;
      reset();
      if (far || fast) {
        dismissBySwipe();
      } else {
        dragYRef.current = 0;
        setDragging(false);
        setDragY(0);
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [dismissBySwipe]);

  // ---- Drag handle (mouse/pen di desktop) ----
  const onHandleDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch') return; // sentuh ditangani gestur seluruh sheet
    handleDrag.current = { startY: e.clientY, id: e.pointerId };
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onHandleMove = (e: ReactPointerEvent) => {
    if (handleDrag.current?.id !== e.pointerId) return;
    dragYRef.current = Math.max(0, e.clientY - handleDrag.current.startY);
    setDragY(dragYRef.current);
  };
  const onHandleUp = () => {
    if (!handleDrag.current) return;
    handleDrag.current = null;
    if (dragYRef.current > DISMISS_PX) {
      dismissBySwipe();
    } else {
      dragYRef.current = 0;
      setDragging(false);
      setDragY(0);
    }
  };

  const sheetStyle = swiped
    ? { transform: 'translateY(100%)', transition: `transform ${EXIT_MS}ms ease-in` }
    : dragging
      ? { transform: `translateY(${dragY}px)`, transition: 'none' }
      : { transition: 'transform 200ms ease-out' };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className={`absolute inset-0 bg-black/55 backdrop-blur-sm ${closing || swiped ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={() => close()}
        aria-hidden
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`scroll-area relative max-h-[92%] w-full max-w-md rounded-t-3xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2 shadow-2xl sm:max-w-sm sm:rounded-3xl sm:pb-5 ${
          closing ? 'animate-sheet-down' : swiped ? '' : 'animate-sheet-up'
        }`}
        style={sheetStyle}
      >
        {/* Drag handle */}
        <div
          className="mx-auto flex h-6 w-24 cursor-grab touch-none items-center justify-center"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
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

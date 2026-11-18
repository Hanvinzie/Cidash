import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import Icon from './Icon';

/** Lebar tombol Delete yang tersingkap, dan jarak geser minimal agar tetap terbuka. */
const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = 44;
/** Gerak mendatar minimal sebelum dianggap menggeser (di bawah ini = tap atau scroll vertikal). */
const LOCK_PX = 8;

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  label?: string;
}

/**
 * Geser ke kiri untuk menyingkap tombol Delete (pola daftar iOS/Android). Scroll vertikal tetap berjalan
 * (`touch-action: pan-y`). Tombol Delete juga bisa diakses keyboard/pembaca layar.
 */
export default function SwipeToDelete({ children, onDelete, label = 'Delete' }: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; id: number; locked: boolean } | null>(null);
  const moved = useRef(false);

  const open = offset <= -OPEN_THRESHOLD;

  const onPointerDown = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: offset, id: e.pointerId, locked: false };
    moved.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dy) > LOCK_PX && Math.abs(dy) > Math.abs(dx)) {
        start.current = null; // scroll vertikal, bukan swipe
        return;
      }
      if (Math.abs(dx) < LOCK_PX) return;
      s.locked = true;
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    moved.current = true;
    setOffset(Math.max(-ACTION_WIDTH, Math.min(0, s.base + dx)));
  };

  const finish = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s?.locked) return;
    setOffset((o) => (o <= -OPEN_THRESHOLD ? -ACTION_WIDTH : 0));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_WIDTH }}>
        <button
          type="button"
          onClick={onDelete}
          tabIndex={open ? 0 : -1}
          aria-label={label}
          className="flex w-full flex-col items-center justify-center gap-1 bg-danger text-xs font-bold text-white"
        >
          <Icon name="close" size={18} />
          {label}
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        // Tap pada kartu yang terbuka menutupnya kembali, dan mencegah klik menembus ke isi kartu.
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation();
            e.preventDefault();
            moved.current = false;
          } else if (open) {
            e.stopPropagation();
            e.preventDefault();
            setOffset(0);
          }
        }}
        className="relative bg-canvas"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}

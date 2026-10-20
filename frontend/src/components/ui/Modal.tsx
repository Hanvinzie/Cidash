import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Show the title visually (default true). */
  showTitle?: boolean;
}

export default function Modal({ title, onClose, children, showTitle = true }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto bg-black/60 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-t-3xl border border-line/70 bg-surface p-5 pb-8 shadow-2xl sm:max-w-sm sm:rounded-3xl sm:pb-5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-subtle transition hover:bg-inset hover:text-ink"
        >
          <Icon name="close" size={18} />
        </button>
        <h3 id={titleId} className={showTitle ? 'mb-4 pr-8 text-center text-lg font-bold' : 'sr-only'}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

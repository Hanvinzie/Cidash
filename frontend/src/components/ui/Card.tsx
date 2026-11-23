import { createContext, useContext } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const GlassContext = createContext(false);

/** Semua Card di dalam scope ini tampil sebagai kaca (dipakai di atas ilustrasi Home). */
export function GlassScope({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <GlassContext.Provider value={enabled}>{children}</GlassContext.Provider>;
}

const SOLID = 'border-line/70 bg-surface shadow-card';
const GLASS =
  'home-glass transform-gpu will-change-[backdrop-filter] border-white/40 bg-white/10 text-zinc-900 shadow-lg shadow-black/10 backdrop-blur-lg dark:border-white/10 dark:bg-zinc-950/10 dark:text-white';

export default function Card({ children, className = '', ...rest }: CardProps) {
  const glass = useContext(GlassContext);
  return (
    <div className={`rounded-2xl border p-4 ${glass ? GLASS : SOLID} ${className}`} {...rest}>
      {children}
    </div>
  );
}
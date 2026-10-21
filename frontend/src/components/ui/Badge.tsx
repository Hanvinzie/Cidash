import type { ReactNode } from 'react';
import type { MissionStatus } from '../../types';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

// Sengaja polos: teks berwarna (+ titik status), tanpa pill/glow — terasa seperti label di app native.
const toneText: Record<Tone, string> = {
  primary: 'text-cidash-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-subtle',
};
const toneDot: Record<Tone, string> = {
  primary: 'bg-cidash-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-subtle',
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  /** Tampilkan titik status di depan teks. */
  dot?: boolean;
  /** Titik berdenyut (mis. LIVE). */
  pulse?: boolean;
}

export default function Badge({ children, tone = 'neutral', dot = false, pulse = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${toneText[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]} ${pulse ? 'animate-pulse' : ''}`} />}
      {children}
    </span>
  );
}

const statusMeta: Record<MissionStatus, { label: string; tone: Tone }> = {
  in_progress: { label: 'In progress', tone: 'primary' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
  shielded: { label: 'Shielded', tone: 'neutral' },
};

export function StatusBadge({ status }: { status: MissionStatus }) {
  const meta = statusMeta[status] ?? statusMeta.pending;
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

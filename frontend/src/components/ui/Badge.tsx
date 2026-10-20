import type { ReactNode } from 'react';
import type { MissionStatus } from '../../types';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const toneClasses: Record<Tone, string> = {
  primary: 'bg-cidash-primary/10 text-cidash-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-inset text-muted',
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
}

export default function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

const statusMeta: Record<MissionStatus, { label: string; tone: Tone }> = {
  in_progress: { label: 'In progress', tone: 'primary' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
};

export function StatusBadge({ status }: { status: MissionStatus }) {
  const meta = statusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

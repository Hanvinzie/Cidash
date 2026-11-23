import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import RunnerLoader from '../ui/RunnerLoader';
import { useApp } from '../../store/AppContext';
import { useIsRecording } from '../../store/RunSession';
import { circleOnboarding } from '../../routes';

const COPY = {
  home: 'Create a private circle or join one with an invite code.',
  quests: 'Bomb Challenges are played against friends. Create a circle or join one with an invite code to unlock Challenges.',
  activity: 'Runs and rides are recorded for your circle. Create a circle or join one with an invite code to unlock Activity.',
} as const;

/** Kartu "belum punya circle". Gaya dan teks sama dengan yang ada di Dashboard. */
export function NoCircleCard({ feature = 'home' }: { feature?: keyof typeof COPY }) {
  const navigate = useNavigate();
  return (
    <Card className="mt-10 p-6 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
        <Icon name={feature === 'home' ? 'users' : 'lock'} size={24} />
      </span>
      <p className="mb-1 font-bold">{feature === 'home' ? 'No circle yet' : 'Join a circle to unlock this'}</p>
      <p className="mb-5 text-sm text-muted">{COPY[feature]}</p>
      <Button onClick={() => navigate(circleOnboarding)}>Create or join a circle</Button>
    </Card>
  );
}

/**
 * Mengunci halaman yang tidak berfungsi tanpa circle. Tab tetap terlihat di navigasi supaya
 * pengguna tahu fiturnya ada. Tidak mengunci saat memuat data (hindari kedip) maupun saat
 * rekaman sedang berjalan (mis. di-kick di tengah lari).
 */
export default function NoCircleGate({ feature, children }: { feature: 'quests' | 'activity'; children: ReactNode }) {
  const { circles, hydrating } = useApp();
  const recording = useIsRecording();

  if (circles.length > 0 || recording) return <>{children}</>;
  if (hydrating) {
    return (
      <div className="flex justify-center pt-24">
        <RunnerLoader />
      </div>
    );
  }
  return <NoCircleCard feature={feature} />;
}

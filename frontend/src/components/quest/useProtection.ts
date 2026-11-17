import { useApp } from '../../store/AppContext';
import type { AvailabilityStatus } from '../../types';

/** Status "bisa ditantang" + kuota Shield/Rest. Dipakai tab Quest, wizard, dan modal Protection. */
export function useProtection() {
  const { user, bombMissions } = useApp();

  const shieldCount = user.shieldTickets ?? 0;
  const maxShields = user.maxShieldTickets ?? 2;
  const weeklyShieldsBought = user.weeklyShieldsBought ?? 0;
  const maxWeeklyShields = user.maxWeeklyShields ?? 2;
  const nextShieldCost =
    user.nextShieldCost !== undefined
      ? user.nextShieldCost
      : shieldCount >= maxShields || weeklyShieldsBought >= maxWeeklyShields
        ? null
        : weeklyShieldsBought === 0
          ? 25
          : 50;

  const hasActiveIncoming = bombMissions.some(
    (q) => q.direction === 'incoming' && (q.status === 'pending' || q.status === 'in_progress'),
  );
  const myStatus: AvailabilityStatus =
    user.availabilityStatus === 'RESTING'
      ? 'RESTING'
      : hasActiveIncoming || user.availabilityStatus === 'IN_MISSION'
        ? 'IN_MISSION'
        : 'AVAILABLE';

  const weeklyRestUsed = user.weeklyRestUsed ?? 0;
  const maxWeeklyRest = user.maxWeeklyRest ?? 2;
  const nextRestCost =
    user.nextRestCost !== undefined
      ? user.nextRestCost
      : weeklyRestUsed >= maxWeeklyRest
        ? null
        : weeklyRestUsed === 0
          ? 0
          : 15;

  return {
    myStatus,
    shieldCount,
    maxShields,
    weeklyShieldsBought,
    maxWeeklyShields,
    nextShieldCost,
    weeklyRestUsed,
    maxWeeklyRest,
    nextRestCost,
  };
}

export function statusLabel(status?: AvailabilityStatus): { text: string; tone: 'success' | 'warning' | 'neutral' } {
  if (status === 'RESTING') return { text: 'Rest Mode', tone: 'neutral' };
  if (status === 'IN_MISSION') return { text: 'Busy', tone: 'warning' };
  return { text: 'Ready', tone: 'success' };
}

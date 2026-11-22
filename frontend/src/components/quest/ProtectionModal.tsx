import { useState } from 'react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { statusLabel, useProtection } from './useProtection';
import { useApp } from '../../store/AppContext';

/** Rest Mode + toko Shield, dipindah dari halaman Quest agar halaman utama tetap ringkas. */
export default function ProtectionModal({ onClose }: { onClose: () => void }) {
  const { user, buyShield, setAvailabilityStatus } = useApp();
  const p = useProtection();
  const [buyingShield, setBuyingShield] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const badge = statusLabel(p.myStatus);

  async function handleBuyShield() {
    setBuyingShield(true);
    try {
      await buyShield();
    } finally {
      setBuyingShield(false);
    }
  }

  async function handleToggleRest() {
    setUpdatingStatus(true);
    try {
      await setAvailabilityStatus(p.myStatus === 'RESTING' ? 'AVAILABLE' : 'RESTING');
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <Modal title="Protection" onClose={onClose}>
      <div className="space-y-4">
        <section className="space-y-3 rounded-2xl bg-inset p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold">Bomb Challenge status</p>
            <Badge tone={badge.tone}>{badge.text}</Badge>
          </div>
          <p className="text-xs text-subtle">
            {p.myStatus === 'RESTING'
              ? 'Immunity active for 24h. You cannot receive or send Bomb Challenges.'
              : p.myStatus === 'IN_MISSION'
                ? 'Protected from new bombs until you finish your active challenge (max 1 at a time).'
                : `Rest Mode quota: ${p.weeklyRestUsed}/${p.maxWeeklyRest} used this week (1st free, 2nd 15 coins).`}
          </p>
          {p.myStatus === 'RESTING' ? (
            <Button fullWidth variant="secondary" disabled={updatingStatus} onClick={() => void handleToggleRest()}>
              Switch to Ready
            </Button>
          ) : (
            <Button
              fullWidth
              variant="secondary"
              disabled={updatingStatus || p.myStatus === 'IN_MISSION' || p.nextRestCost === null}
              onClick={() => void handleToggleRest()}
            >
              {p.nextRestCost === null
                ? 'Rest limit reached'
                : p.nextRestCost === 0
                  ? 'Rest 24h · Free'
                  : `Rest 24h · ${p.nextRestCost} coins`}
            </Button>
          )}
        </section>

        <section className="space-y-3 rounded-2xl bg-inset p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
              <Icon name="shield" size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">Shield Tickets</p>
                <Badge tone={p.shieldCount > 0 ? 'primary' : 'neutral'}>
                  {p.shieldCount}/{p.maxShields}
                </Badge>
              </div>
              <p className="text-xs text-subtle">
                Blocks the RP penalty and refunds 50% of the coins to the sender. Bought this week: {p.weeklyShieldsBought}/
                {p.maxWeeklyShields}
              </p>
            </div>
          </div>
          <Button
            fullWidth
            variant={p.nextShieldCost !== null && user.coins >= p.nextShieldCost ? 'primary' : 'secondary'}
            disabled={buyingShield || p.nextShieldCost === null}
            onClick={() => void handleBuyShield()}
          >
            <Icon name="coin" size={14} />
            {p.shieldCount >= p.maxShields
              ? 'Max shields owned'
              : p.nextShieldCost === null
                ? 'Weekly limit reached'
                : `Buy Shield · ${p.nextShieldCost} coins`}
          </Button>
        </section>
      </div>
    </Modal>
  );
}

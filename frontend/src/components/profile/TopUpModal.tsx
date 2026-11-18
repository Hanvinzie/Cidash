import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { coinPackages } from '../../data/mock';

interface TopUpModalProps {
  balance: number;
  onClose: () => void;
  /** Dipanggil dengan total koin yang diterima (termasuk bonus). */
  onBuy: (coins: number) => void;
}

/** Pilih paket koin di modal. Pembelian bersifat demo (instan), sama seperti panel inline sebelumnya. */
export default function TopUpModal({ balance, onClose, onBuy }: TopUpModalProps) {
  return (
    <Modal title="Top up coins" onClose={onClose}>
      {(close) => (
        <div className="space-y-4">
          <p className="-mt-2 text-center text-xs text-subtle">
            Current balance: <b className="text-ink">{balance.toLocaleString('en-US')} coins</b> · Demo instant top-up
          </p>
          <ul className="max-h-[56dvh] space-y-2 overflow-y-auto">
            {coinPackages.map((p) => {
              const total = p.coins + (p.bonusCoins ?? 0);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() =>
                      close(() => {
                        onBuy(total);
                        onClose();
                      })
                    }
                    className="flex w-full items-center justify-between rounded-2xl border border-line bg-inset px-4 py-3.5 text-left transition hover:border-cidash-primary active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="coin" size={20} className="text-warning" />
                      <span className="font-bold">{p.coins} coins</span>
                      {p.bonusCoins ? <Badge tone="success">+{p.bonusCoins} bonus</Badge> : null}
                    </span>
                    <span className="text-sm font-bold text-cidash-primary">{p.priceLabel}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}

import Icon from './Icon';

interface CoinBalanceProps {
  coins: number;
  onTopUp?: () => void;
  topUpLabel?: string;
}

export default function CoinBalance({ coins, onTopUp, topUpLabel = 'Top up' }: CoinBalanceProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cidash-primary to-[#B3122E] p-4 text-white shadow-lg shadow-cidash-primary/20">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" aria-hidden />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
            <Icon name="coin" size={22} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Coin balance</p>
            <p className="text-2xl font-extrabold leading-tight">{coins.toLocaleString('en-US')}</p>
          </div>
        </div>
        {onTopUp && (
          <button
            type="button"
            onClick={onTopUp}
            className="h-9 rounded-xl bg-white px-4 text-xs font-bold text-cidash-primary transition hover:bg-white/90 active:scale-[0.98]"
          >
            {topUpLabel}
          </button>
        )}
      </div>
    </div>
  );
}

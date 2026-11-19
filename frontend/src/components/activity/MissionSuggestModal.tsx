import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

export interface SuggestedMission {
  id: string;
  title: string;
  targetKm: number;
  /** Hadiah Rank Point bila tersedia (Bomb Mission). Circle mission belum punya hadiah di data. */
  rewardRankPoints?: number;
  kind: 'bomb' | 'circle';
}

interface Props {
  type: 'run' | 'bike';
  missions: SuggestedMission[];
  onPick: (id: string) => void;
  /** Lanjut free run tanpa misi. */
  onSkip: () => void;
  onClose: () => void;
}

/** Ditampilkan saat Start pada Free run/ride dan masih ada misi sejenis yang belum selesai. */
export default function MissionSuggestModal({ type, missions, onPick, onSkip, onClose }: Props) {
  const noun = type === 'run' ? 'run' : 'ride';
  return (
    <Modal title={`Do a mission on this ${noun}?`} onClose={onClose}>
      {(close) => (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            You have unfinished {noun} missions. Pick one and this {noun} counts toward it.
          </p>
          <ul className="space-y-2" aria-label="Open missions">
            {missions.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => close(() => onPick(m.id))}
                  className="flex w-full items-center gap-3 rounded-2xl bg-inset px-3 py-3 text-left transition active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
                    <Icon name={m.kind === 'bomb' ? 'bomb' : 'target'} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{m.title}</span>
                    <span className="block text-xs text-subtle">
                      {m.targetKm} km
                      {m.rewardRankPoints !== undefined && (
                        <span className="font-semibold text-success"> · +{m.rewardRankPoints} RP</span>
                      )}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} className="text-subtle" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" fullWidth onClick={() => close(onSkip)}>
            No, just a free {noun}
          </Button>
        </div>
      )}
    </Modal>
  );
}

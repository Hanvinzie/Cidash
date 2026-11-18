import Modal from '../ui/Modal';
import LeaderboardList from './LeaderboardList';
import type { LeaderboardEntry } from '../../types';

interface LeaderboardModalProps {
  circleName: string;
  entries: LeaderboardEntry[];
  myId: string;
  myRank: number | null;
  onClose: () => void;
}

/** Leaderboard lengkap satu circle. Daftar menggulir di dalam modal, posisi pengguna disorot. */
export default function LeaderboardModal({ circleName, entries, myId, myRank, onClose }: LeaderboardModalProps) {
  return (
    <Modal title="Leaderboard" onClose={onClose}>
      <div>
        <p className="-mt-2 mb-3 text-center text-xs text-subtle">
          {circleName} · {entries.length} {entries.length === 1 ? 'member' : 'members'}
          {myRank ? <> · You're <b className="text-ink">#{myRank}</b></> : null}
        </p>
        <div className="-mx-1 max-h-[58dvh] overflow-y-auto rounded-2xl bg-inset/40" aria-label="Full leaderboard">
          <LeaderboardList entries={entries} myId={myId} />
        </div>
        <p className="mt-3 text-center text-[11px] text-subtle">Resets quarterly</p>
      </div>
    </Modal>
  );
}

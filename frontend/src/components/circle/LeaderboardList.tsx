import type { LeaderboardEntry } from '../../types';

const MEDAL = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  myId: string;
}

/** Baris peringkat circle (dipakai kartu 3 teratas di Home dan modal leaderboard lengkap). */
export default function LeaderboardList({ entries, myId }: LeaderboardListProps) {
  return (
    <ol className="divide-y divide-line/70">
      {entries.map((e) => {
        const isMe = e.user.id === myId;
        return (
          <li key={e.user.id} className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-cidash-primary/5' : ''}`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                MEDAL[e.rank - 1] ?? 'bg-inset text-subtle'
              }`}
            >
              {e.rank}
            </span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-sm font-bold uppercase text-cidash-primary"
              aria-hidden
            >
              {e.user.username.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {e.user.username}
                {isMe && <span className="ml-1.5 text-xs font-semibold text-cidash-primary">(you)</span>}
              </span>
              <span className="text-xs text-subtle">{e.totalDistanceKm} km</span>
            </span>
            <span className="text-right text-sm font-bold">
              {e.rankPoints.toLocaleString('en-US')} <span className="text-xs font-medium text-subtle">RP</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import { useLiveRooms, type useGroupRun } from '../../hooks/useGroupRun';
import { PROGRESS_INTERVAL_MS } from '../../services/groupRun';

interface GroupRunPanelProps {
  circleId: string;
  myId: string;
  group: ReturnType<typeof useGroupRun>;
  tracking: boolean;
}

const STATUS = {
  lobby: { label: 'Lobby', tone: 'warning' },
  live: { label: 'LIVE', tone: 'danger' },
  ended: { label: 'Ended', tone: 'neutral' },
} as const;

export default function GroupRunPanel({ circleId, myId, group, tracking }: GroupRunPanelProps) {
  const rooms = useLiveRooms(circleId);
  const { room, isHost, ranking, gapMessage, busy, error } = group;

  // ---- Not in a room: pick an active room or create one ----
  if (!room) {
    return (
      <Card className="space-y-3">
        <h2 className="font-bold">Group run lobby</h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-subtle">No sessions running in this circle yet.</p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-inset px-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>{' '}
                  <b>@{r.hostName}</b>
                  <span className="text-subtle"> · {r.participants.length} runners</span>
                </span>
                <Button size="sm" disabled={busy} onClick={() => group.join(r.id)}>
                  Join
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" fullWidth disabled={busy} onClick={() => group.create(circleId)}>
          <Icon name="plus" size={16} /> Create a room
        </Button>
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </Card>
    );
  }

  // ---- In a room: participants + live leaderboard ----
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">
            Room <span className="font-mono text-cidash-primary">{room.id}</span>
          </p>
          <p className="text-[11px] text-subtle">
            Host @{room.hostName} · updates every {PROGRESS_INTERVAL_MS / 1000}s
          </p>
        </div>
        <Badge tone={STATUS[room.status].tone}>{STATUS[room.status].label}</Badge>
      </div>

      {gapMessage && room.status === 'live' && (
        <p className="rounded-xl bg-cidash-primary/10 px-3 py-2 text-center text-sm font-bold text-cidash-primary" aria-live="polite">
          {gapMessage}
        </p>
      )}

      <ol className="divide-y divide-line/70 rounded-xl bg-inset">
        {ranking.map((p, i) => (
          <li
            key={p.userId}
            className={`flex items-center justify-between px-3 py-2 text-sm ${p.userId === myId ? 'font-bold text-cidash-primary' : ''}`}
          >
            <span>
              <span className="mr-2 text-subtle">#{i + 1}</span>
              {p.username}
              {p.userId === myId && ' (you)'}
              {p.userId === room.hostId && <span className="ml-1 text-[10px] font-medium text-subtle">host</span>}
            </span>
            <span className="font-mono tabular-nums">{p.distanceKm.toFixed(2)} km</span>
          </li>
        ))}
      </ol>

      <div className="flex gap-2">
        {room.status === 'lobby' &&
          (isHost ? (
            <Button fullWidth disabled={busy} onClick={group.start}>
              Start session
            </Button>
          ) : (
            <p className="flex-1 self-center text-xs text-muted">Waiting for the host to start…</p>
          ))}
        <Button variant="secondary" fullWidth disabled={busy || tracking} onClick={group.leave}>
          Leave room
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

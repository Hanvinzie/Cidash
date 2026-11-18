import { useCallback, useEffect, useState } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Logo from '../ui/Logo';
import Wordmark from '../ui/Wordmark';
import { useAppUpdate } from '../../lib/appUpdate';
import { fetchContributors, GITHUB_REPO, GITHUB_URL, type Contributor } from '../../lib/github';

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Kartu status update: tersedia → tombol Update; sedang memasang → animasi; terbaru → info + cek manual. */
function UpdateCard() {
  const u = useAppUpdate();

  if (u.updating) {
    return (
      <div className="rounded-2xl border border-cidash-primary/30 bg-cidash-primary/5 p-4" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cidash-primary text-cidash-on-primary">
            <Icon name="refresh" size={20} className="animate-spin" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">Installing {u.latestVersion ? `v${u.latestVersion}` : 'the new version'}…</p>
            <p className="text-xs text-subtle">Cidash will restart in a moment.</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cidash-primary/15">
          <div className="animate-update-bar h-full rounded-full bg-cidash-primary" />
        </div>
      </div>
    );
  }

  if (u.updateAvailable) {
    return (
      <div className="animate-rise rounded-2xl border border-cidash-primary/30 bg-cidash-primary/5 p-4">
        <div className="flex items-center gap-3">
          <span className="animate-hop flex h-10 w-10 items-center justify-center rounded-full bg-cidash-primary text-cidash-on-primary">
            <Icon name="download" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{u.latestVersion ? `Version ${u.latestVersion} is available` : 'A new version is available'}</p>
            <p className="text-xs text-subtle">You're on v{u.currentVersion}.</p>
          </div>
        </div>
        <Button fullWidth className="mt-3" onClick={() => void u.apply()}>
          <Icon name="refresh" size={16} /> Update now
        </Button>
        {u.notice && (
          <p className="mt-2 text-center text-xs font-semibold text-muted" role="status" aria-live="polite">
            {u.notice}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-inset p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
          <Icon name="check" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">You're up to date</p>
          <p className="text-xs text-subtle">
            {u.lastCheckedAt ? `Checked at ${formatTime(u.lastCheckedAt)}` : 'Cidash checks for updates automatically.'}
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={u.checking} onClick={() => void u.check()}>
          <Icon name="refresh" size={14} className={u.checking ? 'animate-spin' : ''} />
          {u.checking ? 'Checking' : 'Check'}
        </Button>
      </div>
    </div>
  );
}

type ContributorsState =
  | { status: 'loading' }
  | { status: 'ready'; contributors: Contributor[]; stale: boolean }
  | { status: 'error' };

function Contributors() {
  const [state, setState] = useState<ContributorsState>({ status: 'loading' });

  const load = useCallback((force = false) => {
    setState({ status: 'loading' });
    fetchContributors(force)
      .then((r) => setState({ status: 'ready', ...r }))
      .catch(() => setState({ status: 'error' }));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <section>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-subtle">Contributors</h4>

      {state.status === 'loading' && (
        <ul className="grid grid-cols-2 gap-2" aria-busy="true" aria-label="Loading contributors">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex h-14 animate-pulse items-center gap-2.5 rounded-2xl bg-inset px-3">
              <span className="h-9 w-9 rounded-full bg-line" />
              <span className="h-3 w-16 rounded bg-line" />
            </li>
          ))}
        </ul>
      )}

      {state.status === 'error' && (
        <div className="rounded-2xl bg-inset p-4 text-center text-sm text-muted">
          <p>Couldn't load contributors right now.</p>
          <button type="button" onClick={() => load(true)} className="mt-1 text-xs font-bold text-cidash-primary">
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <ul className="grid grid-cols-2 gap-2">
            {state.contributors.map((c) => (
              <li key={c.login}>
                <a
                  href={c.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex h-14 items-center gap-2.5 rounded-2xl bg-inset px-3 transition active:scale-[0.97]"
                >
                  <img
                    src={c.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    loading="lazy"
                    className="h-9 w-9 shrink-0 rounded-full bg-line"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{c.login}</span>
                    <span className="block truncate text-[10px] text-subtle">
                      {c.isCreator ? 'Creator' : `${c.contributions} commit${c.contributions === 1 ? '' : 's'}`}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {state.contributors.length === 0 && <p className="text-center text-sm text-subtle">No contributors yet.</p>}
          {state.stale && <p className="mt-2 text-center text-[11px] text-subtle">Showing saved list (GitHub is unreachable).</p>}
        </>
      )}
    </section>
  );
}

export default function AboutPanel() {
  const { currentVersion, buildTime } = useAppUpdate();
  return (
    <div className="max-h-[66dvh] space-y-5 overflow-y-auto pb-1">
      <div className="flex flex-col items-center text-center">
        <Logo size={72} className="shadow-lg shadow-cidash-primary/25" />
        <Wordmark as="h3" className="mt-3 text-2xl" />
        <p className="text-xs text-subtle">
          Version {currentVersion}
          <span className="mx-1.5">·</span>
          Built {new Date(buildTime).toLocaleDateString('en-US', { dateStyle: 'medium' })}
        </p>
      </div>

      <UpdateCard />
      <Contributors />

      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center justify-between rounded-2xl bg-inset px-4 py-3 text-sm font-semibold transition active:scale-[0.98]"
      >
        <span>
          View on GitHub <span className="font-normal text-subtle">· {GITHUB_REPO}</span>
        </span>
        <Icon name="external" size={16} className="text-subtle" />
      </a>
    </div>
  );
}

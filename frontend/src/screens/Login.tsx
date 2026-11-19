import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Icon from '../components/ui/Icon';
import Logo from '../components/ui/Logo';
import Wordmark from '../components/ui/Wordmark';
import InstallBanner from '../components/ui/InstallBanner';
import { Input } from '../components/ui/Field';
import { CURRENT_VERSION } from '../lib/appUpdate';
import { ApiError } from '../services/http';
import { useApp } from '../store/AppContext';
import { ROUTES } from '../routes';

type AuthMode = 'login' | 'register';
type Step = 'welcome' | 'auth' | 'circle';

const CODE_PATTERN = /^[A-Z0-9]{8}$/;
/** Onboarding hanya tampil sekali per perangkat, untuk pengguna yang belum pernah masuk. */
const ONBOARDED_KEY = 'cidash_onboarded';

const FEATURES = [
  { icon: 'users', title: 'Private circles', text: 'Train with friends in invite-only groups.' },
  { icon: 'quest', title: 'Bomb Missions', text: 'Dare a friend to a run or ride and put coins on the line.' },
  { icon: 'trophy', title: 'Season leaderboard', text: 'Earn Rank Points and climb a fresh ranking every season.' },
] as const;

const hasOnboarded = () => {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true; // storage tidak tersedia: jangan menahan pengguna di onboarding
  }
};
const markOnboarded = () => {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* private mode */
  }
};

/** Catatan di bawah layar masuk/daftar: aplikasi masih tahap pengembangan. */
function DevNotice() {
  return (
    <p className="mt-8 px-4 text-center text-[11px] leading-relaxed text-subtle">
      CIDASH is still in development (v{CURRENT_VERSION}). Some features may change, and data may be reset.
    </p>
  );
}

export default function Login() {
  const { isAuthenticated, login, createCircle, joinCircle } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [step, setStep] = useState<Step>(() => {
    if (isAuthenticated && params.get('step') === 'circle') return 'circle';
    return hasOnboarded() ? 'auth' : 'welcome';
  });
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [circleName, setCircleName] = useState('');
  const [joinCode, setJoinCode] = useState(() =>
    (params.get('code') ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Email yang dicoba masuk belum terdaftar → tawarkan membuat akun. */
  const [unregistered, setUnregistered] = useState(false);
  /**
   * Pengguna yang baru daftar (atau akun tanpa circle) boleh melewati langkah circle. Pengguna lama yang membuka
   * halaman ini dari aplikasi justru perlu tombol kembali, dan tidak melihat circle yang sudah ada di sini.
   */
  const [firstTime, setFirstTime] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? ROUTES.dashboard;
  /** Dibuka dari dalam aplikasi (mis. Profile → Create / join): kembali ke halaman sebelumnya. */
  const openedFromApp = isAuthenticated && params.get('step') === 'circle' && location.key !== 'default';
  const goBack = () => (openedFromApp ? navigate(-1) : navigate(redirectTo, { replace: true }));

  // Jangan alihkan saat login masih berjalan: `login()` menandai pengguna terautentikasi sebelum hasilnya kembali,
  // sehingga pengguna baru langsung dilempar ke Dashboard dan tidak pernah melihat langkah "Join a circle".
  if (isAuthenticated && step !== 'circle' && !loading) return <Navigate to={redirectTo} replace />;

  function startAuth(nextMode: AuthMode) {
    markOnboarded();
    setMode(nextMode);
    setError(null);
    setStep('auth');
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setUnregistered(false);
    setPassword('');
  }

  async function runAuth(credentials: { mode: AuthMode; name?: string; email: string; password: string }) {
    setError(null);
    setLoading(true);
    try {
      const { circleCount } = await login(credentials);
      markOnboarded();
      if (circleCount > 0 && !joinCode) {
        navigate(redirectTo, { replace: true });
      } else {
        setFirstTime(credentials.mode === 'register' || circleCount === 0);
        setStep('circle');
      }
    } catch (err) {
      if (credentials.mode === 'login' && err instanceof ApiError && err.code === 'EMAIL_NOT_REGISTERED') {
        setUnregistered(true); // pop-up mengajak membuat akun, bukan pesan galat biasa
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void runAuth({ mode, name: username, email, password });
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCircle(circleName.trim());
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create circle');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await joinCircle(joinCode);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or already joined invite code');
    } finally {
      setLoading(false);
    }
  }

  const backdrop = (
    <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-cidash-primary/15 to-transparent" aria-hidden />
  );
  const shell = 'relative mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]';

  // ---------------- 1. Onboarding (sekali, untuk pengguna baru) ----------------
  if (step === 'welcome') {
    return (
      <div className="relative min-h-[100dvh] bg-canvas">
        {backdrop}
        <div className={`${shell} flex min-h-[100dvh] flex-col`}>
          <InstallBanner className="mb-4" />
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <Logo size={96} className="shadow-xl shadow-cidash-primary/30" />
            <Wordmark as="h1" className="mt-5 text-5xl text-cidash-primary" />
            <p className="mt-2 text-sm text-muted">Work out with the people you trust.</p>

            <ul className="mt-9 w-full space-y-3 text-left">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
                    <Icon name={f.icon} size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{f.title}</span>
                    <span className="block text-xs text-muted">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Button fullWidth size="lg" onClick={() => startAuth('register')}>
              Get started
            </Button>
            <Button fullWidth variant="ghost" onClick={() => startAuth('login')}>
              I already have an account
            </Button>
          </div>
          <DevNotice />
        </div>
      </div>
    );
  }

  // ---------------- 2. Masuk / Daftar ----------------
  if (step === 'auth') {
    const isLogin = mode === 'login';
    return (
      <div className="relative min-h-[100dvh] bg-canvas">
        {backdrop}
        <div className={`${shell} flex min-h-[100dvh] flex-col`}>
          <div className="mb-8 mt-6 text-center">
            <Logo size={64} className="mx-auto mb-4 shadow-lg shadow-cidash-primary/30" />
            <Wordmark as="h1" className="text-4xl text-cidash-primary" />
            <p className="mt-2 text-sm text-muted">{isLogin ? 'Welcome back.' : 'Create your account.'}</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-xs font-semibold text-danger">
              {error}
            </div>
          )}

          <Card className="p-5">
            <form onSubmit={handleAuth} className="space-y-3">
              {!isLogin && (
                <Input
                  label="Username"
                  required
                  minLength={2}
                  maxLength={60}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your display name"
                />
              )}
              <Input
                label="Email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Password"
                type="password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" fullWidth disabled={loading} className="!mt-5">
                {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted">
              {isLogin ? 'Not have an account yet?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(isLogin ? 'register' : 'login')}
                className="font-bold text-cidash-primary"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            {isLogin && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-subtle">
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={loading}
                  onClick={() => void runAuth({ mode: 'login', email: 'budi@cidash.id', password: 'password123' })}
                >
                  Continue with Demo Account
                </Button>
              </>
            )}
          </Card>

          <div className="flex-1" />
          <DevNotice />
        </div>

        {unregistered && (
          <ConfirmDialog
            title="Email not registered"
            confirmLabel="Create account"
            onConfirm={() => {
              setUnregistered(false);
              switchMode('register');
            }}
            onCancel={() => setUnregistered(false)}
          >
            <p>
              <b>{email.trim()}</b> isn't registered yet. Would you like to create a new account with this email?
            </p>
          </ConfirmDialog>
        )}
      </div>
    );
  }

  // ---------------- 3. Buat / gabung circle ----------------
  return (
    <div className="relative min-h-[100dvh] bg-canvas">
      {backdrop}
      <div className={shell}>
        <div className="mb-8 text-center">
          <Logo size={64} className="mx-auto mb-4 shadow-lg shadow-cidash-primary/30" />
          <Wordmark as="h1" className="text-4xl text-cidash-primary" />
          <p className="mt-2 text-sm text-muted">Work out with the people you trust.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-xs font-semibold text-danger">
            {error}
          </div>
        )}

        <Card className="space-y-5 p-5">
          {!firstTime && (
            <button
              type="button"
              onClick={goBack}
              className="-ml-1 -mt-1 flex items-center gap-1 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-muted transition active:scale-95 active:bg-inset"
            >
              <Icon name="chevronLeft" size={18} /> Back
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold">Join a circle</h2>
            <p className="text-sm text-muted">Create a new private group or join one with a friend's code.</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <Input
              label="Invite code (8 characters)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={8}
              placeholder="XXXXXXXX"
              className="text-center font-mono text-lg uppercase tracking-[0.3em]"
              hint={`${joinCode.length}/8`}
            />
            <Button type="submit" fullWidth disabled={loading || !CODE_PATTERN.test(joinCode)}>
              Join circle
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-line" />
            or start your own
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              label="New circle name"
              placeholder="e.g. Sunset Run Squad"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              required
              minLength={3}
              maxLength={40}
            />
            <Button type="submit" variant="outline" fullWidth disabled={loading || circleName.trim().length < 3}>
              <Icon name="plus" size={16} /> Create circle
            </Button>
          </form>

          {firstTime && (
            <Button variant="ghost" fullWidth onClick={() => navigate(redirectTo, { replace: true })}>
              Skip for now
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

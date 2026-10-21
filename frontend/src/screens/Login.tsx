import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Icon from '../components/ui/Icon';
import Logo from '../components/ui/Logo';
import InstallBanner from '../components/ui/InstallBanner';
import ThemeToggle from '../components/ui/ThemeToggle';
import { Input, Segmented } from '../components/ui/Field';
import { useApp } from '../store/AppContext';
import { ROUTES } from '../routes';

type AuthMode = 'login' | 'register';
type Step = 'auth' | 'circle';

const CODE_PATTERN = /^[A-Z0-9]{8}$/;

const HIGHLIGHTS = [
  { icon: 'users', text: 'Private, invite-only circles' },
  { icon: 'quest', text: 'Dare friends with Bomb Missions' },
  { icon: 'trophy', text: 'Fresh leaderboard every season' },
] as const;

export default function Login() {
  const { isAuthenticated, login, circles, createCircle, joinCircle } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [step, setStep] = useState<Step>(isAuthenticated && params.get('step') === 'circle' ? 'circle' : 'auth');
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

  const redirectTo = (location.state as { from?: string } | null)?.from ?? ROUTES.dashboard;

  if (isAuthenticated && step === 'auth') return <Navigate to={redirectTo} replace />;

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
  }

  async function handleAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { circleCount } = await login({ mode, name: username, email, password });
      if (circleCount > 0 && !joinCode) {
        navigate(redirectTo, { replace: true });
      } else {
        setStep('circle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="relative min-h-[100dvh] bg-canvas">
      {/* Brand backdrop */}
      <div
        className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-cidash-primary/15 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="mb-6 flex justify-end">
          <ThemeToggle />
        </div>

        <InstallBanner className="mb-6" />

        <div className="mb-8 text-center">
          <Logo size={64} className="mx-auto mb-4 shadow-lg shadow-cidash-primary/30" />
          <h1 className="text-3xl font-extrabold tracking-tight">Cidash</h1>
          <p className="mt-1 text-sm text-muted">Work out with the people you trust.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-xs font-semibold text-danger">
            {error}
          </div>
        )}

        {step === 'auth' ? (
          <>
            <ul className="mb-6 grid grid-cols-3 gap-2">
              {HIGHLIGHTS.map((h) => (
                <li
                  key={h.text}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-surface/70 p-3 text-center shadow-card"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
                    <Icon name={h.icon} size={18} />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-muted">{h.text}</span>
                </li>
              ))}
            </ul>

            <Card className="p-5">
              <div className="mb-5">
                <Segmented
                  ariaLabel="Authentication mode"
                  value={mode}
                  onChange={handleModeChange}
                  options={[
                    { value: 'login', label: 'Sign in' },
                    { value: 'register', label: 'Sign up' },
                  ]}
                />
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {mode === 'register' && (
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
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button type="submit" fullWidth disabled={loading} className="!mt-5">
                  {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3 text-xs text-subtle">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>

              <Button
                variant="secondary"
                fullWidth
                disabled={loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    const { circleCount } = await login({
                      mode: 'login',
                      email: 'budi@cidash.id',
                      password: 'password123',
                    });
                    if (circleCount > 0 && !joinCode) {
                      navigate(redirectTo, { replace: true });
                    } else {
                      setStep('circle');
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Demo login failed');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Continue with Demo Account (Budi)
              </Button>
            </Card>
          </>
        ) : (
          <Card className="space-y-5 p-5">
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

            {circles.length > 0 && (
              <Button variant="ghost" fullWidth onClick={() => navigate(redirectTo, { replace: true })}>
                Skip — use my existing circles ({circles.length})
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

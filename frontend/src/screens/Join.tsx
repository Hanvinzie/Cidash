import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import RunnerLoader from '../components/ui/RunnerLoader';
import { useApp } from '../store/AppContext';
import { useToast } from '../store/ToastContext';
import { ROUTES } from '../routes';

const CODE_PATTERN = /^[A-Z0-9]{8}$/;

/**
 * Tujuan tautan undangan `/join?code=XXXXXXXX`.
 * - Belum login: arahkan ke masuk/daftar dengan kode sudah terisi di langkah "Join a circle".
 * - Sudah login: langsung bergabung ke circle itu lalu buka Home (circle tersebut menjadi circle aktif).
 */
export default function Join() {
  const [params] = useSearchParams();
  const { isAuthenticated, hydrating, circles, setActiveCircle, joinCircle } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const code = (params.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const handled = useRef(false);

  useEffect(() => {
    // Tunggu data circle selesai dimuat agar "sudah jadi anggota" terdeteksi dengan benar. Ref mencegah gabung dua kali (StrictMode).
    if (!isAuthenticated || hydrating || handled.current) return;
    handled.current = true;
    const goHome = () => {
      void navigate(ROUTES.dashboard, { replace: true });
    };

    if (!CODE_PATTERN.test(code)) {
      toast('That invite link is not valid.', 'error');
      goHome();
      return;
    }
    const existing = circles.find((c) => c.code === code);
    if (existing) {
      setActiveCircle(existing.id);
      toast(`You're already in "${existing.name}".`, 'info');
      goHome();
      return;
    }
    joinCircle(code)
      .catch((err) => toast(err instanceof Error ? err.message : 'Could not join this circle.', 'error'))
      .finally(goHome);
  }, [isAuthenticated, hydrating, code, circles, setActiveCircle, joinCircle, toast, navigate]);

  if (!isAuthenticated) {
    const target = CODE_PATTERN.test(code) ? `${ROUTES.login}?step=circle&code=${code}` : ROUTES.login;
    return <Navigate to={target} replace state={{ from: ROUTES.dashboard }} />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas">
      <RunnerLoader />
      <p className="text-sm text-muted">Joining your circle…</p>
    </div>
  );
}

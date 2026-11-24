import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES, safeRedirect } from '../../routes';
import { useApp } from '../../store/AppContext';

/**
 * Mengarahkan user yang belum login ke /login. Tujuan asal hanya dipulihkan bila memang
 * halaman yang layak dibuka kembali; Profile dikembalikan ke Home agar sesi yang kedaluwarsa
 * tidak membuat aplikasi terbuka langsung di halaman Profile.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    const from = safeRedirect(`${location.pathname}${location.search}`);
    return <Navigate to={ROUTES.login} replace state={{ from }} />;
  }
  return <Outlet />;
}

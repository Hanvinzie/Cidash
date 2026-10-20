import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

/** Mengarahkan user yang belum login ke /login, lalu kembali ke halaman asal. */
export default function ProtectedRoute() {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/routing/ProtectedRoute';
import { ROUTES } from './routes';

// Code-splitting per halaman: tiap layar dimuat saat pertama dibuka.
const Login = lazy(() => import('./screens/Login'));
const Dashboard = lazy(() => import('./screens/Dashboard'));
const CustomQuest = lazy(() => import('./screens/CustomQuest'));
const Activity = lazy(() => import('./screens/Activity'));
const Profile = lazy(() => import('./screens/Profile'));

function PageFallback() {
  return <div className="p-10 text-center text-sm text-subtle">Loading…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Publik: login & onboarding (tanpa bottom navigation) */}
        <Route path={ROUTES.login} element={<Login />} />

        {/* Terproteksi: wajib login, memakai layout + bottom navigation */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.dashboard} element={<Dashboard />} />
            <Route path={ROUTES.customQuest} element={<CustomQuest />} />
            <Route path={ROUTES.activity} element={<Activity />} />
            <Route path={ROUTES.profile} element={<Profile />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </Suspense>
  );
}

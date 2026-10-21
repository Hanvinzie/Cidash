import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/routing/ProtectedRoute';
import HideBoot from './components/routing/HideBoot';
import RunnerLoader from './components/ui/RunnerLoader';
import { Activity, CustomQuest, Dashboard, Login, Profile } from './lazyScreens';
import { ROUTES } from './routes';

function BootFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <RunnerLoader />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<BootFallback />}>
      <Routes>
        {/* Publik: login & onboarding (tanpa bottom navigation) */}
        <Route
          path={ROUTES.login}
          element={
            <>
              <HideBoot />
              <Login />
            </>
          }
        />

        {/* Terproteksi: wajib login, memakai layout + bottom navigation (Suspense halaman ada di layout) */}
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

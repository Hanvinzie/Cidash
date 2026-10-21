import { lazyWithPreload } from './lib/lazy';

// Code-splitting per halaman. Semua chunk di-preload saat idle setelah render pertama
// (lihat App.tsx), jadi pindah tab berikutnya instan tanpa layar loading.
export const Login = lazyWithPreload(() => import('./screens/Login'));
export const Dashboard = lazyWithPreload(() => import('./screens/Dashboard'));
export const CustomQuest = lazyWithPreload(() => import('./screens/CustomQuest'));
export const Activity = lazyWithPreload(() => import('./screens/Activity'));
export const Profile = lazyWithPreload(() => import('./screens/Profile'));

// Komponen berat yang dipakai di dalam halaman.
export const RouteMap = lazyWithPreload(() => import('./components/map/RouteMap'));
export const ShareCardModal = lazyWithPreload(() => import('./components/share/ShareCardModal'));

export const ALL_CHUNKS = [Dashboard, CustomQuest, Activity, Profile, Login, RouteMap, ShareCardModal];

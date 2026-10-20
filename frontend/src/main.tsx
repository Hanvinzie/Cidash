import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppProvider } from './store/AppContext';
import { ThemeProvider } from './store/ThemeContext';
import './index.css';

if (import.meta.env.DEV) {
  // Saat dev SW Cidash nonaktif. Hapus SW/cache sisa project lain di origin
  // localhost yang sama, karena SW lama bisa menyajikan index.html milik app lain.
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then(async (regs) => {
      if (regs.length === 0) return;
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Muat ulang sekali agar halaman diambil langsung dari Vite.
      if (navigator.serviceWorker.controller) window.location.reload();
    });
  }
} else {
  // Daftarkan service worker PWA (auto update, aktif di build produksi).
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './store/AppContext';
import { ThemeProvider } from './store/ThemeContext';
import { ToastProvider } from './store/ToastContext';
import { initAppUpdate } from './lib/appUpdate';
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
}

// Daftarkan service worker PWA (build produksi) + pantau versi baru. Pemasangan menunggu tombol Update di About.
initAppUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

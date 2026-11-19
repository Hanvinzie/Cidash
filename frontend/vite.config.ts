import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };
const BUILD_TIME = new Date().toISOString();

const manifest: Partial<ManifestOptions> = {
  name: 'Cidash — Social Gamified Fitness Tracker',
  short_name: 'Cidash',
  description: 'A social, gamified fitness tracker for private, invite-only circles.',
  theme_color: '#ea2845',
  background_color: '#F6F6F8',
  id: '/',
  display: 'standalone',
  display_override: ['standalone', 'fullscreen'],
  orientation: 'portrait',
  start_url: '/',
  scope: '/',
  lang: 'en',
  categories: ['health', 'fitness', 'sports', 'social'],
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    // Ikon maskable memakai latar penuh + zona aman, jadi tidak terpotong di launcher Android.
    { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    {
      name: 'Start activity',
      short_name: 'Activity',
      url: '/activity',
      icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
    },
  ],
};

/**
 * vite-plugin-pwa hanya menyuntikkan manifest saat build. Plugin kecil ini menyajikan manifest
 * yang sama di `npm run dev`, supaya "Add to Home Screen" saat tes lewat ngrok membuka app
 * dalam mode standalone (tanpa address bar) dengan scope & start_url yang benar.
 */
function devManifest(): Plugin {
  return {
    name: 'cidash-dev-manifest',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(JSON.stringify(manifest));
      });
    },
    transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' }],
  };
}

/**
 * Menerbitkan /version.json (versi + waktu build). Halaman About membandingkannya dengan versi yang sedang
 * berjalan untuk memberi tahu ada rilis baru, tanpa menunggu service worker selesai mengunduh.
 */
function versionFile(): Plugin {
  const body = JSON.stringify({ version: pkg.version, builtAt: BUILD_TIME });
  return {
    name: 'cidash-version-file',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: body });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  // MapLibre memuat web worker-nya sendiri; pre-bundling dev Vite memutus path worker itu (peta kosong).
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // izinkan domain tunnel (ngrok) — hanya berlaku untuk dev server
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/squads': { target: 'http://localhost:3000', changeOrigin: true },
      '/quests': { target: 'http://localhost:3000', changeOrigin: true },
      '/activities': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  plugins: [
    react(),
    devManifest(),
    versionFile(),
    VitePWA({
      // 'prompt': versi baru menunggu sampai pengguna menekan Update di Profile → Settings → About.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'brand/*.svg', 'robots.txt'],
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
      },
      // SW hanya aktif di build produksi agar cache tidak mengganggu HMR saat dev.
      devOptions: {
        enabled: false,
      },
    }),
  ],
});

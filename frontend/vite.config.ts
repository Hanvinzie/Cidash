import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';

const manifest: Partial<ManifestOptions> = {
  name: 'Cidash — Social Gamified Fitness',
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
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // izinkan domain tunnel (ngrok) — hanya berlaku untuk dev server
  },
  plugins: [
    react(),
    devManifest(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
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

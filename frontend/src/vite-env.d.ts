/// <reference types="vite/client" />

/** Diinjeksi vite.config.ts dari package.json / waktu build. */
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Style vector MapLibre (tema terang / gelap). Default: OpenFreeMap (tanpa API key). */
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_MAP_STYLE_URL_DARK?: string;
  /** Repo GitHub untuk daftar kontributor di About (default: upstream fork ini). */
  readonly VITE_GITHUB_REPO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

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

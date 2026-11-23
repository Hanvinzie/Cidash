/**
 * Registry tema. Warna sebenarnya hidup di src/styles/themes.css; di sini hanya metadata untuk pemilih tema.
 *
 * Menambah tema baru = tambah satu entri di `THEMES` + dua blok CSS (terang & gelap) di themes.css.
 * Tidak ada komponen yang perlu diubah.
 */

/** Tiga warna contoh pada kartu pemilih: [latar halaman, kartu, aksen]. Samakan dengan token di themes.css. */
export type Swatch = readonly [string, string, string];

export interface ThemeDef {
  /** Dipakai sebagai nilai `data-theme` di <html> dan disimpan di localStorage. Huruf kecil, tanpa spasi. */
  id: string;
  name: string;
  description: string;
  swatch: { light: Swatch; dark: Swatch };
}

export const DEFAULT_THEME_ID = 'cidash';

export const THEMES: readonly ThemeDef[] = [
  {
    id: DEFAULT_THEME_ID,
    name: 'Cidash',
    description: 'Signature red on clean slate.',
    swatch: {
      light: ['#F6F6F8', '#FFFFFF', '#EA2845'],
      dark: ['#0B0F17', '#151B26', '#EA2845'],
    },
  },
];

/** Id yang tersimpan bisa usang (tema dihapus) atau rusak; jatuhkan ke tema bawaan. */
export function resolveThemeId(id: string | null | undefined): string {
  return THEMES.some((t) => t.id === id) ? (id as string) : DEFAULT_THEME_ID;
}

export function themeById(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

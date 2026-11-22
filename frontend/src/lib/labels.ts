/**
 * Kosakata yang tampil ke pemain. Kontrak API dan enum backend (QUEST, IN_MISSION, dsb.) tidak berubah;
 * hanya teksnya yang dijaga konsisten di satu tempat:
 *
 *   Circle Goal      target jarak harian/mingguan yang dikerjakan satu circle bersama-sama
 *   Bomb Challenge   tantangan satu lawan satu dengan taruhan koin & Rank Points
 *   Shield Ticket    tiket yang membatalkan kehilangan RP dari Bomb Challenge yang masuk
 */

/** Judul bawaan Bomb Challenge yang dikirim ke server saat membuat tantangan. */
export const BOMB_CHALLENGE_TITLE = 'Bomb Challenge';

/** Judul yang pernah tersimpan di database sebelum penamaan dirapikan. */
const LEGACY_TITLES = new Set(['P2P Bomb Mission', 'P2P Bomb Challenge', 'Bomb Mission']);

/** Judul untuk ditampilkan: judul lama dipetakan ke nama baru, judul buatan pengirim dibiarkan. */
export function displayQuestTitle(title: string | null | undefined): string | undefined {
  if (!title) return undefined;
  return LEGACY_TITLES.has(title) ? BOMB_CHALLENGE_TITLE : title;
}

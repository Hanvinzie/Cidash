import { useCallback, useEffect, useState } from 'react';

// Misi yang sudah berakhir bisa "dihapus" pengguna dengan swipe. Penghapusan hanya menyembunyikan di perangkat ini
// (disimpan per pengguna di localStorage); riwayat di server tidak diubah dan pengirim/penerima lain tidak terpengaruh.

const MAX_HIDDEN = 300;
const keyFor = (userId: string) => `cidash_hidden_quests_${userId}`;

function read(userId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useHiddenQuests(userId: string) {
  const [ids, setIds] = useState<string[]>(() => read(userId));

  // Ganti akun → muat daftar milik akun itu.
  useEffect(() => setIds(read(userId)), [userId]);

  const hide = useCallback(
    (questId: string) => {
      setIds((prev) => {
        if (prev.includes(questId)) return prev;
        const next = [...prev, questId].slice(-MAX_HIDDEN);
        try {
          localStorage.setItem(keyFor(userId), JSON.stringify(next));
        } catch {
          /* storage penuh / private mode: tetap tersembunyi selama sesi ini */
        }
        return next;
      });
    },
    [userId],
  );

  return { hidden: new Set(ids), hide };
}

import { useEffect, useState } from 'react';
import { acquireCircleChannel, type PresenceMember } from '../services/circleRealtime';

/**
 * Umumkan kehadiran saya di circle (Supabase Presence di channel bersama): online, atau sedang merekam `activity`.
 * Presence hilang otomatis saat aplikasi ditutup, tanpa tulisan ke database.
 */
export function useCirclePresence({
  circleId,
  me,
  activity,
}: {
  circleId?: string | null;
  me: { id: string; username: string };
  activity: 'run' | 'bike' | null;
}) {
  useEffect(() => {
    if (!circleId) return;
    const handle = acquireCircleChannel(circleId);
    if (!handle) return;
    handle.setPresence({ userId: me.id, username: me.username, activity });
    return () => {
      handle.setPresence(null);
      handle.release();
    };
  }, [circleId, me.id, me.username, activity]);
}

/** Anggota circle yang sedang online / sedang berlari atau bersepeda, diperbarui realtime. */
export function usePresence(circleId?: string | null): PresenceMember[] {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  useEffect(() => {
    setMembers([]);
    if (!circleId) return;
    const handle = acquireCircleChannel(circleId);
    if (!handle) return;
    const off = handle.onPresence(setMembers);
    return () => {
      off();
      handle.release();
    };
  }, [circleId]);
  return members;
}

import { toBlob } from 'html-to-image';
import { formatDuration } from './geo';
import type { ActivityLog } from '../types';

/**
 * Render node DOM ke PNG. pixelRatio 3 → kartu 360×640 menjadi 1080×1920 (rasio IG Story).
 * Tanpa `backgroundColor`: area di luar border-radius kartu tetap transparan, jadi sudutnya rounded dan tidak ada
 * sudut putih tajam. Font ditunggu dulu agar angka & wordmark tidak terekspor dengan font cadangan.
 */
export async function nodeToPng(node: HTMLElement, pixelRatio = 3): Promise<Blob> {
  await document.fonts?.ready;
  const blob = await toBlob(node, { pixelRatio, cacheBust: true });
  if (!blob) throw new Error('Failed to render the share card.');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bagikan via Web Share API (Instagram Story / WhatsApp di mobile).
 * Fallback ke unduh PNG jika browser tidak mendukung berbagi file.
 * @returns 'shared' | 'downloaded'
 */
export async function sharePng(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Cidash', text });
    return 'shared' as const;
  }
  downloadBlob(blob, filename);
  return 'downloaded' as const;
}

/** Teks bagikan: ringkasan aktivitas saja (tanpa lokasi atau data circle). */
export function shareText(log: ActivityLog): string {
  const kind = log.type === 'run' ? 'run' : 'ride';
  return `${log.distanceKm} km ${kind} in ${formatDuration(log.durationSec)} on Cidash.`;
}

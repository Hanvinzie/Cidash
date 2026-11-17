import { toBlob } from 'html-to-image';
import { formatDuration } from './geo';
import type { ActivityLog } from '../types';

/** Render node DOM ke PNG. pixelRatio 3 -> kartu 360x640 menjadi 1080x1920 (rasio IG Story). */
export async function nodeToPng(node: HTMLElement, pixelRatio = 3): Promise<Blob> {
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

/** Teks bagikan: ringkasan aktivitas + ajakan, tanpa data pribadi selain yang tampil di kartu. */
export function shareText(log: ActivityLog): string {
  const kind = log.type === 'run' ? 'run' : 'ride';
  const where = log.routeLabel && log.routeLabel !== 'Recorded workout' ? ` · ${log.routeLabel}` : '';
  const invite = log.circle ? ` Join my ${log.circle.name} circle on Cidash!` : '';
  return `${log.distanceKm} km ${kind} in ${formatDuration(log.durationSec)}${where}.${invite}`;
}

export interface SocialLink {
  id: string;
  label: string;
  href: string;
  /** Warna latar tombol (warna brand). */
  color: string;
}

/**
 * Tautan bagikan web per platform. Intent web hanya bisa membawa teks + tautan (bukan gambar);
 * untuk gambar (termasuk Instagram Story) gunakan tombol Share bawaan perangkat (Web Share API).
 */
export function socialLinks(text: string, url: string): SocialLink[] {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return [
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, color: '#25D366' },
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, color: '#111111' },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}`, color: '#2AABEE' },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`, color: '#1877F2' },
  ];
}

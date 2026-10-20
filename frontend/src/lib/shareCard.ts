import { toBlob } from 'html-to-image';

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

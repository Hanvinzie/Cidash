import { useRef, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import ShareCard from './ShareCard';
import { downloadBlob, nodeToPng, sharePng } from '../../lib/shareCard';
import type { ActivityLog } from '../../types';

interface ShareCardModalProps {
  log: ActivityLog;
  username: string;
  onClose: () => void;
}

const PREVIEW_SCALE = 0.75;

export default function ShareCardModal({ log, username, onClose }: ShareCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const filename = `cidash-${log.id}.png`;

  async function handle(action: 'share' | 'download') {
    if (!cardRef.current) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await nodeToPng(cardRef.current);
      if (action === 'download') {
        downloadBlob(blob, filename);
        setMessage('Image saved');
      } else {
        const text = log.circle
          ? `Join the ${log.circle.name} circle on Cidash! Code: ${log.circle.code}`
          : 'Come run with me on Cidash!';
        const res = await sharePng(blob, filename, text);
        setMessage(res === 'shared' ? 'Shared' : "Sharing isn't supported here, so the image was downloaded.");
      }
    } catch (e) {
      // AbortError = user closed the share sheet, not an error.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setMessage("Couldn't create the image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Share your activity" onClose={onClose}>
      {/* Pratinjau diperkecil; node asli tetap 360×640 untuk ekspor. */}
      <div
        className="mx-auto mb-4 overflow-hidden rounded-2xl shadow-xl shadow-cidash-primary/20"
        style={{ width: 360 * PREVIEW_SCALE, height: 640 * PREVIEW_SCALE }}
      >
        <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
          <ShareCard ref={cardRef} log={log} username={username} />
        </div>
      </div>

      <p className="mb-3 min-h-4 text-center text-xs font-medium text-muted" aria-live="polite">
        {message}
      </p>

      <div className="flex gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => handle('download')} aria-label="Save image">
          <Icon name="download" size={18} />
        </Button>
        <Button fullWidth disabled={busy} onClick={() => handle('share')}>
          <Icon name="share" size={16} /> {busy ? 'Preparing…' : 'Share'}
        </Button>
      </div>
    </Modal>
  );
}

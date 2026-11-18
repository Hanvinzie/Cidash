import type { ReactNode } from 'react';
import Button from './Button';
import Modal from './Modal';

interface ConfirmDialogProps {
  title: string;
  /** Penjelasan singkat akibat dari aksi ini. */
  children: ReactNode;
  confirmLabel: string;
  /** 'danger' untuk aksi yang merugikan/tidak bisa dibatalkan (kick, hapus). */
  tone?: 'primary' | 'danger';
  busy?: boolean;
  /** Mematikan tombol konfirmasi (mis. saldo koin kurang) tanpa menutup dialog. */
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Pop-up konfirmasi: pertanyaan, penjelasan akibat, lalu tombol Konfirmasi dan Batal.
 * Dialog tetap terbuka selama `busy`, supaya kegagalan tidak membuat pengguna mengira aksi berhasil.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  tone = 'primary',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      {(close) => (
        <div className="space-y-4">
          <div className="text-center text-sm text-muted">{children}</div>
          <div className="space-y-2">
            <Button
              fullWidth
              variant={tone === 'danger' ? 'danger' : 'primary'}
              className={tone === 'danger' ? '!bg-danger !text-white hover:!bg-danger/90' : ''}
              disabled={busy || confirmDisabled}
              onClick={() => void onConfirm()}
            >
              {busy ? 'Please wait…' : confirmLabel}
            </Button>
            <Button fullWidth variant="secondary" disabled={busy} onClick={() => close()}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

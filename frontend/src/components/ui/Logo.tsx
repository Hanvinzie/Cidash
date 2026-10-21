/**
 * Logo Cidash — sama dengan ikon app di Home Screen (public/pwa-512x512.png):
 * kotak merah dengan kotak putih di tengah (50% sisi).
 */
export default function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Cidash"
      className={`inline-flex shrink-0 items-center justify-center bg-cidash-primary ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
    >
      <span className="block bg-white" style={{ width: size / 2, height: size / 2, borderRadius: size * 0.03 }} />
    </span>
  );
}

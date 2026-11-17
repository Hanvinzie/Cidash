import { useTheme } from '../../store/ThemeContext';

export const LOGO_PRIMARY = '/brand/logo-cidash-primary.svg'; // tile terang, mark merah → untuk latar gelap / merah
export const LOGO_SECONDARY = '/brand/logo-cidash-secondary.svg'; // tile merah, mark terang → untuk latar terang

interface LogoProps {
  size?: number;
  className?: string;
  /**
   * Warna latar tempat logo diletakkan. Default mengikuti tema aplikasi:
   * latar gelap/merah memakai logo primary, latar terang memakai logo secondary.
   */
  on?: 'light' | 'dark';
}

/** Logo Cidash (SVG resmi di /public/brand). Memilih varian otomatis agar kontras dengan latar. */
export default function Logo({ size = 32, className = '', on }: LogoProps) {
  const { resolved } = useTheme();
  const background = on ?? (resolved === 'dark' ? 'dark' : 'light');
  return (
    <img
      src={background === 'dark' ? LOGO_PRIMARY : LOGO_SECONDARY}
      alt="Cidash"
      width={size}
      height={size}
      draggable={false}
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.14 }}
    />
  );
}

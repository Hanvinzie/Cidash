interface WordmarkProps {
  className?: string;
  /** Elemen pembungkus. Default <span>; pakai 'h1'/'h3' bila wordmark berfungsi sebagai judul. */
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}

/**
 * Wordmark merek: "CIDASH" huruf kapital dengan font Rubik One. Satu-satunya tempat merek ditulis sebagai logo teks,
 * supaya huruf dan font-nya konsisten. Ukuran dan warna diatur lewat className.
 */
export default function Wordmark({ className = '', as: Tag = 'span' }: WordmarkProps) {
  return (
    <Tag aria-label="Cidash" className={`font-brand font-normal uppercase tracking-wide ${className}`}>
      CIDASH
    </Tag>
  );
}

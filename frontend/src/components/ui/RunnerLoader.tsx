/** Animasi orang berlari (CSS di index.html, kelas .runner). Dipakai juga oleh boot splash. */
export default function RunnerLoader({ label, size = 88 }: { label?: string; size?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-cidash-primary">
      <svg
        className="runner"
        style={{ width: size, height: size }}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line className="ground" x1="4" y1="61" x2="60" y2="61" strokeWidth={2} opacity={0.35} />
        <g className="body">
          <path className="limb arm" d="M34 22 L31 31 L37 34" opacity={0.45} />
          <path className="limb leg late" d="M30 38 L33 48 L29 57" opacity={0.45} />
          <line x1="35" y1="18" x2="30" y2="38" />
          <path className="limb leg" d="M30 38 L33 48 L29 57" />
          <path className="limb arm late" d="M34 22 L31 31 L37 34" />
          <circle cx="37" cy="10" r="5" fill="currentColor" stroke="none" />
        </g>
      </svg>
      {label ? <p className="text-sm font-semibold text-subtle">{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  );
}

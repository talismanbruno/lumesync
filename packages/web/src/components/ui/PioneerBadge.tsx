interface PioneerBadgeProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Permanent recognition for people who joined Lume during its pioneer phase. */
export function PioneerBadge({
  size = 14,
  className = '',
  title = 'Pioneiro do Lume — membro da fase beta',
}: PioneerBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center drop-shadow-[0_0_7px_rgba(103,232,249,0.42)] ${className}`}
      title={title}
      aria-label={title}
    >
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <ellipse cx="9.5" cy="10" rx="6.8" ry="3.65" transform="rotate(-24 9.5 10)" stroke="#f6ca67" strokeWidth="1.55" />
        <circle cx="9.5" cy="10" r="2.45" fill="#f6ca67" />
        <circle cx="15.7" cy="6.2" r="1.6" fill="#38d9ff" />
        <path d="M4.1 3.1v3.2M2.5 4.7h3.2" stroke="#fff2c6" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

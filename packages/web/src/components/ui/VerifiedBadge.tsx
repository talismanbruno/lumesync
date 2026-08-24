interface VerifiedBadgeProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Visual trust mark reserved for Lume administrators. */
export function VerifiedBadge({ size = 14, className = '', title = 'Administrador verificado do Lume' }: VerifiedBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-accent-primary drop-shadow-[0_0_7px_rgba(0,209,255,0.35)] ${className}`}
      title={title}
      aria-label={title}
    >
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1.75 12.1 3.2l2.54-.04.74 2.43 2.08 1.46-.82 2.4.82 2.4-2.08 1.46-.74 2.43-2.54-.04L10 17.15 7.9 15.7l-2.54.04-.74-2.43-2.08-1.46.82-2.4-.82-2.4L4.62 5.6l.74-2.43 2.54.04L10 1.75Z" fill="currentColor" />
        <path d="m6.65 9.75 2.05 2.02 4.65-4.55" stroke="#050505" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

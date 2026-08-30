import { BadgeTooltip } from './BadgeTooltip';

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
    <BadgeTooltip
      name={title === 'Pioneiro do Lume — membro da fase beta' ? 'Pioneiro do Lume' : title}
      label={title}
      className={`inline-flex shrink-0 items-center justify-center drop-shadow-[0_1px_2px_rgba(161,104,0,0.35)] ${className}`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="lume-pioneer-gold" x1="5" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFE477" />
            <stop offset="0.48" stopColor="#F7BF2A" />
            <stop offset="1" stopColor="#E69A12" />
          </linearGradient>
        </defs>
        <path
          d="M12 1.4l2.25 2.05 3.02-.28.55 2.98 2.7 1.4-1.28 2.75 1.28 2.75-2.7 1.4-.55 2.98-3.02-.28L12 19.2l-2.25-2.05-3.02.28-.55-2.98-2.7-1.4 1.28-2.75-1.28-2.75 2.7-1.4.55-2.98 3.02.28L12 1.4z"
          fill="url(#lume-pioneer-gold)"
          stroke="#D48D0A"
          strokeWidth="0.65"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10.3" r="5.8" fill="#EBA619" fillOpacity="0.5" stroke="#FFF0A6" strokeWidth="0.65" />
        <path
          d="M12 5.85l.95 2.75 2.7.95-2.7.95L12 13.25l-.95-2.75-2.7-.95 2.7-.95L12 5.85z"
          fill="white"
        />
        <path
          d="M9.35 14.25c1.55.85 3.75.85 5.3 0"
          stroke="white"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </BadgeTooltip>
  );
}

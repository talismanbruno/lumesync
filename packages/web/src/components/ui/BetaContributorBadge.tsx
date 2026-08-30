import { useId } from 'react';
import { BadgeTooltip } from './BadgeTooltip';

/** A faceted cyan medal with a gold spark: distinct from the pioneer rosette. */
export function BetaContributorBadge({ size = 16, className = '' }: { size?: number; className?: string }) {
  const gradientId = useId();
  const label = 'Colaborador Beta — ajudou a melhorar o Lume';
  return (
    <BadgeTooltip name="Colaborador Beta" label={label} className={className}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="5" y1="2" x2="20" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9CF7EB" />
            <stop offset=".5" stopColor="#29C6D8" />
            <stop offset="1" stopColor="#4373D9" />
          </linearGradient>
        </defs>
        <path d="m7 15-2 7 4-1 3 2 2-8M13 15l2 8 3-2 4 1-3-8" fill="#27758D" stroke="#8DEEE0" strokeWidth=".6" />
        <path d="m12 1 8 4v9l-8 5-8-5V5l8-4Z" fill={`url(#${gradientId})`} stroke="#B2FFF0" strokeWidth=".8" />
        <path d="m12 3.5 5.8 3v6.3L12 16.5l-5.8-3.7V6.5L12 3.5Z" fill="#0D3D60" stroke="#8DEEE0" strokeWidth=".6" />
        <path d="m12 5.4 1.55 3.2 3.55.5-2.55 2.5.6 3.5L12 13.45 8.85 15.1l.6-3.5L6.9 9.1l3.55-.5L12 5.4Z" fill="#FFE18A" stroke="#FFF4CC" strokeWidth=".5" strokeLinejoin="round" />
      </svg>
    </BadgeTooltip>
  );
}

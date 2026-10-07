export function CompassIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5v.5M19 12h-.5M12 19v-.5M5 12h.5" opacity=".5" />
      <g className="lume-motion-needle"><path d="m17 7-3 7-7 3 3-7 7-3Z" />
      <path d="m17 7-3 7-4-4 7-3Z" fill="currentColor" stroke="none" /></g>
    </svg>
  );
}

export function PeopleIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="7" r="3.4" />
      <path d="M4.5 19c0-4.1 2.6-6.3 7.5-6.3s7.5 2.2 7.5 6.3v.7c0 .8-.6 1.3-1.4 1.3H5.9c-.8 0-1.4-.5-1.4-1.3V19Z" />
    </svg>
  );
}

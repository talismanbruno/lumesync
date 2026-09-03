import { useUIStore } from '../../stores/uiStore';

export function BugReportButton() {
  const isMobile = useUIStore((state) => state.isMobile);
  const openModal = useUIStore((state) => state.openModal);
  return (
    <button
      type="button"
      onClick={() => openModal('bugReport')}
      className={`fixed z-[120] flex items-center gap-2 rounded-full border border-accent-primary/25 bg-surface-elevated/90 px-3 py-2 text-xs font-semibold text-txt-secondary shadow-lg backdrop-blur-md transition hover:border-accent-primary/60 hover:text-txt-primary hover:-translate-y-0.5 ${isMobile ? 'right-3 bottom-[calc(74px+env(safe-area-inset-bottom))]' : 'right-5 bottom-5'}`}
      aria-label="Relatar um bug"
      title="Relatar um bug"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M9 9h6v8a3 3 0 0 1-6 0V9Z" />
        <path d="M10 9V7a2 2 0 0 1 4 0v2M5 13h4m6 0h4M6 18l3-1m6 0 3 1M7 8l2 2m8-2-2 2" strokeLinecap="round" />
      </svg>
      {!isMobile && <span>Relatar bug</span>}
    </button>
  );
}

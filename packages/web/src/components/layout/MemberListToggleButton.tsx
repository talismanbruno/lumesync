import React from 'react';
import { useUIStore } from '../../stores/uiStore';

export function MemberListToggleButton() {
  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const memberListOpen = useUIStore((s) => s.memberListOpen);

  return (
    <button
      onClick={toggleMemberList}
      className={`lume-header-orbit w-9 h-8 flex items-center justify-center transition-all rounded-xl ${
        memberListOpen ? 'is-active text-accent-primary' : 'text-txt-tertiary hover:text-accent-primary'
      }`}
      title={memberListOpen ? 'Ocultar pessoas' : 'Mostrar pessoas'}
      aria-pressed={memberListOpen}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M15 4v16M18 8h.01M18 12h.01M18 16h.01" />
      </svg>
    </button>
  );
}

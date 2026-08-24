import React from 'react';
import { useUIStore } from '../../stores/uiStore';

export function MemberListToggleButton() {
  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const memberListOpen = useUIStore((s) => s.memberListOpen);

  return (
    <button
      onClick={toggleMemberList}
      className={`lume-header-orbit w-9 h-8 flex items-center justify-center transition-all rounded-xl ${
        memberListOpen ? 'is-active text-cyan-200' : 'text-txt-tertiary hover:text-cyan-200'
      }`}
      title="Mostrar pessoas na órbita"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M4.2 13.5a8 8 0 0 1 0-3M19.8 10.5a8 8 0 0 1 0 3M7.1 6.4a8 8 0 0 1 2.6-1.5M14.3 4.9a8 8 0 0 1 2.6 1.5M7.1 17.6a8 8 0 0 0 2.6 1.5M14.3 19.1a8 8 0 0 0 2.6-1.5" />
        <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="20" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

import { t as uiText } from '../../i18n';
import React from 'react';
import { useUIStore } from '../../stores/uiStore';

export function MemberListToggleButton() {
  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const memberListOpen = useUIStore((s) => s.memberListOpen);

  return (
    <button
      onClick={toggleMemberList}
      className={`lume-header-toggle w-9 h-8 flex items-center justify-center transition-all rounded-xl ${
        memberListOpen ? 'is-active text-cyan-200' : 'text-txt-tertiary hover:text-cyan-200'
      }`}
      title={uiText("Mostrar pessoas")}
      aria-label={uiText("Mostrar pessoas")}
      aria-pressed={memberListOpen}
    >
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <g opacity=".6">
          <circle cx="17.5" cy="7.5" r="2.7" />
          <path d="M15 12c4.4-.5 7 1.5 7 4.5V19h-5v-2.2c0-2-.6-3.5-2-4.8Z" />
        </g>
        <circle cx="9" cy="10" r="3.1" />
        <path d="M2.5 22v-3.1c0-3 2.2-4.9 6.5-4.9s6.5 1.9 6.5 4.9V22h-13Z" />
      </svg>
    </button>
  );
}

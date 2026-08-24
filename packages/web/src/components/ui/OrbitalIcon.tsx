type OrbitalIconName =
  | 'mic' | 'audio' | 'tune' | 'call' | 'video' | 'personAdd' | 'search'
  | 'camera' | 'screen' | 'image' | 'clear' | 'friends' | 'hangup' | 'transfer';

export function OrbitalIcon({ name, size = 20, cut = false, className = '' }: { name: OrbitalIconName; size?: number; cut?: boolean; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const glyph = {
    mic: <><path d="M9 7.5v4.2a3 3 0 0 0 6 0V7.5a3 3 0 0 0-6 0Z"/><path d="M6.5 12a5.5 5.5 0 0 0 11 0M12 17.5V21M9.5 21h5"/></>,
    audio: <><path d="M5 13a7 7 0 0 1 14 0"/><path d="M5 13v5a2 2 0 0 0 2 2h1v-7H5ZM19 13v5a2 2 0 0 1-2 2h-1v-7h3Z"/><path d="M8 7.3c2.5-1.7 5.5-1.7 8 0" opacity=".45"/></>,
    tune: <><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
    call: <><path d="M7 5c-.8 0-2 1.2-2 2.2 0 5.4 6.4 11.8 11.8 11.8 1 0 2.2-1.2 2.2-2l-3.2-2.2-1.8 1.4c-2.8-1.1-5.1-3.4-6.2-6.2l1.4-1.8L7 5Z"/><path d="M13.5 5.5c2.6.3 4.7 2.4 5 5" opacity=".5"/></>,
    video: <><rect x="4" y="6" width="12" height="12" rx="3"/><path d="m16 10 4-2v8l-4-2"/><circle cx="10" cy="12" r="1.5" opacity=".45"/></>,
    personAdd: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 2.5-5.5 5.5-5.5s5 2 5.5 5.5M18.5 8v6M15.5 11h6"/></>,
    search: <><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/><path d="M8.2 10.5h4.6" opacity=".45"/></>,
    camera: <><path d="M5 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><path d="m17 10 4-2v8l-4-2"/><circle cx="10" cy="12" r="2"/></>,
    screen: <><rect x="3" y="5" width="18" height="12" rx="3"/><path d="M8 21h8M12 17v4M9 11l3-3 3 3M12 8v6"/></>,
    image: <><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4-4 3 3 2-2 5 5"/></>,
    clear: <><path d="M3 9c2.3 0 2.3-3 4.6-3s2.3 6 4.6 6 2.3-4 4.6-4S19 10 21 10M3 15c2 0 2-2 4-2s2 4 4 4 2-3 4-3 2 1 6 1"/><circle cx="19" cy="5" r="2" opacity=".55"/></>,
    friends: <><circle cx="10" cy="9" r="3"/><path d="M4 19c.5-3.4 2.4-5 6-5s5.5 1.6 6 5"/><circle cx="18" cy="9" r="2" opacity=".5"/><path d="M17 14c2.2.1 3.4 1.4 3.8 3.5" opacity=".5"/></>,
    hangup: <path d="M4 15c4.7-4 11.3-4 16 0l-3 3-2.5-2v-2.1a9 9 0 0 0-5 0V16L7 18l-3-3Z"/>,
    transfer: <><path d="M5 8h11M13 5l3 3-3 3M19 16H8M11 13l-3 3 3 3"/><circle cx="12" cy="12" r="9" opacity=".22"/></>,
  }[name];

  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>{glyph}{cut && <path d="M3 3 21 21" strokeWidth="2.2" />}</svg>;
}

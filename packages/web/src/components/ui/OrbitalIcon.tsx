import { useIconMotion } from '../../hooks/useIconMotion';

type OrbitalIconName =
  | 'plus' | 'mic' | 'audio' | 'tune' | 'call' | 'video' | 'personAdd' | 'search'
  | 'camera' | 'screen' | 'quality' | 'image' | 'clear' | 'friends' | 'hangup' | 'transfer' | 'download' | 'chat';

export function OrbitalIcon({ name, size = 20, cut = false, className = '' }: { name: OrbitalIconName; size?: number; cut?: boolean; className?: string }) {
  const motionRef = useIconMotion(name);
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const glyph = {
    plus: <path d="M12 5v14M5 12h14" />,
    mic: <><path className="lume-motion-mic-capsule" d="M9 7.5v4.2a3 3 0 0 0 6 0V7.5a3 3 0 0 0-6 0Z"/><path className="lume-motion-mic-support" d="M6.5 12a5.5 5.5 0 0 0 11 0M12 17.5V21M9.5 21h5"/></>,
    audio: <>{!cut && <g className="lume-motion-audio-echo"><path className="lume-motion-echo-left" d="M2 11c-1.3 2-1.3 4 0 6"/><path className="lume-motion-echo-right" d="M22 11c1.3 2 1.3 4 0 6"/></g>}<path d="M5 13a7 7 0 0 1 14 0"/><path d="M5 13v5a2 2 0 0 0 2 2h1v-7H5ZM19 13v5a2 2 0 0 1-2 2h-1v-7h3Z"/><path d="M8 7.3c2.5-1.7 5.5-1.7 8 0" opacity=".45"/></>,
    tune: <><path d="m9.5 3-.6 2.4-1.6.9-2.4-.7-2.5 4.3 1.8 1.7v1.8l-1.8 1.7 2.5 4.3 2.4-.7 1.6.9.6 2.4h5l.6-2.4 1.6-.9 2.4.7 2.5-4.3-1.8-1.7v-1.8l1.8-1.7-2.5-4.3-2.4.7-1.6-.9-.6-2.4h-5Z"/><circle cx="12" cy="12" r="3"/></>,
    call: <><path d="M7 5c-.8 0-2 1.2-2 2.2 0 5.4 6.4 11.8 11.8 11.8 1 0 2.2-1.2 2.2-2l-3.2-2.2-1.8 1.4c-2.8-1.1-5.1-3.4-6.2-6.2l1.4-1.8L7 5Z"/><path d="M13.5 5.5c2.6.3 4.7 2.4 5 5" opacity=".5"/></>,
    video: <><rect x="4" y="6" width="12" height="12" rx="3"/><path d="m16 10 4-2v8l-4-2"/><circle cx="10" cy="12" r="1.5" opacity=".45"/></>,
    personAdd: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 2.5-5.5 5.5-5.5s5 2 5.5 5.5M18.5 8v6M15.5 11h6"/></>,
    search: <><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/><path d="M8.2 10.5h4.6" opacity=".45"/></>,
    camera: <><path d="M5 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><path d="m17 10 4-2v8l-4-2"/><circle cx="10" cy="12" r="2"/></>,
    screen: <><rect x="3" y="5" width="18" height="12" rx="3"/><path d="M8 21h8M12 17v4M9 11l3-3 3 3M12 8v6"/></>,
    quality: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 10V8h3M17 11v2h-3"/></>,
    image: <><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4-4 3 3 2-2 5 5"/></>,
    clear: <><rect x="6.5" y="3" width="6" height="11" rx="3"/><path d="M3.5 11a6 6 0 0 0 12 0M9.5 17v4M6.5 21h6M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3Z"/></>,
    friends: <><circle cx="10" cy="9" r="3"/><path d="M4 19c.5-3.4 2.4-5 6-5s5.5 1.6 6 5"/><circle cx="18" cy="9" r="2" opacity=".5"/><path d="M17 14c2.2.1 3.4 1.4 3.8 3.5" opacity=".5"/></>,
    hangup: <path d="M4 15c4.7-4 11.3-4 16 0l-3 3-2.5-2v-2.1a9 9 0 0 0-5 0V16L7 18l-3-3Z"/>,
    transfer: <><path d="M5 8h11M13 5l3 3-3 3M19 16H8M11 13l-3 3 3 3"/><circle cx="12" cy="12" r="9" opacity=".22"/></>,
    download: <><path className="lume-motion-download-arrow" d="M12 3v12m-5-5 5 5 5-5"/><path className="lume-motion-download-tray" d="M5 16v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/></>,
    chat: <><path d="M6 4h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H9l-6 3V7a3 3 0 0 1 3-3Z"/><path d="M8 9h8M8 13h5"/></>,
  }[name];

  return <svg ref={motionRef} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><g className={`lume-motion-${name}${cut ? ' is-cut' : ''}`}>{glyph}</g>{cut && <path d="M3 3 21 21" strokeWidth="2.2" />}</svg>;
}

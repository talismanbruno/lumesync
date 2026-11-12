import { useEffect, useMemo, useRef, useState } from 'react';
import { deriveGridTiles } from '../../hooks/useLiveKit';
import { t as uiText } from '../../i18n';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { exitVoiceFullscreen, getVoiceFullscreenElement } from '../../utils/voiceFullscreen';
import { VoiceControlBar } from './VoiceControlBar';
import { VoiceGrid } from './VoiceGrid';
import { VoiceUser } from './VoiceUser';

export function CompactCallPanel({ active }: { active: boolean }) {
  const participants = useVoiceStore(s => s.participants);
  const connected = useVoiceStore(s => s.isLiveKitConnected);
  const connectionError = useVoiceStore(s => s.connectionError);
  const voiceFullscreen = useUIStore(s => s.voiceFullscreen);
  const setVoiceFullscreen = useUIStore(s => s.setVoiceFullscreen);
  const panelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const tiles = useMemo(() => deriveGridTiles(participants), [participants]);
  const hasMedia = tiles.some(tile => tile.kind === 'stream' || tile.participant.isCameraOn);
  const showMedia = active && hasMedia && expanded;

  useEffect(() => {
    if (!active || !hasMedia) setExpanded(false);
  }, [active, hasMedia]);

  useEffect(() => {
    if (!showMedia) return;
    const panel = panelRef.current;
    const syncFullscreen = () => setVoiceFullscreen(getVoiceFullscreenElement() === panel);
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      if (getVoiceFullscreenElement() === panel) void exitVoiceFullscreen().catch(() => {});
      setVoiceFullscreen(false);
      useVoiceStore.getState().setFocusedParticipant(null);
    };
  }, [showMedia, setVoiceFullscreen]);

  useEffect(() => {
    if (showMedia && !voiceFullscreen && getVoiceFullscreenElement() === panelRef.current) {
      void exitVoiceFullscreen().catch(() => {});
    }
  }, [showMedia, voiceFullscreen]);

  const status = connectionError ? uiText("Falha na conexão")
    : connected ? uiText("Waiting for others to join...") : uiText("Conectando…");

  return (
    <section
      aria-label={uiText("Chamada")}
      aria-hidden={!active}
      className={`lume-compact-call ${active ? 'is-active' : ''}`}
    >
      <div className="lume-compact-call-clip">
        <div
          ref={panelRef}
          data-voice-fullscreen={showMedia ? '' : undefined}
          className={`lume-compact-call-panel ${showMedia && voiceFullscreen ? 'lume-voice-expanded' : ''}`}
        >
          <div className="lume-call-roster">
            {active && (!connected || connectionError || participants.length === 0 ? (
              <p role="status" className={`lume-call-status ${connectionError ? 'text-txt-danger' : 'text-txt-secondary'}`}>
                {status}
              </p>
            ) : (
              <div className="lume-call-participant-scroll">
                <div className="lume-call-participants">
                  {tiles.map(tile => tile.kind === 'user' && <VoiceUser key={tile.key} tile={tile} compact />)}
                </div>
              </div>
            ))}
          </div>
          {showMedia && (
            <div className="lume-compact-call-media">
              <VoiceGrid participants={participants} mediaOnly />
            </div>
          )}
          <VoiceControlBar
            active={active}
            mediaExpanded={showMedia}
            onToggleMedia={active && hasMedia ? () => setExpanded(value => !value) : undefined}
          />
        </div>
      </div>
    </section>
  );
}

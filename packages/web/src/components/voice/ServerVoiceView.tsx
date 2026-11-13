import { useEffect, useRef } from 'react';
import { t as uiText } from '../../i18n';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { exitVoiceFullscreen, getVoiceFullscreenElement } from '../../utils/voiceFullscreen';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { VoiceControlBar } from './VoiceControlBar';
import { VoiceGrid } from './VoiceGrid';

/** Server voice rooms keep their full participant grid and optional side chat. */
export function ServerVoiceView({ channelId, channelName }: { channelId: string; channelName: string }) {
  const participants = useVoiceStore(s => s.participants);
  const connected = useVoiceStore(s => s.isLiveKitConnected);
  const connectionError = useVoiceStore(s => s.connectionError);
  const chatOpen = useUIStore(s => s.voiceChatOpen);
  const toggleChat = useUIStore(s => s.toggleVoiceChat);
  const fullscreen = useUIStore(s => s.voiceFullscreen);
  const setFullscreen = useUIStore(s => s.setVoiceFullscreen);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const syncFullscreen = () => setFullscreen(getVoiceFullscreenElement() === container);
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      if (getVoiceFullscreenElement() === container) void exitVoiceFullscreen().catch(() => {});
      setFullscreen(false);
    };
  }, [setFullscreen]);

  useEffect(() => {
    if (!fullscreen && getVoiceFullscreenElement() === containerRef.current) {
      void exitVoiceFullscreen().catch(() => {});
    }
  }, [fullscreen]);

  return (
    <div ref={containerRef} data-voice-fullscreen="" className={'relative flex flex-1 min-h-0 min-w-0 flex-col bg-surface-base ' + (fullscreen ? 'lume-voice-expanded' : '')}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
        <p role="status" className={'text-xs ' + (connectionError ? 'text-txt-danger' : connected ? 'text-status-online' : 'text-status-idle')}>
          {connectionError ? uiText('Falha na conexão') : connected ? uiText('Connected') : uiText('Conectando…')}
        </p>
        <button type="button" onClick={toggleChat} aria-expanded={chatOpen} aria-controls="server-voice-chat" className="rounded px-3 py-1 text-sm text-txt-secondary hover:bg-interactive-hover hover:text-txt-primary">
          {chatOpen ? uiText('Fechar chat') : uiText('Chat')}
        </button>
      </div>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col lg:flex-row">
        <section aria-label={channelName} className="flex flex-1 min-h-0 min-w-0 flex-col">
          <div className="flex flex-1 min-h-0 overflow-hidden p-2"><VoiceGrid participants={participants} /></div>
          <VoiceControlBar active mediaExpanded />
        </section>
        <section id="server-voice-chat" hidden={!chatOpen} className={'relative flex min-h-0 min-w-0 flex-col bg-surface-chat lg:w-80 lg:shrink-0 border-l border-border-soft ' + (chatOpen ? 'flex-1 lg:flex-none' : 'hidden')}>
          <MessageList channelId={channelId} />
          <MessageInput channelId={channelId} channelName={channelName} />
        </section>
      </div>
    </div>
  );
}

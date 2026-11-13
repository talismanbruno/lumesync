import { useEffect, useRef } from 'react';
import { t as uiText } from '../../i18n';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { exitVoiceFullscreen, getVoiceFullscreenElement } from '../../utils/voiceFullscreen';
import { joinVoiceChannel } from '../../utils/voice';
import { MemberListToggleButton } from '../layout/MemberListToggleButton';
import { TransferIndicator } from '../layout/TransferIndicator';
import { VoiceGrid } from './VoiceGrid';
import { VoiceChatPanel } from './VoiceChatPanel';
import { ServerVoiceControlBar as VoiceControlBar } from './ServerVoiceControlBar';

// Server voice workspace restored from edf27d08, independent of private calls.
export function ServerVoiceView({ channelId, channelName }: { channelId: string; channelName: string }) {
  const currentChannelId = channelId;
  const channel = { name: channelName };
  const currentVoiceChannelId = useVoiceStore(s => s.currentVoiceChannelId);
  const participants = useVoiceStore(s => s.participants);
  const isLiveKitConnected = useVoiceStore(s => s.isLiveKitConnected);
  const connectionError = useVoiceStore(s => s.connectionError);
  const voiceChatOpen = useUIStore(s => s.voiceChatOpen);
  const voiceFullscreen = useUIStore(s => s.voiceFullscreen);
  const setVoiceFullscreen = useUIStore(s => s.setVoiceFullscreen);
  const voiceContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = voiceContainerRef.current;
    const syncFullscreen = () => setVoiceFullscreen(!!container && getVoiceFullscreenElement() === container);
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      if (container && getVoiceFullscreenElement() === container) void exitVoiceFullscreen().catch(() => {});
      setVoiceFullscreen(false);
    };
  }, [setVoiceFullscreen]);

  useEffect(() => {
    if (!voiceFullscreen && voiceContainerRef.current && getVoiceFullscreenElement() === voiceContainerRef.current) {
      void exitVoiceFullscreen().catch(() => {});
    }
  }, [voiceFullscreen]);

    const isInThisChannel = currentVoiceChannelId === currentChannelId;

    if (!isInThisChannel) {
      return (
        <div className="flex-1 flex flex-col bg-surface-base">
          <div className="h-14 px-5 flex items-center justify-between border-b border-border-hard flex-shrink-0 bg-surface-base">
            <div className="flex items-center gap-[10px]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary">
                <path d="M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C16.48 9.4 17 10.67 17 12S16.48 14.6 15.54 15.54L14.12 14.12C14.69 13.55 15 12.79 15 12S14.69 10.45 14.12 9.88L15.54 8.46Z" />
              </svg>
              <span className="font-bold text-[15px] tracking-[-0.02em] text-txt-primary">{channel.name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <TransferIndicator />
              <MemberListToggleButton />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-8 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,108,246,0.12)_0%,transparent_70%)] animate-gradient-pulse pointer-events-none" />
            <div className="text-center relative z-10">
              <h2 className="text-[28px] font-bold text-white mb-3">{channel.name}</h2>
              <p className="text-txt-tertiary text-[15px]">{uiText("No one is currently in this voice channel.")}</p>
            </div>
            <button
              onClick={() => joinVoiceChannel(currentChannelId, useVoiceStore.getState().connectFn ?? undefined)}
              className="relative z-10 px-8 py-3 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold rounded-full transition-all text-[15px] shadow-[0_4px_20px_rgba(124,108,246,0.3)]"
            >
              {uiText("Join Voice")}</button>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={voiceContainerRef}
        data-voice-fullscreen=""
        className={`flex-1 flex flex-col bg-surface-base min-w-0 min-h-0 group/voice relative ${voiceFullscreen ? 'lume-voice-expanded' : ''}`}
      >
        <div className={`h-14 px-5 flex items-center justify-between border-b border-border-hard flex-shrink-0 bg-surface-base transition-opacity duration-300 ${voiceFullscreen ? 'opacity-0 hover:opacity-100' : ''}`}>
          <div className="flex items-center gap-[10px]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary">
              <path d="M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C16.48 9.4 17 10.67 17 12S16.48 14.6 15.54 15.54L14.12 14.12C14.69 13.55 15 12.79 15 12S14.69 10.45 14.12 9.88L15.54 8.46Z" />
            </svg>
            <span className="font-bold text-[15px] tracking-[-0.02em] text-txt-primary">{channel.name}</span>
            {connectionError ? (
              <span className="text-xs text-txt-danger font-medium ml-2">{uiText("Connection Failed")}</span>
            ) : isLiveKitConnected ? (
              <>
                <span className="text-xs text-status-online font-medium ml-2">{uiText("Connected")}</span>
                <span className="text-xs text-txt-tertiary ml-1">{participants.length} {uiText(" connected")}</span>
              </>
            ) : (
              <span className="text-xs text-status-idle font-medium ml-2">{uiText("Connecting...")}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <TransferIndicator />
            <MemberListToggleButton />
          </div>
        </div>

        <div className="lume-server-call-workspace flex-1 min-h-0 min-w-0">
          <div className={`lume-server-call-layout ${voiceChatOpen ? '' : 'is-chat-closed'}`}>
            <section className="lume-server-call-video min-w-0 min-h-0 flex flex-col">
              <div className="flex-1 flex min-h-0 overflow-hidden p-2"><VoiceGrid participants={participants} /></div>
              <VoiceControlBar docked />
            </section>
            <section hidden={!voiceChatOpen} className={`lume-server-call-chat relative min-w-0 min-h-0 ${voiceChatOpen ? '' : 'hidden'}`}>
              <VoiceChatPanel channelId={currentChannelId} channelName={channel.name} />
            </section>
          </div>
        </div>

      </div>
    );
}

import { t as uiText } from '../../i18n';
import React, { useEffect, useState, useRef } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useSpaceStore, getChannelOrigin, getMyUserIdForOrigin } from '../../stores/spaceStore';
import { ScreenShareSettingsPopover } from './ScreenShareSettingsPopover';
import { hasPermissionBit, PermissionBits } from '../../utils/permissions';
import { handleMuteAction, handleDeafenAction, handleCameraAction, handleScreenShareAction, handleDisconnectAction } from '../../utils/voiceActions';
import { requestMicPermission } from '../../utils/voice';
import { toggleVoiceFullscreen } from '../../utils/voiceFullscreen';
import { OrbitalIcon } from '../ui/OrbitalIcon';

const btnBase = 'w-10 h-10 flex items-center justify-center rounded-full transition-colors';
const btnDefault = `${btnBase} bg-surface-channel text-txt-secondary hover:bg-surface-elevated hover:text-txt-primary`;
const btnActive = (color: string) => `${btnBase} bg-${color}/20 text-${color} hover:bg-${color}/30`;
const btnGreen = `${btnBase} bg-surface-channel text-status-online hover:bg-surface-elevated`;

export function VoiceControlBar({ docked = false, chatOpen, onToggleChat }: { docked?: boolean; chatOpen?: boolean; onToggleChat?: () => void } = {}) {
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const isCameraOn = useVoiceStore((s) => s.isCameraOn);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const micPermissionDenied = useVoiceStore((s) => s.micPermissionDenied);
  const globalVoiceChatOpen = useUIStore((s) => s.voiceChatOpen);
  const voiceChatOpen = chatOpen ?? globalVoiceChatOpen;
  const toggleVoiceChat = useUIStore((s) => s.toggleVoiceChat);
  const voiceFullscreen = useUIStore((s) => s.voiceFullscreen);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const myUser = useAuthStore((s) => s.user);
  const spaceId = useSpaceStore((s) => currentVoiceChannelId ? s.channelToSpaceMap.get(currentVoiceChannelId) : null);
  const myOriginId = useSpaceStore((s) => currentVoiceChannelId ? getMyUserIdForOrigin(getChannelOrigin(currentVoiceChannelId)) : s.members.find(m => m.userId === myUser?.id)?.userId ?? myUser?.id);
  const spaceMutedUserIds = useVoiceStore((s) => s.spaceMutedUserIds);
  const spaceDeafenedUserIds = useVoiceStore((s) => s.spaceDeafenedUserIds);
  const isSpaceMuted = !!(myOriginId && spaceId && spaceMutedUserIds.has(`${spaceId}:${myOriginId}`));
  const isSpaceDeafened = !!(myOriginId && spaceId && spaceDeafenedUserIds.has(`${spaceId}:${myOriginId}`));
  const activeDmCall = useVoiceStore((s) => s.activeDmCall);
  const channelPerms = useSpaceStore((s) => currentVoiceChannelId ? s.channelPermissions.get(currentVoiceChannelId) : undefined);
  const isDmCall = !!activeDmCall;
  const canSpeak = isDmCall || hasPermissionBit(channelPerms, PermissionBits.SPEAK);
  const canStream = isDmCall || hasPermissionBit(channelPerms, PermissionBits.STREAM);
  const [qualityOpen, setQualityOpen] = useState(false);
  const qualityBtnRef = useRef<HTMLButtonElement>(null);

  const handleMute = React.useCallback(() => {
    handleMuteAction(isSpaceMuted, isSpaceDeafened);
  }, [isSpaceMuted, isSpaceDeafened]);

  const handleDeafen = React.useCallback(() => {
    handleDeafenAction(isSpaceDeafened);
  }, [isSpaceDeafened]);

  const handleCamera = () => handleCameraAction();

  const handleScreenShare = () => handleScreenShareAction();

  const handleDisconnect = () => handleDisconnectAction();

  const handleFullscreen = (event: React.MouseEvent<HTMLButtonElement>) => {
    void toggleVoiceFullscreen(event.currentTarget.closest<HTMLElement>('[data-voice-fullscreen]'));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && voiceFullscreen) {
        useUIStore.getState().setVoiceFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voiceFullscreen]);

  return (
    <>
    {micPermissionDenied && (
      <div className={docked ? 'mx-3 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-accent-amber/30 bg-surface-elevated px-3 py-2' : 'absolute bottom-[82px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl border border-accent-amber/30 bg-surface-elevated/95 px-4 py-3 shadow-elevation-high backdrop-blur-xl'}>
        <div className="min-w-0">
          <p className="whitespace-nowrap text-xs font-semibold text-accent-amber">{uiText("Microfone sem permissão")}</p>
          <p className="whitespace-nowrap text-[11px] text-txt-tertiary">{uiText("Você entrou apenas para ouvir.")}</p>
        </div>
        <button
          type="button"
          onClick={() => { void requestMicPermission(); }}
          className="whitespace-nowrap rounded-lg bg-accent-amber/20 px-3 py-1.5 text-[11px] font-semibold text-accent-amber hover:bg-accent-amber/30"
        >
          {uiText("Permitir microfone")}</button>
      </div>
    )}
    <div className={docked ? 'lume-call-controls shrink-0 p-2 border-t border-border-soft' : 'absolute bottom-6 left-1/2 -translate-x-1/2 z-20 opacity-0 translate-y-4 group-hover/voice:opacity-100 group-hover/voice:translate-y-0 focus-within:opacity-100 focus-within:translate-y-0 transition-all duration-300 ease-out'}>
      <div className={docked ? 'flex flex-wrap justify-center items-center gap-1' : 'flex items-center gap-1.5 rounded-full px-3 py-2 glass-bubble'}>
        {/* Mute */}
        <button
          onClick={handleMute}
          className={(isSpaceMuted || isSpaceDeafened)
            ? `${btnBase} bg-accent-amber/20 text-accent-amber cursor-not-allowed`
            : isMuted || isDeafened
              ? `${btnBase} bg-accent-rose/20 text-txt-danger hover:bg-accent-rose/30`
              : btnDefault
          }
          title={(isSpaceMuted || isSpaceDeafened) ? (isMuted ? uiText("Silenciado na comunidade e por você") : uiText("Silenciado na comunidade")) : isMuted ? uiText("Ativar microfone (M)") : uiText("Silenciar microfone (M)")}
        >
          <OrbitalIcon name="mic" cut={isMuted || isDeafened || isSpaceMuted || isSpaceDeafened} />
        </button>

        {/* Deafen */}
        <button
          onClick={handleDeafen}
          className={isSpaceDeafened
            ? `${btnBase} bg-accent-amber/20 text-accent-amber cursor-not-allowed`
            : isDeafened
              ? `${btnBase} bg-accent-rose/20 text-txt-danger hover:bg-accent-rose/30`
              : btnDefault
          }
          title={isSpaceDeafened ? uiText("Áudio bloqueado na comunidade") : isDeafened ? uiText("Ativar áudio (D)") : uiText("Desativar áudio (D)")}
        >
          <OrbitalIcon name="audio" cut={isDeafened || isSpaceDeafened} />
        </button>

        {/* Camera */}
        {canSpeak && (
          <button
            onClick={handleCamera}
            className={isCameraOn ? btnGreen : btnDefault}
            title={isCameraOn ? uiText("Desligar câmera") : uiText("Ligar câmera")}
          >
            {isCameraOn ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z" />
                <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}

        {/* Screen Share */}
        {canStream && (
          <button
            onClick={handleScreenShare}
            className={isScreenSharing ? btnGreen : btnDefault}
            title={isScreenSharing ? uiText("Parar compartilhamento") : uiText("Compartilhar tela")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18C21.1 18 22 17.1 22 16V6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V16C2 17.1 2.9 18 4 18H0V20H24V18H20ZM4 6H20V16H4V6Z" />
              <path d="M15 11L11 14V12H9V10H11V8L15 11Z" />
            </svg>
          </button>
        )}

        {/* Video Quality */}
        <button
          ref={qualityBtnRef}
          onClick={() => setQualityOpen(!qualityOpen)}
          className={qualityOpen
            ? `${btnBase} bg-surface-channel text-txt-primary`
            : btnDefault
          }
          title="Qualidade da transmissão"
          aria-label="Qualidade da transmissão"
        >
          <OrbitalIcon name="quality" />
        </button>
        <ScreenShareSettingsPopover open={qualityOpen} onClose={() => setQualityOpen(false)} anchorRef={qualityBtnRef} />

        {/* Separator */}
        <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

        {/* Chat Toggle */}
        <button
          onClick={onToggleChat ?? toggleVoiceChat}
          className={voiceChatOpen
            ? `${btnBase} bg-surface-channel text-txt-primary`
            : btnDefault
          }
          title={voiceChatOpen ? uiText("Ocultar conversa") : uiText("Mostrar conversa")}
          aria-label={voiceChatOpen ? uiText("Ocultar conversa") : uiText("Mostrar conversa")}
          aria-pressed={voiceChatOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
          </svg>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={handleFullscreen}
          className={voiceFullscreen
            ? `${btnBase} bg-surface-channel text-txt-primary`
            : btnDefault
          }
          title={voiceFullscreen ? uiText("Sair da tela cheia (Esc)") : uiText("Tela cheia")}
          aria-label={voiceFullscreen ? uiText("Sair da tela cheia (Esc)") : uiText("Tela cheia")}
        >
          {voiceFullscreen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          )}
        </button>

        {/* Separator */}
        <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

        {/* Disconnect */}
        <button
          onClick={handleDisconnect}
          className={`${btnBase} bg-accent-rose hover:bg-accent-rose/80 text-white`}
          title={uiText("Desconectar")}
        >
          <OrbitalIcon name="hangup" />
        </button>
      </div>
    </div>
    </>
  );
}

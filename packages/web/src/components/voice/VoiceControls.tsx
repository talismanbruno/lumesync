import React, { useState, useRef } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore, getChannelOrigin } from '../../stores/spaceStore';
import { getActiveRoom } from '../../hooks/useLiveKit';
import { wsSend } from '../../hooks/useWebSocket';
import { ScreenShareSettingsPopover } from './ScreenShareSettingsPopover';
import { ConnectionInfoPopover } from './ConnectionInfoPopover';
import { startScreenShare, stopScreenShare } from '../../utils/screenShare';
import { hasPermissionBit, PermissionBits } from '../../utils/permissions';
import { broadcastVoiceStatus } from '../../utils/voice';
import { handleCameraAction } from '../../utils/voiceActions';
import { OrbitalIcon } from '../ui/OrbitalIcon';

/**
 * VoiceControls renders the voice status + button rows.
 * It has NO wrapper/card styling — the parent provides the container.
 */
export function VoiceControls() {
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const isCameraOn = useVoiceStore((s) => s.isCameraOn);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const rnnoiseEnabled = useVoiceStore((s) => s.rnnoiseEnabled);
  const setRnnoiseEnabled = useVoiceStore((s) => s.setRnnoiseEnabled);
  const connectionError = useVoiceStore((s) => s.connectionError);
  const isLiveKitConnected = useVoiceStore((s) => s.isLiveKitConnected);
  const connectionQuality = useVoiceStore((s) => s.connectionQuality);
  const channels = useSpaceStore((s) => s.channels);
  const [showScreenShareSettings, setShowScreenShareSettings] = useState(false);
  const [showConnectionInfo, setShowConnectionInfo] = useState(false);
  const connectionBtnRef = useRef<HTMLButtonElement>(null);
  const qualityBtnRef = useRef<HTMLButtonElement>(null);

  const activeDmCall = useVoiceStore((s) => s.activeDmCall);
  const channelPerms = useSpaceStore((s) => currentVoiceChannelId ? s.channelPermissions.get(currentVoiceChannelId) : undefined);

  // In DM calls, all permissions are granted; in space channels, check SPEAK and STREAM
  const isDmCall = !!activeDmCall;
  const canSpeak = isDmCall || hasPermissionBit(channelPerms, PermissionBits.SPEAK);
  const canStream = isDmCall || hasPermissionBit(channelPerms, PermissionBits.STREAM);

  const voiceOrigin = currentVoiceChannelId ? getChannelOrigin(currentVoiceChannelId) : '';

  if (!currentVoiceChannelId && !activeDmCall) return null;

  const channel = channels.find(c => c.id === currentVoiceChannelId);
  const channelName = channel?.name ?? (activeDmCall ? 'DM Call' : 'Voice Channel');

  const handleScreenShare = async () => {
    const room = getActiveRoom();
    console.log('[SS] handleScreenShare clicked, room:', !!room, 'isScreenSharing:', isScreenSharing);
    if (!room) return;
    try {
      if (!isScreenSharing) {
        const started = await startScreenShare(room);
        if (started) broadcastVoiceStatus();
      } else {
        await stopScreenShare(room);
        broadcastVoiceStatus();
      }
    } catch (err) {
      console.error('[VoiceControls] Failed to toggle screen share:', err);
    }
  };

  const handleDisconnect = () => {
    const { activeDmCall, disconnectFn, federatedCallId, callOrigin } = useVoiceStore.getState();
    if (activeDmCall) {
      const origin = callOrigin || getChannelOrigin(activeDmCall.dmChannelId);
      wsSend({ type: 'dm_call_end', dmChannelId: activeDmCall.dmChannelId, federatedCallId }, origin);
      useVoiceStore.getState().setActiveDmCall(null);
    } else {
      wsSend({ type: 'voice_leave' }, voiceOrigin);
      useVoiceStore.getState().leaveVoice();
    }
    if (disconnectFn) disconnectFn();
  };

  const statusColor = connectionError
    ? 'text-txt-danger'
    : isLiveKitConnected
      ? 'text-status-online'
      : 'text-status-idle';

  const statusBgColor = connectionError
    ? 'bg-accent-rose/20'
    : isLiveKitConnected
      ? 'bg-status-online/20'
      : 'bg-status-idle/20';

  const qualityColor =
    connectionQuality === 'excellent' || connectionQuality === 'good'
      ? 'text-status-online'
      : connectionQuality === 'poor'
        ? 'text-status-idle'
        : connectionQuality === 'lost'
          ? 'text-txt-danger'
          : statusColor; // 'unknown' falls back to connection-state color

  const btnBase = 'lume-voice-action flex-1 h-[36px] flex items-center justify-center rounded-xl transition-colors';
  const btnDefaultStyle = 'bg-white/[0.035] text-txt-tertiary hover:bg-white/[0.07] hover:text-txt-secondary';

  return (
    <>
      {/* Row 1: Signal icon + status text + disconnect */}
      <div className="lume-voice-status relative flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          ref={connectionBtnRef}
          onClick={() => {
            setShowConnectionInfo(!showConnectionInfo);
            if (!showConnectionInfo) setShowScreenShareSettings(false);
          }}
          className={`w-8 h-8 rounded-lg ${statusBgColor} flex items-center justify-center flex-shrink-0 hover:brightness-125 transition-all`}
          title="Connection Info"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={qualityColor}>
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className={`text-[11px] uppercase tracking-[0.16em] font-bold leading-[18px] ${statusColor}`}>
            {connectionError ? 'Orbit interrupted' : isLiveKitConnected ? 'Orbit online' : 'Aligning orbit...'}
          </div>
          <div className="text-[12px] text-txt-tertiary truncate leading-[16px]">
            {connectionError ? connectionError : channelName}
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handleDisconnect}
            className="lume-orbit-disconnect w-8 h-8 flex items-center justify-center text-txt-tertiary hover:text-white transition-colors rounded-xl"
            title="Disconnect"
          >
            <OrbitalIcon name="hangup" size={19} />
          </button>
        </div>

        {/* Connection Info Popover */}
        <ConnectionInfoPopover
          open={showConnectionInfo}
          onClose={() => setShowConnectionInfo(false)}
          anchorRef={connectionBtnRef}
        />
      </div>

      {/* Row 2: Camera, Screen Share, Video Quality, Noise Suppression */}
      <div className="lume-voice-actions relative grid grid-cols-4 gap-1.5 px-3 pb-3 pt-1">
        {canSpeak && (
          <button
            onClick={handleCameraAction}
            className={`${btnBase} ${
              isCameraOn
                ? 'bg-surface-base text-status-online hover:bg-surface-channel'
                : btnDefaultStyle
            }`}
            title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            <OrbitalIcon name="camera" cut={!isCameraOn} />
          </button>
        )}

        {canStream && (
          <button
            onClick={handleScreenShare}
            className={`${btnBase} ${
              isScreenSharing
                ? 'bg-surface-base text-status-online hover:bg-surface-channel'
                : btnDefaultStyle
            }`}
            title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          >
            <OrbitalIcon name="screen" />
          </button>
        )}

        {/* Video Quality */}
        <button
          ref={qualityBtnRef}
          onClick={() => {
            setShowScreenShareSettings(!showScreenShareSettings);
            if (!showScreenShareSettings) setShowConnectionInfo(false);
          }}
          className={`${btnBase} ${
            showScreenShareSettings
              ? 'bg-surface-base text-accent-primary hover:bg-surface-channel'
              : btnDefaultStyle
          }`}
          title="Video Quality"
        >
          <OrbitalIcon name="image" />
        </button>

        {/* AI Noise Suppression (RNNoise) */}
        <button
          onClick={() => setRnnoiseEnabled(!rnnoiseEnabled)}
          className={`${btnBase} ${
            rnnoiseEnabled
              ? 'bg-surface-base text-status-online hover:bg-surface-channel'
              : btnDefaultStyle
          }`}
          title={rnnoiseEnabled ? 'Disable Lume Clear' : 'Enable Lume Clear'}
        >
          <OrbitalIcon name="clear" />
        </button>

        {/* Screen Share Settings Popover */}
        <ScreenShareSettingsPopover
          open={showScreenShareSettings}
          onClose={() => setShowScreenShareSettings(false)}
          anchorRef={qualityBtnRef}
        />
      </div>
    </>
  );
}

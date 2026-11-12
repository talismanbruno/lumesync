import { useEffect, useRef } from 'react';
import { RoomEvent, Track, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
import { getActiveRoom, setScreenPreviewSubscription, type StreamTile } from '../../hooks/useLiveKit';
import { useVoiceParticipantMeta } from '../../hooks/useVoiceParticipantMeta';
import { t as uiText } from '../../i18n';
import { useVoiceStore } from '../../stores/voiceStore';
import { Avatar } from '../ui/Avatar';

export function StreamPreviewCard({ tile, onOpen }: { tile: StreamTile; onOpen: () => void }) {
  const { participant } = tile;
  const { avatar, displayName } = useVoiceParticipantMeta(participant);
  const { identity, isLocal, screenOwnerIdentity, userId } = participant;
  const owner = screenOwnerIdentity ?? identity;
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTrack = tile.screenTrack?.readyState === 'live' ? tile.lkScreenTrack : null;

  useEffect(() => {
    const room = getActiveRoom();
    if (!room || isLocal) return;

    // The preview subscribes only to video. The full viewer subscribes to audio on click.
    const subscribePreview = (publication: RemoteTrackPublication, remote: RemoteParticipant) => {
      if (remote.identity === owner && publication.source === Track.Source.ScreenShare) {
        publication.setSubscribed(true);
      }
    };
    room.on(RoomEvent.TrackPublished, subscribePreview);
    setScreenPreviewSubscription(room, owner, true);
    return () => {
      room.off(RoomEvent.TrackPublished, subscribePreview);
      if (!useVoiceStore.getState().watchingStreams.has(userId)) {
        setScreenPreviewSubscription(room, owner, false);
      }
    };
  }, [isLocal, owner, userId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!videoTrack || !video) return;
    videoTrack.attach(video);
    return () => { videoTrack.detach(video); };
  }, [videoTrack]);

  return (
    <button type="button" className="lume-call-stream-preview" onClick={onOpen}
      aria-label={uiText("Assistir à transmissão de {0}", [displayName])}>
      <span className="lume-call-stream-preview-art" aria-hidden="true">
        {videoTrack ? <video ref={videoRef} muted autoPlay playsInline /> : <Avatar src={avatar} name={displayName} size={96} />}
      </span>
      <span className="lume-call-stream-preview-live">{uiText("LIVE")}</span>
      <span className="lume-call-stream-preview-play" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
      <span className="lume-call-stream-preview-name">{displayName}</span>
    </button>
  );
}

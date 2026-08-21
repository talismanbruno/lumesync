import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VoiceParticipant {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
  isMuted: boolean;
  isDeafened?: boolean;
  isSharingScreen?: boolean;
  isTalking?: boolean;
  isSpeaking?: boolean;
  stream?: MediaStream | null;
  screenStream?: MediaStream | null;
}

export function useVoiceRoom(channelId: string | null, myProfile: any) {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreams = useRef<Map<string, MediaStream>>(new Map());

  const cleanup = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    
    if (channelRef.current) {
      try {
        await channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn("Cleanup error:", err);
      }
      channelRef.current = null;
    }
    
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    remoteStreams.current.clear();
    remoteScreenStreams.current.clear();
    
    setParticipants([]);
    setScreenStream(null);
  }, [screenStream]);

  const createPeerConnection = useCallback((userId: string, isInitiator: boolean, voiceChannel: any) => {
    if (peerConnections.current.has(userId)) return peerConnections.current.get(userId)!;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnections.current.set(userId, pc);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        voiceChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate, to: userId, from: myProfile.id }
        });
      }
    };

    pc.ontrack = (event) => {
      const stream: MediaStream | undefined = event.streams[0];
      if (!stream) return;

      const isVideo = event.track.kind === 'video';
      
      if (isVideo) {
        remoteScreenStreams.current.set(userId, stream);
      } else {
        remoteStreams.current.set(userId, stream);
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        (audio as any).playsInline = true;
        audio.play().catch(e => console.warn("Autoplay blocked:", e));
      }

      setParticipants(prev => prev.map(p => 
        p.id === userId ? { 
          ...p, 
          stream: (!isVideo ? stream : (p.stream || null)) as MediaStream | null,
          screenStream: (isVideo ? stream : (p.screenStream || null)) as MediaStream | null
        } : p
      ));
    };

    if (isInitiator) {
      pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
        voiceChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: { offer: pc.localDescription, to: userId, from: myProfile.id }
        });
      });
    }

    return pc;
  }, [myProfile.id]);

  const joinVoiceChannel = useCallback(async (cid: string) => {
    if (channelRef.current) return;
    
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch (err) {
      console.warn("Microfone indisponível ou permissão negada.");
      toast.warning("Entrando como ouvinte.");
    }

    // Register participant in the table
    try {
      await supabase.from('voice_participants').upsert({ 
        channel_id: cid, 
        user_id: myProfile.id 
      });
    } catch (err) {
      console.error("Error registering voice participant:", err);
    }

    const voiceChannel = supabase.channel(`voice-room-${cid}`, {
      config: { presence: { key: myProfile.id } }
    });

    voiceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = voiceChannel.presenceState();
        const users: VoiceParticipant[] = Object.values(state).flat().map((p: any) => ({
          id: p.user_id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          isMuted: p.isMuted,
          isDeafened: p.isDeafened,
          isSharingScreen: p.isSharingScreen,
          isSpeaking: false,
          isTalking: false,
          stream: remoteStreams.current.get(p.user_id) || null,
          screenStream: remoteScreenStreams.current.get(p.user_id) || null
        }));
        
        // Trigger signaling for new users
        users.forEach(u => {
          if (u.id !== myProfile.id && !peerConnections.current.has(u.id)) {
            // Deterministic initiator: user with "smaller" ID initiates
            const isInitiator = myProfile.id < u.id;
            createPeerConnection(u.id, isInitiator, voiceChannel);
          }
        });

        setParticipants(users);
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== myProfile.id) return;
        const pc = createPeerConnection(payload.from, false, voiceChannel);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        voiceChannel.send({
          type: 'broadcast',
          event: 'answer',
          payload: { answer: pc.localDescription, to: payload.from, from: myProfile.id }
        });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to !== myProfile.id) return;
        const pc = peerConnections.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== myProfile.id) return;
        const pc = peerConnections.current.get(payload.from);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await voiceChannel.track({
            user_id: myProfile.id,
            username: myProfile?.username || 'Usuário',
            display_name: myProfile?.display_name || 'Usuário',
            avatar_url: myProfile?.avatar_url,
            isMuted: false,
            isDeafened: false,
            isSharingScreen: false
          });
        }
      });

    channelRef.current = voiceChannel;
  }, [myProfile, createPeerConnection]);

  useEffect(() => {
    if (channelId) {
      joinVoiceChannel(channelId);
    }
  }, [channelId, joinVoiceChannel]);

  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      
      // Add track to all active peer connections
      const videoTrackToShare = stream.getVideoTracks()[0];
      if (videoTrackToShare) {
        peerConnections.current.forEach(pc => {
          pc.addTrack(videoTrackToShare, stream);
        });
      }
      
      if (channelRef.current) {
        channelRef.current.track({
          user_id: myProfile.id,
          username: myProfile?.username || 'Usuário',
          display_name: myProfile?.display_name || 'Usuário',
          avatar_url: myProfile?.avatar_url,
          isMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
          isDeafened,
          isSharingScreen: true
        });
      }

      // Se o usuário parar o compartilhamento pelo navegador
      const videoTrackEnded = stream.getVideoTracks()[0];
      if (videoTrackEnded) {
        videoTrackEnded.onended = () => {
          setScreenStream(null);
          if (channelRef.current) {
            channelRef.current.track({
              user_id: myProfile.id,
              username: myProfile?.username || 'Usuário',
              display_name: myProfile?.display_name || 'Usuário',
              avatar_url: myProfile?.avatar_url,
              isMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
              isDeafened,
              isSharingScreen: false
            });
          }
        };
      }
    } catch (err) {
      console.log("Compartilhamento cancelado");
    }
  };


  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMutedState = !audioTrack.enabled;
        
        if (channelRef.current) {
          channelRef.current.track({
            user_id: myProfile.id,
            username: myProfile?.username || 'Usuário',
            display_name: myProfile?.display_name || 'Usuário',
            avatar_url: myProfile?.avatar_url,
            isMuted: newMutedState,
            isDeafened,
            isSharingScreen: !!screenStream
          });
        }
      }
    }
  };

  const toggleDeafen = () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    if (channelRef.current) {
      channelRef.current.track({
        user_id: myProfile.id,
        username: myProfile?.username || 'Usuário',
        display_name: myProfile?.display_name || 'Usuário',
        avatar_url: myProfile?.avatar_url,
        isMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
        isDeafened: nextDeafened,
        isSharingScreen: !!screenStream
      });
    }
  };

  return {
    participants,
    allParticipantsInRoom: participants,
    screenStream,
    isMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
    isDeafened,
    isSharingScreen: !!screenStream,
    toggleMute,
    toggleDeafen,
    toggleScreenShare: handleShareScreen,
    disconnect: cleanup
  };
}




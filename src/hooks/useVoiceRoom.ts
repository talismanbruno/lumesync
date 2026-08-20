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
  stream?: MediaStream;
}

export function useVoiceRoom(channelId: string | null, myProfile: any) {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

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
    
    setParticipants([]);
    setScreenStream(null);
  }, [screenStream]);

  const joinVoiceChannel = useCallback(async (cid: string) => {
    if (channelRef.current) return; // Já conectado
    
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch (err) {
      console.warn("Microfone indisponível ou permissão negada. Entrando no modo ouvinte.");
      toast.warning("Não foi possível acessar o microfone. Você entrou como ouvinte.");
    }

    // Conectar canal de Presence estático
    const voiceChannel = supabase.channel(`voice-room-${cid}`, {
      config: { presence: { key: myProfile.id } }
    });

    voiceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = voiceChannel.presenceState();
        const users = Object.values(state).flat().map((p: any) => ({
          id: p.user_id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          isMuted: p.isMuted,
          isDeafened: p.isDeafened,
          isSharingScreen: p.isSharingScreen,
          isSpeaking: false,
          isTalking: false
        }));
        setParticipants(users);
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
  }, [myProfile]);

  useEffect(() => {
    if (channelId) {
      joinVoiceChannel(channelId);
    }
  }, [channelId, joinVoiceChannel]);

  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      
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
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
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




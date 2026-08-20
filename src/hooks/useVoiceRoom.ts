import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VoiceParticipant {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
}

export function useVoiceRoom(channelId: string | null, myProfile: any) {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Note: We are keeping the peerConnections ref but simplifying the logic as requested
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  const cleanup = useCallback(async () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    
    if (channelRef.current) {
      await channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    setParticipants([]);
    setScreenStream(null);
  }, [screenStream]);

  const joinVoiceChannel = useCallback(async (cid: string) => {
    if (channelRef.current) return; // Already connected
    
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch (err) {
      console.warn("Microfone indisponível ou permissão negada. Entrando no modo ouvinte.");
      toast.warning("Não foi possível acessar o microfone. Você entrou como ouvinte.");
    }

    // Connect static Presence channel
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
          isSpeaking: false
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
            isMuted: false
          });
        }
      });

    channelRef.current = voiceChannel;
  }, [myProfile]);

  useEffect(() => {
    if (channelId) {
      joinVoiceChannel(channelId);
    }
    return () => {
      // Logic handled by manual disconnect or route change
    };
  }, [channelId, joinVoiceChannel]);

  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      
      // If user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
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
            isMuted: newMutedState
          });
        }
      }
    }
  };

  return {
    participants,
    allParticipantsInRoom: participants,
    screenStream,
    isMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
    isDeafened: false,
    isSharingScreen: !!screenStream,
    toggleMute,
    toggleDeafen: () => {}, // Simplified for now per instructions
    toggleScreenShare: handleShareScreen,
    disconnect: cleanup
  };
}


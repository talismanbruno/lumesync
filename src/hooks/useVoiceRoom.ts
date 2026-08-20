import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export interface VoiceParticipant {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  isTalking?: boolean;
  stream?: MediaStream | undefined;
}

export function useVoiceRoom(channelId: string | null, myProfile: any) {
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<any>(null);
  const currentPresenceState = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<Record<string, AnalyserNode>>({});
  const talkingThreshold = 20;

  const cleanup = useCallback(() => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    Object.values(pcs.current).forEach(pc => pc.close());
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    pcs.current = {};
    setParticipants({});
    setLocalStream(null);
    setScreenStream(null);
    setIsSharingScreen(false);
  }, [localStream, screenStream]);

  const setupAnalyser = (id: string, stream: MediaStream) => {
    try {
      if (typeof window === 'undefined') return;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current[id] = analyser;
    } catch (e) {
      console.error("Error setting up analyser", e);
    }
  };

  useEffect(() => {
    if (!channelId || !myProfile?.id) return;

    let isSubscribed = true;

    const initVoice = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isSubscribed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        setLocalStream(stream);

        const channel = supabase.channel(`voice-room:${channelId}`, {
          config: { broadcast: { self: true }, presence: { key: myProfile.id } }
        });

        channelRef.current = channel;

        const createPC = (participantId: string, isInitiator: boolean, currentStream: MediaStream) => {
          if (pcs.current[participantId]) return pcs.current[participantId];

          const pc = new RTCPeerConnection(rtcConfig);
          pcs.current[participantId] = pc;

          currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream));

          pc.onicecandidate = (event) => {
            if (event.candidate && channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'ice-candidate',
                payload: { to: participantId, from: myProfile.id, candidate: event.candidate }
              });
            }
          };

          pc.ontrack = (event) => {
            const stream = event.streams[0];
            
            setParticipants(prev => {
              const current = prev[participantId];
              const base: VoiceParticipant = current || {
                id: participantId,
                username: 'Usuário',
                avatar_url: null,
                display_name: null,
                isMuted: false,
                isDeafened: false,
                isSharingScreen: false,
              };
              
              const updated: VoiceParticipant = {
                ...base,
                stream: stream || undefined
              };

              return {
                ...prev,
                [participantId]: updated
              };
            });

            if (stream) {
              setupAnalyser(participantId, stream);
            }
          };

          if (isInitiator) {
            pc.onnegotiationneeded = async () => {
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                if (channelRef.current) {
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'offer',
                    payload: { to: participantId, from: myProfile.id, offer }
                  });
                }
              } catch (e) {
                console.error("Negotiation error", e);
              }
            };
          }

          return pc;
        };

        channel
          .on('presence', { event: 'join' }, ({ newPresences }) => {
            newPresences.forEach((p: any) => {
              if (p.id !== myProfile.id) {
                createPC(p.id, true, stream);
              }
            });
          })
          .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach((p: any) => {
              const pc = pcs.current[p.id];
              if (pc) {
                pc.close();
                delete pcs.current[p.id];
                setParticipants(prev => {
                  const next = { ...prev };
                  delete next[p.id];
                  return next;
                });
              }
            });
          })
          .on('broadcast', { event: 'offer' }, async ({ payload }) => {
            if (payload.to !== myProfile.id) return;
            const pc = createPC(payload.from, false, stream);
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (channelRef.current) {
                channelRef.current.send({
                  type: 'broadcast',
                  event: 'answer',
                  payload: { to: payload.from, from: myProfile.id, answer }
                });
              }
            } catch (e) {
              console.error("Offer error", e);
            }
          })
          .on('broadcast', { event: 'answer' }, async ({ payload }) => {
            if (payload.to !== myProfile.id) return;
            const pc = pcs.current[payload.from];
            if (pc) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
              } catch (e) {
                console.error("Answer error", e);
              }
            }
          })
          .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
            if (payload.to !== myProfile.id) return;
            const pc = pcs.current[payload.from];
            if (pc && payload.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) {
                console.error("ICE error", e);
              }
            }
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && channelRef.current) {
              await channelRef.current.track({
                id: myProfile.id,
                username: myProfile.username,
                avatar_url: myProfile.avatar_url,
                display_name: myProfile.display_name,
                isMuted: false,
                isDeafened: false,
                isSharingScreen: false
              });
            }
          });

      } catch (err) {
        console.error("Voice init error:", err);
        toast.error("Erro ao acessar microfone");
      }
    };

    initVoice();

    return () => {
      isSubscribed = false;
      cleanup();
    };
  }, [channelId, myProfile?.id, cleanup]);

  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(analyserRef.current).forEach(([id, analyser]) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        setParticipants(prev => {
          const participant = prev[id];
          if (!participant) return prev;
          const isTalking = average > talkingThreshold;
          if (participant.isTalking === isTalking) return prev;
          return {
            ...prev,
            [id]: { ...participant, isTalking }
          };
        });
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        if (channelRef.current) channelRef.current.track({ isMuted: !audioTrack.enabled });
      }
    }
  };

  const toggleDeafen = () => {
    const nextState = !isDeafened;
    setIsDeafened(nextState);
    if (channelRef.current) channelRef.current.track({ isDeafened: nextState });
  };

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }
      setScreenStream(null);
      setIsSharingScreen(false);
      if (channelRef.current) channelRef.current.track({ isSharingScreen: false });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setScreenStream(stream);
        setIsSharingScreen(true);
        if (channelRef.current) channelRef.current.track({ isSharingScreen: true });

        const videoTrack = stream.getTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            toggleScreenShare();
          };
        }

        Object.values(pcs.current).forEach(pc => {
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
        });
      } catch (err) {
        toast.error("Erro ao compartilhar tela");
      }
    }
  };

  return {
    participants: Object.values(participants),
    localStream,
    screenStream,
    isMuted,
    isDeafened,
    isSharingScreen,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    disconnect: cleanup
  };
}

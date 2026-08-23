import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AUDIO_PREFERENCES_EVENT,
  applyOutputDevice,
  getAudioPreferences,
  getMicrophoneConstraints,
  setAudioPreferences,
  type AudioPreferences
} from '@/lib/audioPreferences';

export interface LumeProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
  status?: string | null;
  is_admin?: boolean | null;
}

export interface VoiceParticipant {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
  is_admin?: boolean | null;
  isMuted: boolean;
  isDeafened?: boolean;
  isSharingScreen?: boolean;
  isTalking?: boolean; // Usado para transição rápida local
  isSpeaking?: boolean; // Sincronizado via Realtime
  stream?: MediaStream | null;
  screenStream?: MediaStream | null;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unstable' | 'failed';

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map((url: string) => url.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL
    });
  }
  return servers;
}

export function useVoiceRoom(roomKey: string | null, myProfile: LumeProfile | null) {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isDeafened, setIsDeafened] = useState(false);
  const [remoteStreamsVersion, setRemoteStreamsVersion] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(false);
  const [isNoiseSuppressionSupported, setIsNoiseSuppressionSupported] = useState(false);
  
  const channelRef = useRef<any>(null);
  const myProfileRef = useRef<LumeProfile | null>(myProfile);
  const localUserIdRef = useRef<string | null>(myProfile?.id || null);
  const roomKeyRef = useRef<string | null>(null);
  const joiningRoomRef = useRef<string | null>(null);
  const joinAttemptRef = useRef(0);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteVideoStreams = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreams = useRef<Map<string, MediaStream>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenSenders = useRef<Map<string, RTCRtpSender[]>>(new Map());
  const reconnectTimers = useRef<Map<string, number>>(new Map());
  const voiceChannelRef = useRef<any>(null);
  const isDeafenedRef = useRef(false);
  const appliedAudioPreferencesRef = useRef<AudioPreferences>(getAudioPreferences());
  
  // Audio Analysis for VAD
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const lastSpeakingState = useRef<boolean>(false);
  const speakingExpiryTimers = useRef<Map<string, number>>(new Map());

  myProfileRef.current = myProfile;
  if (myProfile?.id) localUserIdRef.current = myProfile.id;

  // Check support for noise suppression
  useEffect(() => {
    const constraints = navigator.mediaDevices.getSupportedConstraints();
    setIsNoiseSuppressionSupported(!!constraints.noiseSuppression);
  }, []);

  const updateSpeakingState = useCallback((participantId: string, isSpeaking: boolean) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === participantId) {
        return { ...p, isSpeaking };
      }
      return p;
    }));

    if (isSpeaking) {
      if (speakingExpiryTimers.current.has(participantId)) {
        window.clearTimeout(speakingExpiryTimers.current.get(participantId));
      }
      const timer = window.setTimeout(() => {
        updateSpeakingState(participantId, false);
      }, 2000); // Expiração de segurança de 2s
      speakingExpiryTimers.current.set(participantId, timer);
    }
  }, []);

  const cleanup = useCallback(async () => {
    joinAttemptRef.current += 1;
    const leavingRoomKey = roomKeyRef.current;
    roomKeyRef.current = null;
    joiningRoomRef.current = null;

    if (vadIntervalRef.current) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }
    
    speakingExpiryTimers.current.forEach(timer => window.clearTimeout(timer));
    speakingExpiryTimers.current.clear();
    reconnectTimers.current.forEach(timer => window.clearTimeout(timer));
    reconnectTimers.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    
    const localUserId = localUserIdRef.current;
    if (leavingRoomKey && localUserId) {
      try {
        await (supabase.from('voice_participants') as any).delete().match({ 
          room_key: leavingRoomKey,
          user_id: localUserId
        });
      } catch (err) {
        console.error("Error removing voice participant:", err);
      }
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
    remoteAudioElements.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioElements.current.clear();
    remoteStreams.current.clear();
    remoteVideoStreams.current.clear();
    remoteScreenStreams.current.clear();
    pendingIceCandidates.current.clear();
    screenSenders.current.clear();
    
    setParticipants([]);
    setScreenStream(null);
    setConnectionStatus('idle');
  }, []);

  const calculateStatus = useCallback((): ConnectionStatus => {
    if (!channelRef.current) return 'idle';
    
    const channelStatus = channelRef.current.state; // 'joining', 'joined', 'leaving', 'closed'
    if (channelStatus !== 'joined') {
      return 'connecting';
    }

    const peers = Array.from(peerConnections.current.values());
    
    // Se a chamada solo (zero peers), estamos 'connected' se o canal e track local estão ok
    if (peers.length === 0) {
      return 'connected';
    }

    // Unstable: Se algum peer estiver falho ou desconectado
    const unstablePeer = peers.find(pc => 
      pc.connectionState === 'failed'
    );
    
    if (unstablePeer) {
      // Nota: O requisito pede > 5s. Para simplificar no hook, marcamos unstable imediatamente
      // se houver falha, o timer de 5s pode ser implementado no componente ou refinado aqui.
      return 'unstable';
    }

    // Reconnecting: peers em checking
    const checkingPeer = peers.find(pc => pc.iceConnectionState === 'checking');
    if (checkingPeer) return 'reconnecting';

    return 'connected';
  }, []);

  const refreshConnectionStatus = useCallback(() => {
    setConnectionStatus(calculateStatus());
  }, [calculateStatus]);

  const startVAD = useCallback((stream: MediaStream) => {
    try {
      if (audioContextRef.current) return;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 512;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      vadIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || !voiceChannelRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const isSpeaking = volume > 20; // Threshold empírico

        // Só envia se o estado mudou
        if (isSpeaking !== lastSpeakingState.current) {
          lastSpeakingState.current = isSpeaking;
          voiceChannelRef.current.send({
            type: 'broadcast',
            event: 'speaking',
            payload: { userId: myProfileRef.current?.id, isSpeaking }
          });
          
          // Atualiza localmente
          setParticipants(prev => prev.map(p => 
            p.id === myProfileRef.current?.id ? { ...p, isSpeaking } : p
          ));
        }
      }, 100);
    } catch (e) {
      console.warn("VAD initiation failed:", e);
    }
  }, []);

  const replaceInputDevice = useCallback(async (preferences: AudioPreferences) => {
    if (!roomKeyRef.current || !localStreamRef.current) return;
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: getMicrophoneConstraints(preferences),
        video: false
      });
      const nextTrack = nextStream.getAudioTracks()[0];
      if (!nextTrack) return;

      const previousStream = localStreamRef.current;
      const previousTrack = previousStream.getAudioTracks()[0];
      if (previousTrack) nextTrack.enabled = previousTrack.enabled;
      await Promise.all(Array.from(peerConnections.current.values()).map(async pc => {
        const sender = pc.getSenders().find(item => item.track?.kind === 'audio' && item.track.id === previousTrack?.id);
        if (sender) await sender.replaceTrack(nextTrack);
      }));

      if (vadIntervalRef.current) window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
      await audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      previousStream.getTracks().forEach(track => track.stop());
      localStreamRef.current = nextStream;
      setIsNoiseSuppressionEnabled(!!nextTrack.getSettings().noiseSuppression);
      startVAD(nextStream);
      toast.success('Dispositivo de entrada atualizado.');
    } catch (error) {
      console.warn('Falha ao trocar microfone:', error);
      toast.error('Não foi possível usar este microfone.');
    }
  }, [startVAD]);

  useEffect(() => {
    const handlePreferences = (event: Event) => {
      const preferences = (event as CustomEvent<AudioPreferences>).detail || getAudioPreferences();
      const previous = appliedAudioPreferencesRef.current;
      appliedAudioPreferencesRef.current = preferences;
      if (preferences.outputDeviceId !== previous.outputDeviceId) {
        remoteAudioElements.current.forEach(audio => {
          void applyOutputDevice(audio, preferences.outputDeviceId).catch(() => undefined);
        });
      }
      if (
        preferences.inputDeviceId !== previous.inputDeviceId ||
        preferences.noiseSuppression !== previous.noiseSuppression ||
        preferences.echoCancellation !== previous.echoCancellation ||
        preferences.autoGainControl !== previous.autoGainControl
      ) {
        void replaceInputDevice(preferences);
      }
    };
    window.addEventListener(AUDIO_PREFERENCES_EVENT, handlePreferences);
    return () => window.removeEventListener(AUDIO_PREFERENCES_EVENT, handlePreferences);
  }, [replaceInputDevice]);

  const sendOffer = useCallback(async (pc: RTCPeerConnection, userId: string, voiceChannel: any, iceRestart = false) => {
    try {
      const offer = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription(offer);
      await voiceChannel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { offer: pc.localDescription, to: userId, from: myProfileRef.current?.id }
      });
    } catch (error) {
      console.warn('Falha ao negociar conexão de voz:', error);
      setConnectionStatus('unstable');
    }
  }, []);

  const flushPendingCandidates = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    const candidates = pendingIceCandidates.current.get(userId) || [];
    pendingIceCandidates.current.delete(userId);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('Candidato ICE descartado:', error);
      }
    }
  }, []);

  const createPeerConnection = useCallback((userId: string, isInitiator: boolean, voiceChannel: any) => {
    if (peerConnections.current.has(userId)) return peerConnections.current.get(userId)!;

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    peerConnections.current.set(userId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    if (screenStreamRef.current) {
      const senders = screenStreamRef.current.getTracks().map(track => pc.addTrack(track, screenStreamRef.current!));
      screenSenders.current.set(userId, senders);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        voiceChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate, to: userId, from: myProfileRef.current?.id }
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      
      if (event.track.kind === 'video') {
        remoteVideoStreams.current.set(userId, stream);
        remoteScreenStreams.current.set(userId, stream);
        setRemoteStreamsVersion(v => v + 1);
      } else if (event.track.kind === 'audio') {
        remoteStreams.current.set(userId, stream);
        const previousAudio = remoteAudioElements.current.get(userId);
        previousAudio?.pause();
        if (previousAudio) previousAudio.srcObject = null;
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.muted = isDeafenedRef.current;
        (audio as any).playsInline = true;
        remoteAudioElements.current.set(userId, audio);
        void applyOutputDevice(audio, getAudioPreferences().outputDeviceId).catch(() => undefined);
        audio.play().catch(e => console.warn("Autoplay blocked:", e));
      }

      setParticipants(prev => prev.map(p => 
        p.id === userId ? { 
          ...p, 
          stream: (event.track.kind === 'audio' ? stream : (p.stream || null)) as MediaStream | null,
          screenStream: (event.track.kind === 'video' ? stream : (p.screenStream || null)) as MediaStream | null
        } : p
      ));
    };

    pc.onconnectionstatechange = () => {
      const existingTimer = reconnectTimers.current.get(userId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
        reconnectTimers.current.delete(userId);
      }

      if (pc.connectionState === 'disconnected') {
        setConnectionStatus('reconnecting');
        const timer = window.setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            setConnectionStatus('unstable');
            if (isInitiator) void sendOffer(pc, userId, voiceChannel, true);
          }
        }, 5000);
        reconnectTimers.current.set(userId, timer);
      } else if (pc.connectionState === 'failed') {
        setConnectionStatus('reconnecting');
        if (isInitiator) void sendOffer(pc, userId, voiceChannel, true);
      } else {
        refreshConnectionStatus();
      }
    };

    if (isInitiator) {
      void sendOffer(pc, userId, voiceChannel);
    }

    return pc;
  }, [refreshConnectionStatus, sendOffer]);

  const joinVoiceChannel = useCallback(async (rk: string) => {
    const profile = myProfileRef.current;
    if (!rk || !profile?.id) return;
    if (roomKeyRef.current === rk || joiningRoomRef.current === rk) return;
    if (channelRef.current) await cleanup();
    joiningRoomRef.current = rk;
    roomKeyRef.current = rk;
    const joinAttempt = ++joinAttemptRef.current;
    setConnectionStatus('connecting');
    
    let stream: MediaStream | null = null;
    try {
      const audioPreferences = getAudioPreferences();
      appliedAudioPreferencesRef.current = audioPreferences;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: getMicrophoneConstraints(audioPreferences),
        video: false 
      });
      localStreamRef.current = stream;
      setIsNoiseSuppressionEnabled(!!stream.getAudioTracks()[0]?.getSettings().noiseSuppression);
      startVAD(stream);
    } catch (err) {
      console.warn("Microfone indisponível ou permissão negada.");
      toast.warning("Microfone indisponível. Você entrou apenas para ouvir.");
    }

    if (joinAttempt !== joinAttemptRef.current || roomKeyRef.current !== rk) {
      stream?.getTracks().forEach(track => track.stop());
      return;
    }

    try {
      await (supabase.from('voice_participants') as any).upsert({ 
        room_key: rk, 
        user_id: profile.id
      });
    } catch (err) {
      console.error("Error registering voice participant:", err);
    }

    const voiceChannel = supabase.channel(`voice-room-${rk}`, {
      config: { presence: { key: profile.id } }
    });

    voiceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = voiceChannel.presenceState();
        const users: VoiceParticipant[] = Object.entries(state).map(([key, presences]: [string, any]) => {
          const p = presences[0]; 
          return {
            id: p.user_id || key,
            username: p.username || 'Usuário',
            display_name: p.display_name || p.username || 'Usuário',
            avatar_url: p.avatar_url,
            isMuted: p.isMuted ?? false,
            isDeafened: p.isDeafened ?? false,
            isSharingScreen: p.isSharingScreen ?? false,
            is_admin: p.is_admin ?? false,
            isSpeaking: false,
            stream: remoteStreams.current.get(p.user_id || key) || null,
            screenStream: remoteScreenStreams.current.get(p.user_id || key) || null
          };
        });
        
        users.forEach(u => {
          if (u.id !== profile.id && !peerConnections.current.has(u.id)) {
            const isInitiator = profile.id.toLowerCase() < u.id.toLowerCase();
            createPeerConnection(u.id, isInitiator, voiceChannel);
          }
        });

        const activeRemoteIds = new Set(users.filter(u => u.id !== profile.id).map(u => u.id));
        peerConnections.current.forEach((pc, userId) => {
          if (activeRemoteIds.has(userId)) return;
          pc.close();
          peerConnections.current.delete(userId);
          remoteStreams.current.delete(userId);
          remoteVideoStreams.current.delete(userId);
          remoteScreenStreams.current.delete(userId);
          pendingIceCandidates.current.delete(userId);
          const audio = remoteAudioElements.current.get(userId);
          audio?.pause();
          if (audio) audio.srcObject = null;
          remoteAudioElements.current.delete(userId);
        });

        setParticipants(users);
        refreshConnectionStatus();
      })
      .on('broadcast', { event: 'speaking' }, ({ payload }) => {
        if (payload.userId) {
          updateSpeakingState(payload.userId, payload.isSpeaking);
        }
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== profile.id) return;
        try {
          const pc = createPeerConnection(payload.from, false, voiceChannel);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          await flushPendingCandidates(payload.from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await voiceChannel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { answer: pc.localDescription, to: payload.from, from: profile.id }
          });
        } catch (error) {
          console.warn('Falha ao responder chamada:', error);
          setConnectionStatus('unstable');
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to !== profile.id) return;
        const pc = peerConnections.current.get(payload.from);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await flushPendingCandidates(payload.from, pc);
        } catch (error) {
          console.warn('Resposta WebRTC inválida:', error);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== profile.id) return;
        const pc = peerConnections.current.get(payload.from);
        if (!pc || !pc.remoteDescription) {
          const queued = pendingIceCandidates.current.get(payload.from) || [];
          queued.push(payload.candidate);
          pendingIceCandidates.current.set(payload.from, queued);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (error) {
          console.warn('Candidato ICE inválido:', error);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await voiceChannel.track({
            user_id: profile.id,
            username: profile.username || 'Usuário',
            display_name: profile.display_name || profile.username || 'Usuário',
            avatar_url: profile.avatar_url,
            isMuted: false,
            isDeafened: false,
            isSharingScreen: false,
            is_admin: profile.is_admin ?? false
          });
          joiningRoomRef.current = null;
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          joiningRoomRef.current = null;
          setConnectionStatus('failed');
        } else if (status === 'CLOSED') {
          setConnectionStatus('idle');
        }
      });

    channelRef.current = voiceChannel;
    voiceChannelRef.current = voiceChannel;
  }, [cleanup, createPeerConnection, flushPendingCandidates, refreshConnectionStatus, startVAD, updateSpeakingState]);

  useEffect(() => {
    if (!roomKey || !myProfile?.id) return;
    void joinVoiceChannel(roomKey);
    return () => {
      void cleanup();
    };
  }, [roomKey, myProfile?.id, joinVoiceChannel, cleanup]);

  const updateLocalPresence = useCallback((changes: Record<string, unknown>) => {
    const profile = myProfileRef.current;
    if (!channelRef.current || !profile?.id) return;
    const current = participants.find(p => p.id === profile.id);
    void channelRef.current.track({
      user_id: profile.id,
      username: profile.username || 'Usuário',
      display_name: profile.display_name || profile.username || 'Usuário',
      avatar_url: profile.avatar_url,
      is_admin: profile.is_admin ?? false,
      isMuted: current?.isMuted ?? false,
      isDeafened: isDeafenedRef.current,
      isSharingScreen: !!screenStreamRef.current,
      ...changes
    });
  }, [participants]);

  const stopScreenShare = useCallback(async () => {
    const activeStream = screenStreamRef.current;
    if (!activeStream) return;

    screenStreamRef.current = null;
    activeStream.getTracks().forEach(track => track.stop());
    setScreenStream(null);
    updateLocalPresence({ isSharingScreen: false });

    for (const [peerId, senders] of screenSenders.current.entries()) {
      const pc = peerConnections.current.get(peerId);
      if (!pc || pc.signalingState === 'closed') continue;
      senders.forEach(sender => {
        try { pc.removeTrack(sender); } catch (error) { console.warn('Falha ao remover tela:', error); }
      });
      if (voiceChannelRef.current) await sendOffer(pc, peerId, voiceChannelRef.current);
    }
    screenSenders.current.clear();
  }, [sendOffer, updateLocalPresence]);

  const handleShareScreen = async () => {
    if (screenStreamRef.current) {
      await stopScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      
      for (const [peerId, pc] of peerConnections.current.entries()) {
        const senders = stream.getTracks().map(track => pc.addTrack(track, stream));
        screenSenders.current.set(peerId, senders);
        if (voiceChannelRef.current) await sendOffer(pc, peerId, voiceChannelRef.current);
      }
      updateLocalPresence({ isSharingScreen: true });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => { void stopScreenShare(); };
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
        const isMuted = !audioTrack.enabled;
        
        // VAD forçado para false se mutado
        if (isMuted && lastSpeakingState.current) {
          lastSpeakingState.current = false;
          voiceChannelRef.current?.send({
            type: 'broadcast',
            event: 'speaking',
            payload: { userId: myProfileRef.current?.id, isSpeaking: false }
          });
        }

        updateLocalPresence({ isMuted });
      }
    }
  };

  const toggleDeafen = () => {
    const nextDeafened = !isDeafened;
    isDeafenedRef.current = nextDeafened;
    setIsDeafened(nextDeafened);
    remoteAudioElements.current.forEach(audio => {
      audio.muted = nextDeafened;
      if (!nextDeafened) void audio.play().catch(() => undefined);
    });
    updateLocalPresence({ isDeafened: nextDeafened });
  };

  const toggleNoiseSuppression = async () => {
    if (!localStreamRef.current || !isNoiseSuppressionSupported) return;
    
    const nextState = !isNoiseSuppressionEnabled;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    
    if (audioTrack) {
      try {
        await audioTrack.applyConstraints({ noiseSuppression: nextState });
        const settings = audioTrack.getSettings();
        setIsNoiseSuppressionEnabled(!!settings.noiseSuppression);
        appliedAudioPreferencesRef.current = {
          ...appliedAudioPreferencesRef.current,
          noiseSuppression: !!settings.noiseSuppression
        };
        setAudioPreferences({ noiseSuppression: !!settings.noiseSuppression });
        
        updateLocalPresence({ isNoiseSuppressionEnabled: !!settings.noiseSuppression });
      } catch (e) {
        toast.error("Erro ao aplicar supressão de ruído");
      }
    }
  };

  return {
    participants,
    allParticipantsInRoom: participants,
    connectionStatus,
    screenStream,
    remoteVideoStreams,
    peerConnections,
    isMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
    isDeafened,
    isSharingScreen: !!screenStream,
    isNoiseSuppressionEnabled,
    isNoiseSuppressionSupported,
    toggleMute,
    toggleDeafen,
    toggleScreenShare: handleShareScreen,
    toggleNoiseSuppression,
    disconnect: cleanup
  };
}


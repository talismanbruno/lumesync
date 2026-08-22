import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Monitor, X, Eye, EyeOff, Volume2, VolumeX, Maximize2, Minimize2, ShieldCheck } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { VoiceParticipant } from '@/hooks/useVoiceRoom';
import { toast } from 'sonner';

interface VoiceRoomUIProps {
  participants: VoiceParticipant[];
  myProfile: any;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  isNoiseSuppressionEnabled: boolean;
  screenStream: MediaStream | null;
  remoteVideoStreams: React.MutableRefObject<Map<string, MediaStream>>;
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleScreenShare: () => void;
  toggleNoiseSuppression: () => void;
  onDisconnect: () => void;
  onClose?: () => void;
}

export const VoiceRoomUI: React.FC<VoiceRoomUIProps> = ({
  participants,
  myProfile,
  isMuted,
  isDeafened,
  isSharingScreen,
  isNoiseSuppressionEnabled,
  screenStream,
  remoteVideoStreams,
  peerConnections,
  toggleMute,
  toggleDeafen,
  toggleScreenShare,
  toggleNoiseSuppression,
  onDisconnect,
  onClose
}) => {
  const [activeWatchingStream, setActiveWatchingStream] = useState<{ userId: string; username: string; stream: MediaStream } | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMutedStream, setIsMutedStream] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      stageContainerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.warn);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.warn);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMutedStream ? 0 : volume;
    }
  }, [volume, isMutedStream]);

  const activeParticipant = participants.find(p => p.id === activeWatchingStream?.userId);
  const displayedStream = activeWatchingStream?.userId === myProfile.id ? screenStream : activeWatchingStream?.stream;

  return (
    <div className="flex flex-1 flex-col h-full bg-[#050505] relative">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/40 text-zinc-400 hover:text-white hover:bg-black/60 transition-all border border-white/10"
        >
          <X size={20} />
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
        {/* Stage Area for Screen Sharing */}
        {activeWatchingStream ? (
          <div 
            ref={stageContainerRef}
            className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300 w-full h-full max-h-[80vh] bg-black rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(0,209,255,0.1)] relative group"
          >
            {/* Player de Vídeo com suporte a Mobile Autoplay */}
            <div className="relative w-full h-full max-h-[85vh] flex items-center justify-center bg-black rounded-2xl overflow-hidden">
              <video
                ref={(el) => {
                  // @ts-ignore
                  videoRef.current = el;
                  if (el && activeWatchingStream.stream) {
                    el.srcObject = activeWatchingStream.stream;
                    el.play().catch((err) => console.warn("Video play error:", err));
                  }
                }}
                autoPlay
                playsInline
                muted // OBRIGATÓRIO PARA NÃO FICAR TELA PRETA NO MOBILE
                className="w-full h-full max-h-[80vh] object-contain mx-auto"
              />
              
              {/* Áudio da transmissão separado */}
              <audio
                ref={(el) => {
                  if (el && activeWatchingStream.stream) {
                    const audioTracks = activeWatchingStream.stream.getAudioTracks();
                    if (audioTracks.length > 0) {
                      el.srcObject = new MediaStream(audioTracks);
                      el.play().catch((err) => console.warn("Audio play error:", err));
                    }
                  }
                }}
                autoPlay
                playsInline
              />
            </div>
            
            {/* Header / Top Controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <UserAvatar 
                  avatarUrl={participants.find(p => p.id === activeWatchingStream.userId)?.avatar_url}
                  name={activeWatchingStream.username}
                  size="h-5 w-5"
                  className="border border-white/10"
                />
                <span className="text-xs font-medium text-white">
                  {activeWatchingStream.userId === myProfile.id ? "Sua Transmissão" : `Transmissão de ${activeWatchingStream.username}`}
                </span>
                <div className="flex items-center gap-1 bg-red-500 px-1.5 py-0.5 rounded text-[8px] font-bold text-white ml-2">
                  AO VIVO
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeWatchingStream.userId !== myProfile.id && (
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    <button 
                      onClick={() => setIsMutedStream(!isMutedStream)}
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      {isMutedStream || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={isMutedStream ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        if (parseFloat(e.target.value) > 0) setIsMutedStream(false);
                      }}
                      className="w-20 h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-[#00D1FF]"
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={toggleFullscreen}
                    className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                    title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  
                  <button 
                    onClick={() => setActiveWatchingStream(null)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/30 rounded-lg text-xs transition-colors cursor-pointer font-medium"
                  >
                    Parar de Assistir
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Participant Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start transition-all duration-300">
            {/* Local Participant */}
            <div className={`relative rounded-xl bg-[#121212] border-2 transition-all duration-300 flex flex-col items-center justify-center p-6 aspect-video ${
              !isMuted ? "border-[#00D1FF]/30 shadow-[0_0_15px_rgba(0,209,255,0.1)]" : "border-white/5"
            }`}>
              <UserAvatar 
                avatarUrl={myProfile?.avatar_url}
                name={myProfile?.display_name || myProfile?.username}
                size="h-20 w-20"
                className="border-2 border-white/10"
              />
              <span className="mt-4 text-sm font-medium text-zinc-200">
                {myProfile?.display_name || myProfile?.username} (Você)
              </span>
              <div className="absolute top-3 right-3 flex gap-2">
                {isMuted && <MicOff size={16} className="text-red-500" />}
                {isDeafened && <Headphones size={16} className="text-red-500" />}
                {isSharingScreen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (screenStream) {
                        setActiveWatchingStream({
                          userId: myProfile.id,
                          username: myProfile.display_name || myProfile.username,
                          stream: screenStream
                        });
                      }
                    }}
                    className="h-8 w-8 bg-zinc-800/80 hover:bg-[#00D1FF] text-zinc-400 hover:text-black rounded-lg transition-all"
                  >
                    <Eye size={14} />
                  </Button>
                )}
              </div>
            </div>

            {/* Remote Participants */}
            {participants.map(p => {
              if (p.id === myProfile.id) return null;
              return (
                <div 
                  key={p.id} 
                  className={`relative rounded-xl bg-[#121212] border-2 transition-all duration-300 flex flex-col items-center justify-center p-6 aspect-video ${
                    p.isSpeaking || p.isTalking ? "border-[#00D1FF] shadow-[0_0_20px_rgba(0,209,255,0.2)]" : "border-white/5"
                  }`}
                >
                  <UserAvatar 
                    avatarUrl={p.avatar_url}
                    name={p.display_name || p.username}
                    size="h-20 w-20"
                    className="border-2 border-white/10"
                  />
                  <span className="mt-4 text-sm font-medium text-zinc-200">
                    {p.display_name || p.username}
                  </span>
                  <div className="absolute top-3 right-3 flex gap-2">
                    {p.isMuted && <MicOff size={16} className="text-red-500" />}
                    {p.isDeafened && <Headphones size={16} className="text-red-500" />}
                  </div>
                  {p.isSharingScreen && (
                    <div className="absolute bottom-3 left-3 flex flex-col gap-2">
                      <div className="bg-[#00D1FF]/20 text-[#00D1FF] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                        <Monitor size={10} />
                        AO VIVO
                      </div>
                      <Button
                        onClick={() => {
                          const participantId = p.id;
                          const participantName = p.display_name || p.username;
                          
                          // 1. Tenta pegar do mapa de streams
                          let stream = remoteVideoStreams.current?.get(participantId);
                          
                          // 2. FALLBACK INFALÍVEL: Extrai direto da RTCPeerConnection ativa
                          if (!stream) {
                            const pc = peerConnections.current?.get(participantId);
                            const videoReceiver = pc?.getReceivers().find(r => r.track && r.track.kind === 'video');
                            if (videoReceiver && videoReceiver.track) {
                              stream = new MediaStream([videoReceiver.track]);
                              remoteVideoStreams.current.set(participantId, stream);
                            }
                          }
                          
                          if (stream && stream.getVideoTracks().length > 0) {
                            setActiveWatchingStream({
                              userId: participantId,
                              username: participantName,
                              stream: stream
                            });
                          } else {
                            toast.info("Aguardando início da transmissão de vídeo...");
                          }
                        }}
                        className="bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 text-[10px] h-7 px-3 font-bold rounded-lg glow-sm"
                      >
                        <Eye size={12} className="mr-1" />
                        Assistir Transmissão
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-24 flex items-center justify-center px-6 pointer-events-none pb-4">
        <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/10 flex items-center p-2 gap-3 rounded-2xl shadow-2xl pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className={`h-12 w-12 rounded-xl transition-all p-3 cursor-pointer ${
              isMuted ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDeafen}
            className={`h-12 w-12 rounded-xl transition-all p-3 cursor-pointer ${
              isDeafened ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {isDeafened ? <Headphones size={22} className="text-red-500" /> : <Headphones size={22} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleNoiseSuppression}
            className={`h-12 w-12 rounded-xl transition-all p-3 cursor-pointer ${
              isNoiseSuppressionEnabled ? "bg-[#00D1FF]/10 text-[#00D1FF] hover:bg-[#00D1FF]/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <ShieldCheck size={22} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleScreenShare}
            className={`h-12 w-12 rounded-xl transition-all p-3 cursor-pointer ${
              isSharingScreen ? "bg-[#00D1FF]/10 text-[#00D1FF] hover:bg-[#00D1FF]/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >

            <Monitor size={22} />
          </Button>

          <div className="w-px h-8 bg-white/10 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onDisconnect}
            className="h-12 w-12 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all p-3 cursor-pointer"
          >
            <PhoneOff size={22} />
          </Button>
        </div>
      </div>
    </div>
  );
};


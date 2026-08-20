import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Monitor, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { VoiceParticipant } from '@/hooks/useVoiceRoom';

interface VoiceRoomUIProps {
  participants: VoiceParticipant[];
  myProfile: any;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleScreenShare: () => void;
  onDisconnect: () => void;
  onClose?: () => void;
}

const VideoScreen = ({ stream }: { stream: MediaStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      muted 
      className="w-full h-full max-h-[70vh] rounded-xl object-contain bg-black shadow-2xl border border-white/5" 
    />
  );
};

export const VoiceRoomUI: React.FC<VoiceRoomUIProps> = ({
  participants,
  myProfile,
  isMuted,
  isDeafened,
  isSharingScreen,
  toggleMute,
  toggleDeafen,
  toggleScreenShare,
  onDisconnect,
  onClose
}) => {
  const remoteAudiosRef = useRef<Record<string, HTMLAudioElement>>({});
  
  // Look for someone sharing their screen
  const screenSharer = participants.find(p => p.isSharingScreen && p.stream);

  useEffect(() => {
    participants.forEach(p => {
      if (p.stream && !remoteAudiosRef.current[p.id]) {
        const audio = new Audio();
        audio.srcObject = p.stream;
        audio.autoplay = true;
        remoteAudiosRef.current[p.id] = audio;
      } else if (p.stream && remoteAudiosRef.current[p.id]) {
        const audioElement = remoteAudiosRef.current[p.id];
        if (audioElement) {
          audioElement.srcObject = p.stream;
        }
      }
    });

    // Cleanup disconnected participants
    Object.keys(remoteAudiosRef.current).forEach(id => {
      if (!participants.find(p => p.id === id)) {
        const audioElement = remoteAudiosRef.current[id];
        if (audioElement) {
          audioElement.pause();
          audioElement.srcObject = null;
          delete remoteAudiosRef.current[id];
        }
      }
    });
  }, [participants]);

  useEffect(() => {
    Object.values(remoteAudiosRef.current).forEach(audio => {
      if (audio) {
        audio.muted = isDeafened;
      }
    });
  }, [isDeafened]);

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
        {screenSharer && screenSharer.stream && (
          <div className="flex-1 flex items-center justify-center animate-in zoom-in-95 duration-300">
            <div className="w-full max-w-5xl relative group">
              <VideoScreen stream={screenSharer.stream} />
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <Avatar className="h-5 w-5 border border-white/10">
                  <AvatarImage src={screenSharer.avatar_url || ""} />
                  <AvatarFallback className="text-[8px] bg-zinc-800">
                    {screenSharer.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-white">{screenSharer.display_name || screenSharer.username} está compartilhando</span>
                <div className="flex items-center gap-1 bg-red-500 px-1.5 py-0.5 rounded text-[8px] font-bold text-white ml-2">
                  AO VIVO
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Participant Grid */}
        <div className={`grid gap-4 content-start transition-all duration-300 ${
          screenSharer ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        }`}>
          {/* Local Participant */}
          <div className={`relative rounded-xl bg-[#121212] border-2 transition-all duration-300 flex flex-col items-center justify-center p-6 ${
            screenSharer ? "aspect-square" : "aspect-video"
          } ${
            !isMuted ? "border-[#00D1FF]/30 shadow-[0_0_15px_rgba(0,209,255,0.1)]" : "border-white/5"
          }`}>
            <Avatar className={`${screenSharer ? "h-12 w-12" : "h-20 w-20"} border-2 border-white/10`}>
              <AvatarImage src={myProfile?.avatar_url || ""} />
              <AvatarFallback className="text-xl bg-[#00D1FF]/10 text-[#00D1FF]">
                {(myProfile?.username || "U").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!screenSharer && (
              <span className="mt-4 text-sm font-medium text-zinc-200">
                {myProfile?.display_name || myProfile?.username} (Você)
              </span>
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              {isMuted && <MicOff size={screenSharer ? 12 : 16} className="text-red-500" />}
              {isDeafened && <Headphones size={screenSharer ? 12 : 16} className="text-red-500" />}
            </div>
          </div>

          {/* Remote Participants */}
          {participants.map(p => (
            <div 
              key={p.id} 
              className={`relative rounded-xl bg-[#121212] border-2 transition-all duration-300 flex flex-col items-center justify-center p-6 ${
                screenSharer ? "aspect-square" : "aspect-video"
              } ${
                p.isTalking ? "border-[#00D1FF] shadow-[0_0_20px_rgba(0,209,255,0.2)]" : "border-white/5"
              }`}
            >
              <Avatar className={`${screenSharer ? "h-12 w-12" : "h-20 w-20"} border-2 border-white/10`}>
                <AvatarImage src={p.avatar_url || ""} />
                <AvatarFallback className="text-xl bg-zinc-800 text-zinc-400">
                  {p.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!screenSharer && (
                <span className="mt-4 text-sm font-medium text-zinc-200">
                  {p.display_name || p.username}
                </span>
              )}
              <div className="absolute top-3 right-3 flex gap-2">
                {p.isMuted && <MicOff size={screenSharer ? 12 : 16} className="text-red-500" />}
                {p.isDeafened && <Headphones size={screenSharer ? 12 : 16} className="text-red-500" />}
              </div>
              {p.isSharingScreen && !screenSharer && (
                <div className="absolute bottom-3 left-3 bg-[#00D1FF]/20 text-[#00D1FF] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Monitor size={10} />
                  AO VIVO
                </div>
              )}
            </div>
          ))}
        </div>
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

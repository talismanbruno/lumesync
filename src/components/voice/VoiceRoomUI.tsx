import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Monitor } from 'lucide-react';
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
}

export const VoiceRoomUI: React.FC<VoiceRoomUIProps> = ({
  participants,
  myProfile,
  isMuted,
  isDeafened,
  isSharingScreen,
  toggleMute,
  toggleDeafen,
  toggleScreenShare,
  onDisconnect
}) => {
  const remoteAudiosRef = useRef<Record<string, HTMLAudioElement>>({});

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
    <div className="flex flex-1 flex-col h-full bg-[#050505]">
      {/* Participant Grid */}
      <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto content-start">
        {/* Local Participant */}
        <div className={`relative aspect-video rounded-xl bg-[#121212] border-2 transition-all duration-300 flex flex-col items-center justify-center ${
          !isMuted ? "border-[#00D1FF]/30 shadow-[0_0_15px_rgba(0,209,255,0.1)]" : "border-white/5"
        }`}>
          <Avatar className="h-20 w-20 border-2 border-white/10">
            <AvatarImage src={myProfile?.avatar_url || ""} />
            <AvatarFallback className="text-xl bg-[#00D1FF]/10 text-[#00D1FF]">
              {(myProfile?.username || "U").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="mt-4 text-sm font-medium text-zinc-200">
            {myProfile?.display_name || myProfile?.username} (Você)
          </span>
          <div className="absolute top-3 right-3 flex gap-2">
            {isMuted && <MicOff size={16} className="text-red-500" />}
            {isDeafened && <Headphones size={16} className="text-red-500" />}
          </div>
        </div>

        {/* Remote Participants */}
        {participants.map(p => (
          <div 
            key={p.id} 
            className={`relative aspect-video rounded-xl bg-[#121212] border-2 transition-all duration-300 flex flex-col items-center justify-center ${
              p.isTalking ? "border-[#00D1FF] shadow-[0_0_20px_rgba(0,209,255,0.2)]" : "border-white/5"
            }`}
          >
            <Avatar className="h-20 w-20 border-2 border-white/10">
              <AvatarImage src={p.avatar_url || ""} />
              <AvatarFallback className="text-xl bg-zinc-800 text-zinc-400">
                {p.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="mt-4 text-sm font-medium text-zinc-200">
              {p.display_name || p.username}
            </span>
            <div className="absolute top-3 right-3 flex gap-2">
              {p.isMuted && <MicOff size={16} className="text-red-500" />}
              {p.isDeafened && <Headphones size={16} className="text-red-500" />}
            </div>
            {p.isSharingScreen && (
              <div className="absolute bottom-3 left-3 bg-[#00D1FF]/20 text-[#00D1FF] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <Monitor size={10} />
                AO VIVO
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Control Bar */}
      <div className="h-20 bg-[#121212]/80 backdrop-blur-md border-t border-white/5 flex items-center justify-center px-6 gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className={`h-12 w-12 rounded-full transition-all ${
            isMuted ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDeafen}
          className={`h-12 w-12 rounded-full transition-all ${
            isDeafened ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          {isDeafened ? <Headphones size={20} className="text-red-500" /> : <Headphones size={20} />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleScreenShare}
          className={`h-12 w-12 rounded-full transition-all ${
            isSharingScreen ? "bg-[#00D1FF]/10 text-[#00D1FF] hover:bg-[#00D1FF]/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Monitor size={20} />
        </Button>

        <div className="w-px h-8 bg-white/5 mx-2" />

        <Button
          variant="ghost"
          size="icon"
          onClick={onDisconnect}
          className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
        >
          <PhoneOff size={20} />
        </Button>
      </div>
    </div>
  );
};

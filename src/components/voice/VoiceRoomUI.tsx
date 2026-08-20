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
  screenStream: MediaStream | null; // Added screenStream prop
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleScreenShare: () => void;
  onDisconnect: () => void;
  onClose?: () => void;
}

export const VoiceRoomUI: React.FC<VoiceRoomUIProps> = ({
  participants,
  myProfile,
  isMuted,
  isDeafened,
  isSharingScreen,
  screenStream,
  toggleMute,
  toggleDeafen,
  toggleScreenShare,
  onDisconnect,
  onClose
}) => {
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
        {screenStream ? (
          <div className="flex-1 flex items-center justify-center animate-in zoom-in-95 duration-300">
            <div className="w-full max-w-5xl relative group aspect-video bg-black rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(0,209,255,0.1)]">
              <video
                ref={(el) => { if (el) el.srcObject = screenStream; }}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <Avatar className="h-5 w-5 border border-white/10">
                  <AvatarImage src={myProfile?.avatar_url || ""} />
                  <AvatarFallback className="text-[8px] bg-zinc-800">
                    {myProfile?.username?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-white">Você está compartilhando a tela</span>
                <div className="flex items-center gap-1 bg-red-500 px-1.5 py-0.5 rounded text-[8px] font-bold text-white ml-2">
                  AO VIVO
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
            {participants.map(p => {
              if (p.id === myProfile.id) return null;
              return (
                <div 
                  key={p.id} 
                  className={`relative rounded-xl bg-[#121212] border-2 transition-all duration-300 flex flex-col items-center justify-center p-6 aspect-video ${
                    p.isSpeaking || p.isTalking ? "border-[#00D1FF] shadow-[0_0_20px_rgba(0,209,255,0.2)]" : "border-white/5"
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


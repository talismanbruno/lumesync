import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, PhoneOff, Headphones } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface Participant {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  isTalking?: boolean;
  stream?: MediaStream;
}

interface VoiceRoomUIProps {
  participants: Participant[];
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
  const sharingParticipant = participants.find(p => p.isSharingScreen) || (isSharingScreen ? { ...myProfile, id: myProfile.id, isSharingScreen: true } : null);

  return (
    <div className="flex flex-1 flex-col bg-[#050505] relative overflow-hidden">
      {/* Stage / Grid Area */}
      <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden">
        {sharingParticipant ? (
          <div className="w-full h-full flex flex-col gap-4">
             {/* Screen Share Stage */}
             <div className="flex-1 bg-black rounded-xl overflow-hidden relative border border-white/5">
                <VideoPlayer stream={sharingParticipant.stream} isLocal={sharingParticipant.id === myProfile.id} />
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold text-white">
                  {sharingParticipant.display_name || sharingParticipant.username} está compartilhando a tela
                </div>
             </div>
             
             {/* Miniatures */}
             <div className="h-32 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {participants.map(p => (
                   <ParticipantCard key={p.id} participant={p} isMini />
                ))}
                <ParticipantCard 
                  participant={{
                    ...myProfile,
                    isMuted,
                    isDeafened,
                    isSharingScreen,
                    isTalking: false // Local talking state can be added if needed
                  }} 
                  isMini 
                  isLocal 
                />
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl overflow-y-auto max-h-full p-4 scrollbar-hide">
            {participants.map(p => (
              <ParticipantCard key={p.id} participant={p} />
            ))}
            <ParticipantCard 
              participant={{
                ...myProfile,
                isMuted,
                isDeafened,
                isSharingScreen,
                isTalking: false
              }} 
              isLocal 
            />
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="h-20 border-t border-white/5 bg-[#121212]/80 backdrop-blur-xl flex items-center justify-center gap-4 px-6">
        <div className="flex items-center gap-3 bg-[#050505]/40 p-1.5 rounded-2xl border border-white/5 shadow-2xl">
          <ControlButton 
            icon={isMuted ? MicOff : Mic} 
            active={!isMuted} 
            onClick={toggleMute} 
            danger={isMuted}
            label={isMuted ? "Desmutar" : "Mutar"}
          />
          <ControlButton 
            icon={Headphones} 
            active={!isDeafened} 
            onClick={toggleDeafen} 
            danger={isDeafened}
            label={isDeafened ? "Ativar Áudio" : "Ensurdecer"}
          />
          <ControlButton 
            icon={Monitor} 
            active={isSharingScreen} 
            onClick={toggleScreenShare} 
            label="Compartilhar"
          />
          <ControlButton 
            icon={PhoneOff} 
            onClick={onDisconnect} 
            danger 
            label="Sair"
          />
        </div>
      </div>
    </div>
  );
};

const ParticipantCard: React.FC<{ participant: Participant; isMini?: boolean; isLocal?: boolean }> = ({ participant, isMini, isLocal }) => {
  return (
    <div className={`relative bg-[#121212] rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center overflow-hidden shadow-xl
      ${participant.isTalking ? "border-[#00D1FF] glow-sm scale-[1.02]" : "border-white/5"}
      ${isMini ? "w-40 h-full flex-shrink-0" : "aspect-video w-full"}
    `}>
      <Avatar className={`${isMini ? "h-12 w-12" : "h-24 w-24"} border-2 border-white/5 shadow-2xl`}>
        <AvatarImage src={participant.avatar_url || ""} />
        <AvatarFallback className="bg-[#00D1FF]/10 text-[#00D1FF] font-bold text-xl">
          {participant.username.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="mt-4 flex flex-col items-center">
        <span className="text-sm font-bold text-white">{participant.display_name || participant.username}</span>
        <div className="flex gap-2 mt-1">
          {participant.isMuted && <MicOff size={12} className="text-red-500" />}
          {participant.isDeafened && <Headphones size={12} className="text-red-500" />}
        </div>
      </div>

      {!isLocal && participant.stream && (
        <audio 
          ref={el => { if (el) el.srcObject = participant.stream!; }} 
          autoPlay 
          playsInline 
        />
      )}
    </div>
  );
};

const VideoPlayer: React.FC<{ stream?: MediaStream; isLocal?: boolean }> = ({ stream, isLocal }) => {
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
      muted={isLocal}
      className="w-full h-full object-contain"
    />
  );
};

const ControlButton: React.FC<{ 
  icon: any; 
  active?: boolean; 
  onClick: () => void; 
  danger?: boolean; 
  label: string;
}> = ({ icon: Icon, active, onClick, danger, label }) => {
  return (
    <div className="flex flex-col items-center gap-1 group">
      <button
        onClick={onClick}
        className={`h-11 w-11 flex items-center justify-center rounded-xl transition-all duration-200 shadow-lg
          ${danger 
            ? "bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500 hover:text-white" 
            : active 
              ? "bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/40 hover:bg-[#00D1FF] hover:text-black" 
              : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white"}
        `}
      >
        <Icon size={20} />
      </button>
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </div>
  );
};

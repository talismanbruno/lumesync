import React from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Monitor, Maximize2, ScreenShare } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { VoiceParticipant } from '@/hooks/useVoiceRoom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActiveCallBarProps {
  roomName: string;
  participants: VoiceParticipant[];
  myProfile: any;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  onOpenStage: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
}

export const ActiveCallBar: React.FC<ActiveCallBarProps> = ({
  roomName,
  participants,
  myProfile,
  isMuted,
  isDeafened,
  isSharingScreen,
  onOpenStage,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onDisconnect
}) => {
  const visibleParticipants = participants.slice(0, 4);
  const extraCount = participants.length > 4 ? participants.length - 4 : 0;

  return (
    <div className="h-12 px-4 bg-[#121212]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between shrink-0 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex -space-x-2 shrink-0">
          {visibleParticipants.map((p) => (
            <div 
              key={p.id} 
              className={`relative rounded-full border-2 border-[#121212] transition-transform ${p.isSpeaking || p.isTalking ? "scale-110 border-cyan-500 z-10" : "z-0"}`}
            >
              <UserAvatar 
                avatarUrl={p.avatar_url} 
                name={p.display_name || p.username} 
                size="h-6 w-6" 
                className="rounded-full"
              />
              {p.id === myProfile.id && (
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-cyan-500 rounded-full border border-[#121212]" />
              )}
            </div>
          ))}
          {extraCount > 0 && (
            <div className="h-6 w-6 rounded-full bg-zinc-800 border-2 border-[#121212] flex items-center justify-center text-[10px] font-bold text-zinc-400 z-0">
              +{extraCount}
            </div>
          )}
        </div>
        
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-zinc-200 truncate">{roomName}</span>
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
            {participants.length} participante{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onOpenStage}
                className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <Maximize2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir Palco</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleMute}
                className={`h-8 w-8 ${isMuted ? "text-red-500 bg-red-500/10 hover:bg-red-500/20" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isMuted ? 'Desmutar' : 'Mutar'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleDeafen}
                className={`h-8 w-8 ${isDeafened ? "text-red-500 bg-red-500/10 hover:bg-red-500/20" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
              >
                <Headphones size={16} className={isDeafened ? "text-red-500" : ""} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDeafened ? 'Ouvir' : 'Ensurdecer'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleScreenShare}
                className={`h-8 w-8 ${isSharingScreen ? "text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
              >
                <ScreenShare size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isSharingScreen ? 'Parar Tela' : 'Compartilhar Tela'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onDisconnect}
                className="h-8 w-8 text-red-500 hover:bg-red-500 hover:text-black transition-all"
              >
                <PhoneOff size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Encerrar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

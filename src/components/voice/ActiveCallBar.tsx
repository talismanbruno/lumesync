import React from 'react';
import { Mic, MicOff, Headphones, Monitor, PhoneOff, Maximize2, Settings2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { VoiceParticipant, ConnectionStatus } from '@/hooks/useVoiceRoom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActiveCallBarProps {
  participants: VoiceParticipant[];
  roomName: string;
  connectionStatus: ConnectionStatus;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  isNoiseSuppressionEnabled: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onToggleNoiseSuppression: () => void;
  onDisconnect: () => void;
  onOpenStage: () => void;
}

export const ActiveCallBar: React.FC<ActiveCallBarProps> = ({
  participants,
  roomName,
  connectionStatus,
  isMuted,
  isDeafened,
  isSharingScreen,
  isNoiseSuppressionEnabled,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onToggleNoiseSuppression,
  onDisconnect,
  onOpenStage
}) => {
  const statusColors = {
    connecting: 'bg-zinc-500',
    connected: 'bg-emerald-500',
    reconnecting: 'bg-amber-500',
    unstable: 'bg-orange-500',
    failed: 'bg-red-500'
  };

  const visibleParticipants = participants.slice(0, 4);
  const remainingCount = participants.length - 4;

  return (
    <div className="h-14 bg-[#121212]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 animate-in slide-in-from-top duration-300 z-40">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={onOpenStage}>
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColors[connectionStatus]} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
            {connectionStatus === 'connecting' && (
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-zinc-400 animate-ping" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              {roomName}
              <Maximize2 size={10} className="text-zinc-500 group-hover:text-[#00D1FF] transition-colors" />
            </span>
            <span className="text-[10px] text-zinc-500 font-medium lowercase">
              {connectionStatus} • {participants.length} participante{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10 mx-2" />

        <div className="flex -space-x-2">
          {visibleParticipants.map((p) => (
            <div key={p.id} className="relative group">
              <UserAvatar 
                avatarUrl={p.avatar_url}
                name={p.username}
                size="h-7 w-7"
                className={`border-2 border-[#121212] transition-transform group-hover:-translate-y-0.5 ${p.isSpeaking ? 'ring-2 ring-[#00D1FF] ring-offset-1 ring-offset-[#121212]' : ''}`}
              />
              {p.isMuted && (
                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5 border border-[#121212]">
                  <MicOff size={8} className="text-white" />
                </div>
              )}
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="h-7 w-7 rounded-full bg-zinc-800 border-2 border-[#121212] flex items-center justify-center text-[10px] font-bold text-zinc-400">
              +{remainingCount}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleNoiseSuppression}
                className={`h-8 w-8 rounded-lg transition-all ${isNoiseSuppressionEnabled ? 'text-[#00D1FF] bg-[#00D1FF]/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
              >
                {isNoiseSuppressionEnabled ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#121212] border-white/10 text-xs">
              Supressão de Ruído: {isNoiseSuppressionEnabled ? 'Ativada' : 'Desativada'}
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMute}
                className={`h-9 w-9 rounded-lg transition-all ${isMuted ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#121212] border-white/10 text-xs">
              {isMuted ? 'Desmutar' : 'Mutar'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleDeafen}
                className={`h-9 w-9 rounded-lg transition-all ${isDeafened ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
              >
                <Headphones size={18} className={isDeafened ? 'text-red-500' : ''} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#121212] border-white/10 text-xs">
              {isDeafened ? 'Ativar Áudio' : 'Ensurdecer'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleScreenShare}
                className={`h-9 w-9 rounded-lg transition-all ${isSharingScreen ? 'text-[#00D1FF] bg-[#00D1FF]/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
              >
                <Monitor size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#121212] border-white/10 text-xs">
              Compartilhar Tela
            </TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon"
            onClick={onDisconnect}
            className="h-9 w-9 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all ml-2"
          >
            <PhoneOff size={18} />
          </Button>
        </TooltipProvider>
      </div>
    </div>
  );
};

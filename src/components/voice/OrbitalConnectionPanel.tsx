import React from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Monitor, Maximize2, Wifi, ScreenShare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrbitalConnectionPanelProps {
  status: 'Conectando' | 'Conectado' | 'Reconectando' | 'Conexão instável' | 'Falha na conexão';
  roomName: string;
  contextName: string;
  participantCount: number;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  onOpenStage: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
}

export const OrbitalConnectionPanel: React.FC<OrbitalConnectionPanelProps> = ({
  status,
  roomName,
  contextName,
  participantCount,
  isMuted,
  isDeafened,
  isSharingScreen,
  onOpenStage,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onDisconnect
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'Conectado': return 'text-cyan-400';
      case 'Conectando':
      case 'Reconectando': return 'text-amber-400';
      case 'Conexão instável': return 'text-amber-500';
      case 'Falha na conexão': return 'text-red-500';
      default: return 'text-zinc-500';
    }
  };

  return (
    <div className="mx-2 mb-2 p-3 bg-[#121212] border border-white/5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Wifi size={14} className={getStatusColor()} />
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${getStatusColor()}`}>
              {status}
            </span>
            <span className="text-[11px] font-medium text-zinc-200 truncate">{roomName}</span>
            <span className="text-[9px] text-zinc-500 truncate">{contextName} • {participantCount} online</span>
          </div>
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onOpenStage}
                className="h-7 w-7 text-zinc-500 hover:text-white hover:bg-white/5 shrink-0"
              >
                <Maximize2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver Palco</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center justify-between gap-1 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onToggleMute}
                  className={`h-8 w-8 rounded-lg ${isMuted ? "bg-red-500/10 text-red-500" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Microfone</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onToggleDeafen}
                  className={`h-8 w-8 rounded-lg ${isDeafened ? "bg-red-500/10 text-red-500" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                >
                  <Headphones size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Áudio</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onToggleScreenShare}
                  className={`h-8 w-8 rounded-lg ${isSharingScreen ? "bg-cyan-500/10 text-cyan-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                >
                  <ScreenShare size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tela</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onDisconnect}
                className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
              >
                <PhoneOff size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Desconectar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

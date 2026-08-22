import React from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Settings2, Signal, SignalHigh, SignalLow, Zap } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { ConnectionStatus, LumeProfile } from '@/hooks/useVoiceRoom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrbitalConnectionPanelProps {
  myProfile: LumeProfile | null;
  connectionStatus: ConnectionStatus;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}

export const OrbitalConnectionPanel: React.FC<OrbitalConnectionPanelProps> = ({
  myProfile,
  connectionStatus,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  onDisconnect,
  onOpenSettings
}) => {
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <SignalHigh size={14} className="text-emerald-500" />;
      case 'unstable': return <SignalLow size={14} className="text-orange-500" />;
      case 'reconnecting': return <Zap size={14} className="text-amber-500 animate-pulse" />;
      case 'failed': return <Signal size={14} className="text-red-500" />;
      case 'idle': return <Signal size={14} className="text-zinc-700" />;
      default: return <Signal size={14} className="text-zinc-500 animate-pulse" />;
    }
  };

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected': return 'Voz Conectada';
      case 'unstable': return 'Conexão Instável';
      case 'reconnecting': return 'Reconectando...';
      case 'failed': return 'Erro de Conexão';
      case 'idle': return 'Desconectado';
      default: return 'Conectando...';
    }
  };

  return (
    <div className="mx-2 mb-2 p-3 bg-[#121212] border border-white/5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            {getStatusIcon()}
            <span className={`text-[11px] font-bold uppercase tracking-tight ${
              connectionStatus === 'connected' ? 'text-emerald-500' : 
              connectionStatus === 'failed' ? 'text-red-500' : 'text-zinc-400'
            }`}>
              {getStatusLabel()}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-medium leading-none mt-0.5">
            RTC Ativo • Lume Orbital
          </span>
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className="h-7 w-7 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
              >
                <Settings2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-[#121212] border-white/10 text-[10px]">
              Configurações de Áudio
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center justify-between bg-black/40 rounded-lg p-1">
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleMute}
                  className={`h-8 w-8 rounded-md transition-all ${
                    isMuted ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-[#121212] border-white/10 text-[10px]">
                {isMuted ? 'Desmutar' : 'Mutar'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleDeafen}
                  className={`h-8 w-8 rounded-md transition-all ${
                    isDeafened ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Headphones size={16} className={isDeafened ? 'text-red-500' : ''} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-[#121212] border-white/10 text-[10px]">
                {isDeafened ? 'Ativar Áudio' : 'Ensurdecer'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDisconnect}
          className="h-8 w-8 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
        >
          <PhoneOff size={16} />
        </Button>
      </div>
    </div>
  );
};

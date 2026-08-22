import React from 'react';
import { UserAvatar } from './UserAvatar';
import { MessageSquare, Phone, Check, X, ShieldCheck } from 'lucide-react';
import { AdminVerifiedBadge } from './AdminVerifiedBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FriendActionButtonsProps {
  friend: any;
  onSelectDM: (friend: any) => void;
  onStartCall: (friend: any) => void;
  isBot?: boolean;
  isSelf?: boolean;
}

export const FriendActionButtons: React.FC<FriendActionButtonsProps> = ({
  friend,
  onSelectDM,
  onStartCall,
  isBot = false,
  isSelf = false
}) => {
  const isOnline = friend.status && friend.status !== 'offline';

  if (isSelf) return null;

  return (
    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => onSelectDM(friend)}
              className="p-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-cyan-500 hover:text-black transition-all outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <MessageSquare size={18} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-[#18181b] border-white/10 text-xs text-white">
            <p>Enviar Mensagem</p>
          </TooltipContent>
        </Tooltip>

        {!isBot && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <button 
                  onClick={() => isOnline && onStartCall(friend)}
                  disabled={!isOnline}
                  className={`p-2.5 rounded-xl transition-all outline-none focus:ring-2 focus:ring-green-500/50 ${
                    isOnline 
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-green-500 hover:text-black' 
                      : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <Phone size={18} />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-[#18181b] border-white/10 text-xs text-white">
              <p>{isOnline ? 'Iniciar Chamada' : 'Usuário indisponível'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
};

import React from "react";
import { Popover, PopoverContent, PopoverTrigger, PopoverPortal } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./button";
import { MessageSquare, Calendar, Edit3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserProfileCardProps {
  user: {
    id: string;
    username: string;
    display_name?: string | null | undefined;
    avatar_url?: string | null | undefined;
    banner_url?: string | null | undefined;
    bio?: string | null | undefined;
    created_at?: string | undefined;
    status?: 'online' | 'idle' | 'dnd' | 'offline' | undefined;
  };
  isMe?: boolean;
  onEditClick?: (() => void) | undefined;
  onMessageClick?: (() => void) | undefined;
  children: React.ReactNode;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  isMe,
  onEditClick,
  onMessageClick,
  children
}) => {
  const joinDate = user.created_at ? format(new Date(user.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Recentemente";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="cursor-pointer">
          {children}
        </div>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent 
          side="right" 
          align="start" 
          sideOffset={12} 
          className="z-50 w-72 bg-[#121214] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-0 animate-in fade-in zoom-in-95 duration-200"
        >
        {/* Banner */}
        <div 
          className="h-[100px] w-full relative bg-cover bg-center"
          style={{ 
            backgroundImage: user.banner_url ? `url(${user.banner_url})` : 'linear-gradient(to bottom right, #121214, rgba(0, 209, 255, 0.2))'
          }}
        >
          {/* Avatar sobreposto */}
          <div className="absolute -bottom-8 left-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border-[6px] border-[#121214] bg-[#121214]">
                <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xl">
                  {user.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <StatusBadge 
                status={user.status} 
                size="lg" 
                className="absolute bottom-1 right-1 border-[4px] border-[#121214] w-6 h-6" 
              />
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="pt-10 px-4 pb-4 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">
              {user.display_name || user.username}
            </h3>
            <p className="text-sm text-zinc-400 font-medium">@{user.username}</p>
          </div>

          {user.bio ? (
            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{user.bio}</p>
            </div>
          ) : (
            <div className="h-px bg-white/5 w-full" />
          )}

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Membro do Lume desde</span>
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <Calendar size={14} className="text-[#00D1FF]" />
                <span>{joinDate}</span>
              </div>
            </div>

            <div className="pt-2">
              {isMe ? (
                <Button 
                  onClick={onEditClick}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border-none h-9 text-xs font-bold gap-2"
                >
                  <Edit3 size={14} />
                  Editar Perfil
                </Button>
              ) : (
                <Button 
                  onClick={onMessageClick}
                  className="w-full bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-black border-none h-9 text-xs font-bold gap-2 glow-sm"
                >
                  <MessageSquare size={14} />
                  Enviar Mensagem
                </Button>
              )}
            </div>
          </div>
        </div>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
};
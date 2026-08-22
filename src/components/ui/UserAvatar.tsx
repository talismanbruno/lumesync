import React from 'react';
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl?: string | null | undefined;
  name?: string | undefined;
  initials?: string | undefined;
  size?: string | undefined;
  className?: string | undefined;
  status?: 'online' | 'idle' | 'dnd' | 'offline' | string | null | undefined;
  showStatus?: boolean | undefined;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  name = "Usuário",
  initials,
  size = "h-10 w-10",
  className,
  status,
  showStatus = false
}) => {
  const userInitials = initials || (name && name.length >= 2 ? name.substring(0, 2).toUpperCase() : 'LM');

  return (
    <div className={cn(
      "relative rounded-full overflow-hidden shrink-0 aspect-square bg-zinc-800 flex items-center justify-center",
      size,
      className
    )}>
      {avatarUrl && avatarUrl.trim() !== "" ? (
        <img 
          src={avatarUrl} 
          alt={name} 
          className="w-full h-full object-cover aspect-square block select-none shrink-0" 
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-cyan-400 select-none">
          {userInitials}
        </div>
      )}
      
      {showStatus && status && (
        <div className={cn(
          "absolute bottom-0 right-0 rounded-full border-2 border-[#050505]",
          size.includes('h-5') ? "w-2 h-2" : size.includes('h-6') ? "w-2.5 h-2.5" : "w-3 h-3",
          status === 'online' ? "bg-[#00D1FF]" : 
          status === 'idle' ? "bg-[#F59E0B]" : 
          status === 'dnd' ? "bg-[#EF4444]" : "bg-[#71717A]"
        )} />
      )}
    </div>
  );
};

import React from 'react';
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string;
  initials?: string;
  size?: string;
  className?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline' | string | null;
  showStatus?: boolean;
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
  const userInitials = initials || name.substring(0, 2).toUpperCase();

  return (
    <div className={cn(
      "relative rounded-full overflow-hidden shrink-0 aspect-square bg-zinc-800 flex items-center justify-center",
      size,
      className
    )}>
      {avatarUrl ? (
        <img 
          src={avatarUrl} 
          alt={name} 
          className="w-full h-full object-cover aspect-square block select-none" 
        />
      ) : (
        <span className="font-bold text-white uppercase">{userInitials}</span>
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

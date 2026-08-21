import React from 'react';
import { cn } from "@/lib/utils";

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

interface StatusBadgeProps {
  status: UserStatus | string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showGlow?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'md', 
  className,
  showGlow = true
}) => {
  const currentStatus = (status || 'offline') as UserStatus;

  const sizeClasses = {
    sm: 'w-2.5 h-2.5 border-[1.5px]',
    md: 'w-3.5 h-3.5 border-2',
    lg: 'w-4 h-4 border-2',
  };

  const statusStyles = {
    online: {
      bg: 'bg-[#00D1FF]',
      shadow: showGlow ? 'shadow-[0_0_8px_rgba(0,209,255,0.6)]' : '',
      icon: null
    },
    idle: {
      bg: 'bg-[#F59E0B]',
      shadow: '',
      icon: null
    },
    dnd: {
      bg: 'bg-[#EF4444]',
      shadow: '',
      icon: (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[60%] h-[2px] bg-[#050505] rounded-full" />
        </div>
      )
    },
    offline: {
      bg: 'bg-[#71717A]',
      shadow: '',
      icon: null
    },
  };

  const style = statusStyles[currentStatus] || statusStyles.offline;

  return (
    <div 
      className={cn(
        "relative rounded-full border-[#050505]",
        sizeClasses[size],
        style.bg,
        style.shadow,
        className
      )}
    >
      {style.icon}
    </div>
  );
};

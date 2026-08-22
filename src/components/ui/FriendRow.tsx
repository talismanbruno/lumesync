import React from 'react';
import { UserAvatar } from './UserAvatar';
import { AdminVerifiedBadge } from './AdminVerifiedBadge';
import { FriendActionButtons } from './FriendActionButtons';

interface FriendRowProps {
  friend: any;
  myProfile: any;
  onSelectDM: (friend: any) => void;
  onStartCall: (friend: any) => void;
  variant?: 'online' | 'all' | 'pending';
  onAcceptRequest?: (id: string) => void;
  onDeclineRequest?: (id: string) => void;
  friendshipId?: string;
  className?: string;
}

export const FriendRow: React.FC<FriendRowProps> = ({
  friend,
  myProfile,
  onSelectDM,
  onStartCall,
  variant = 'all',
  onAcceptRequest,
  onDeclineRequest,
  friendshipId,
  className = ""
}) => {
  if (!friend) return null;

  return (
    <div 
      className={`flex items-center justify-between px-3 h-[64px] sm:h-[72px] rounded-xl bg-[#121212] border border-white/5 group transition-all duration-200 hover:bg-white/[0.03] hover:border-cyan-500/20 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">
          <UserAvatar 
            avatarUrl={friend.avatar_url}
            name={friend.display_name || friend.username}
            status={friend.status}
            showStatus={variant !== 'pending'}
            size="h-10 w-10 sm:h-11 sm:w-11"
            className="rounded-xl"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold text-white truncate">
              {friend.display_name || friend.username}
            </span>
            <AdminVerifiedBadge isAdmin={friend.is_admin} size={14} />
          </div>
          {friend.bio && variant !== 'pending' && (
            <span className="text-[11px] text-zinc-500 truncate font-medium">
              {friend.bio}
            </span>
          )}
          {variant === 'pending' && (
            <span className="text-[10px] text-zinc-500 font-medium">
              Enviou um pedido de amizade
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {variant === 'pending' ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => friendshipId && onAcceptRequest?.(friendshipId)}
              className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-black transition-all"
              title="Aceitar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button 
              onClick={() => friendshipId && onDeclineRequest?.(friendshipId)}
              className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-black transition-all"
              title="Recusar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        ) : (
          <FriendActionButtons 
            friend={friend}
            onSelectDM={onSelectDM}
            onStartCall={onStartCall}
            isBot={friend.id === 'lume-bot-fixed' || friend.username === 'lume'}
            isSelf={friend.id === myProfile.id}
          />
        )}
      </div>
    </div>
  );
};

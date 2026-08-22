import React, { useState } from 'react';
import { UserAvatar } from './UserAvatar';
import { MessageSquare, Phone, UserPlus, Clock, Users, Plus, X, Search, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import { Button } from './button';
import { Input } from './input';
import { toast } from 'sonner';
import { AdminVerifiedBadge } from './AdminVerifiedBadge';

interface FriendsViewProps {
  activeSubTab: 'online' | 'all' | 'pending' | 'add';
  onChangeSubTab?: (tab: 'online' | 'all' | 'pending' | 'add') => void;
  friendships: any[];
  myProfile: any;
  onSelectDM: (friend: any) => void;
  onAcceptRequest: (id: string) => void;
  onDeclineRequest: (id: string) => void;
  onSendRequest?: (username: string) => void;
}

const TABS: { key: 'online' | 'all' | 'pending' | 'add'; label: string }[] = [
  { key: 'online', label: 'Disponível' },
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'add', label: 'Adicionar Amigo' },
];

export const FriendsView: React.FC<FriendsViewProps> = ({
  activeSubTab,
  onChangeSubTab,
  friendships,
  myProfile,
  onSelectDM,
  onAcceptRequest,
  onDeclineRequest,
  onSendRequest
}) => {
  const [addUsername, setAddUsername] = useState("");

  const friends = friendships
    .filter(f => f.status === 'accepted')
    .map(f => f.friend_profile)
    .filter(Boolean);

  const onlineFriends = friends.filter(f => f.status && f.status !== 'offline');

  const pendingIncoming = friendships.filter(f => f.status === 'pending' && f.addressee_id === myProfile.id);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      <header className="h-14 px-6 border-b border-white/5 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-zinc-300 shrink-0">
          <Users size={18} className="text-zinc-500" />
          <span className="font-bold text-sm">Amigos</span>
        </div>
        <div className="h-6 w-px bg-white/5" />
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onChangeSubTab?.(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeSubTab === tab.key
                  ? tab.key === 'add'
                    ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,209,255,0.25)]'
                    : 'bg-white/10 text-white'
                  : tab.key === 'add'
                    ? 'text-cyan-400 hover:bg-cyan-500/10'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>


      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {activeSubTab === 'online' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Disponível — {onlineFriends.length}</h3>
            {onlineFriends.length > 0 ? (
              <div className="grid gap-2">
                {onlineFriends.map(friend => (
                  <div key={friend.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#121214] border border-white/5 group hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        avatarUrl={friend.avatar_url}
                        name={friend.display_name || friend.username}
                        status={friend.status}
                        showStatus={true}
                        size="h-12 w-12"
                        className="rounded-xl"
                      />
                      <div>
                        <p className="text-sm font-bold text-white flex items-center gap-1.5">
                          {friend.display_name || friend.username}
                          <AdminVerifiedBadge isAdmin={friend.is_admin} size={14} />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onSelectDM(friend)}
                        className="p-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-cyan-500 hover:text-black transition-all"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button className="p-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-green-500 hover:text-black transition-all">
                        <Phone size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-600 space-y-2">
                <Users size={48} strokeWidth={1} className="opacity-20" />
                <p className="text-sm">Ninguém disponível no momento.</p>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'all' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Todos os Amigos — {friends.length}</h3>
            <div className="grid gap-2">
              {friends.map(friend => (
                <div key={friend.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#121214] border border-white/5 group hover:border-zinc-700 transition-all">
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      avatarUrl={friend.avatar_url}
                      name={friend.display_name || friend.username}
                      status={friend.status}
                      showStatus={true}
                      size="h-10 w-10"
                      className="rounded-xl"
                    />
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        {friend.display_name || friend.username}
                        <AdminVerifiedBadge isAdmin={friend.is_admin} size={14} />
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onSelectDM(friend)}
                    className="p-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-cyan-500 hover:text-black transition-all opacity-0 group-hover:opacity-100"
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'pending' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Solicitações Recebidas — {pendingIncoming.length}</h3>
              {pendingIncoming.length > 0 ? pendingIncoming.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#121214] border border-white/5">
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      avatarUrl={f.friend_profile?.avatar_url}
                      name={f.friend_profile?.display_name || f.friend_profile?.username}
                      size="h-10 w-10"
                      className="rounded-xl"
                    />
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        {f.friend_profile?.display_name || f.friend_profile?.username}
                        <AdminVerifiedBadge isAdmin={f.friend_profile?.is_admin} size={14} />
                      </p>
                      <p className="text-[10px] text-zinc-500 font-medium">Enviou um pedido de amizade</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onAcceptRequest(f.id)}
                      className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-black transition-all"
                      title="Aceitar"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      onClick={() => onDeclineRequest(f.id)}
                      className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-black transition-all"
                      title="Recusar"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-zinc-500 text-sm">Nenhuma solicitação pendente</div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'add' && (
          <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Adicionar Amigo</h2>
              <p className="text-sm text-zinc-500">Você pode adicionar amigos usando o username do Lume.</p>
            </div>
            
            <div className="relative group">
              <Input 
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="Ex: @username"
                className="h-14 bg-black/40 border-white/5 text-white rounded-2xl pl-4 pr-32 focus:border-cyan-500/50 transition-all placeholder:text-zinc-700"
              />
              <Button 
                onClick={async () => {
                  const input = addUsername.trim().replace(/^@/, "").toLowerCase();
                  if (!input) {
                    toast.error("Digite um nome de usuário!");
                    return;
                  }
                  
                  try {
                    // Use the secure RPC for case-insensitive search
                    const { data: results, error: rpcError } = await supabase
                      .rpc('find_profile_by_username', { p_username: input });

                    if (rpcError) throw rpcError;
                    
                    const targetProfile = results && results.length > 0 ? results[0] : null;
                    
                    if (!targetProfile) {
                      toast.error("Este usuário não existe!");
                      return;
                    }

                    if (targetProfile.id === myProfile.id) {
                      toast.error("Você não pode adicionar a si mesmo!");
                      return;
                    }

                    // 2. Verifica se já existe amizade ou pedido
                    const { data: existingFriendship, error: friendshipError } = await supabase
                      .from('friendships')
                      .select('*')
                      .or(`and(requester_id.eq.${myProfile.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${myProfile.id})`)
                      .maybeSingle();

                    if (friendshipError) throw friendshipError;

                    if (existingFriendship) {
                      toast.info("Você já possui uma amizade ou pedido pendente com este usuário!");
                      return;
                    }

                    // 3. Envia solicitação
                    const { error: sendError } = await supabase
                      .from('friendships')
                      .insert({
                        requester_id: myProfile.id,
                        addressee_id: targetProfile.id,
                        status: 'pending'
                      });

                    if (sendError) throw sendError;

                    toast.success("Pedido de amizade enviado com sucesso!");
                    setAddUsername("");
                    if (onSendRequest) onSendRequest(input); // Callback opcional se necessário
                  } catch (err: any) {
                    console.error("Erro ao adicionar amigo:", err);
                    toast.error("Erro ao processar solicitação.");
                  }
                }}
                className="absolute right-2 top-2 h-10 bg-cyan-500 text-black hover:bg-cyan-400 font-bold px-4 rounded-xl shadow-[0_0_15px_rgba(0,209,255,0.2)]"
              >
                Enviar Pedido
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

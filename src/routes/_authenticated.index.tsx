import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Hash, Settings, Plus, Search, User, LogOut, Send, Volume2, UserPlus, Sparkles, Trash2, Users, Check, X, MessageSquare, Clock, Monitor, PhoneOff, Mic, MicOff, Headphones, Menu } from "lucide-react";
import { LumeLogo } from "@/components/ui/LumeLogo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useVoiceRoom } from "@/hooks/useVoiceRoom";
import { VoiceRoomUI } from "@/components/voice/VoiceRoomUI";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardComponent,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status?: string;
};

type Server = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
};

type Channel = {
  id: string;
  server_id: string;
  name: string;
  type: 'text' | 'voice';
};

type Message = {
  id: string;
  channel_id?: string;
  sender_id?: string;
  recipient_id?: string;
  user_id?: string;
  content: string;
  created_at: string;
  profile?: Profile | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  friend_profile?: Profile;
};

function DashboardComponent() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ id: string, email?: string | null | undefined } | null>(null);
  const [dbProfile, setDbProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      setCurrentUser({ id: session.user.id, email: session.user.email });
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data) setDbProfile(data as Profile);
    });
  }, []);

  const myProfile: Profile = dbProfile ?? {
    id: currentUser?.id || "",
    username: currentUser?.email?.split('@')[0] || "usuário",
    display_name: currentUser?.email?.split('@')[0] || "Usuário Lume",
    avatar_url: null
  };
  
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [serverToDelete, setServerToDelete] = useState<Server | null>(null);
  const [isDeletingServer, setIsDeletingServer] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server: Server } | null>(null);
  
  // Home / Friends state
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendFilter, setFriendFilter] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [addFriendUsername, setAddFriendUsername] = useState("");
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [activeDMFriend, setActiveDMFriend] = useState<Profile | null>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null);
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [serverModalTab, setServerModalTab] = useState<'create' | 'join'>('create');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [voiceParticipantsMap, setVoiceParticipantsMap] = useState<Record<string, any[]>>({});
  
  const [profilesCache, setProfilesCache] = useState<Record<string, Profile>>({});
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const {
    participants,
    allParticipantsInRoom,
    screenStream,
    isMuted,
    isDeafened,
    isSharingScreen,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    disconnect
  } = useVoiceRoom(activeVoiceChannel?.id || null, myProfile);


  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch servers
  useEffect(() => {
    if (!myProfile?.id) return;
    
    const fetchServers = async () => {
      try {
        const { data, error } = await supabase
          .from("members")
          .select("servers(*)")
          .eq("user_id", myProfile.id);
        
        if (error) {
          console.error("[Lume Servers Error]:", error);
          return;
        }
        
        const serverList = (data as any[] || []).map(item => item.servers).filter(Boolean) as Server[];
        setServers(serverList || []);
        if (serverList.length > 0 && !activeServer) {
          setActiveServer(serverList[0] || null);
        }
      } catch (err) {
        console.error("[Lume Servers Catch]:", err);
      }
    };
    
    fetchServers();
  }, [myProfile?.id]);

  // Fetch channels when active server changes
  useEffect(() => {
    if (!activeServer) return;
    
    const fetchChannels = async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("server_id", activeServer.id)
        .order("created_at", { ascending: true });
        
      if (error) {
        toast.error("Erro ao carregar canais");
        return;
      }
      
      setChannels(data as Channel[]);
      if (data.length > 0) {
        setActiveChannel(data[0] as Channel);
      }
    };
    
    fetchChannels();
  }, [activeServer]);

  // Background Presence for Sidebar
  useEffect(() => {
    if (!channels.length) return;
    
    const voiceChannels = channels.filter(c => c.type === 'voice');
    const channelsToSubscribe = voiceChannels.map(vc => {
      const channel = supabase.channel(`voice-room-${vc.id}`, {
        config: { presence: { key: myProfile.id } }
      });
      
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const users = Object.values(state).flat().map((p: any) => ({
            user_id: p.user_id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            isMuted: p.isMuted,
            isDeafened: p.isDeafened
          }));
          setVoiceParticipantsMap(prev => ({ ...prev, [vc.id]: users }));
        })
        .subscribe();
        
      return channel;
    });
    
    return () => {
      channelsToSubscribe.forEach(c => supabase.removeChannel(c));
    };
  }, [channels, myProfile.id]);

  // Fetch messages and setup realtime
  useEffect(() => {
    if (!activeChannel) return;
    
    let isSubscribed = true;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, profile:profiles(*)")
        .eq("channel_id", activeChannel.id)
        .order("created_at", { ascending: true })
        .limit(50);
        
      if (error) {
        toast.error("Erro ao carregar mensagens");
        return;
      }
      
      if (isSubscribed) {
        setMessages(data as Message[]);
      }
    };
    
    fetchMessages();

    const channel = supabase
      .channel(`messages:${activeChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${activeChannel.id}`
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          let profile = profilesCache[newMsg.user_id] || null;
          if (!profile) {
            const { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", newMsg.user_id)
              .maybeSingle();
            if (data) {
              profile = data as Profile;
              setProfilesCache(prev => ({ ...prev, [newMsg.user_id]: profile as Profile }));
            }
          }
          
          if (isSubscribed) {
            const hydratedMsg: Message = { 
              id: newMsg.id,
              channel_id: newMsg.channel_id,
              user_id: newMsg.user_id,
              content: newMsg.content,
              created_at: newMsg.created_at,
              profile: profile
            };
            
            setMessages(prev => [...prev, hydratedMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [activeChannel?.id]);

  const handleCreateServer = async () => {
    if (!newServerName.trim() || !myProfile?.id) return;
    
    try {
      const { data: newServerId, error } = await supabase.rpc('create_server', {
        server_name: newServerName.trim()
      });
      
      if (error) throw error;
      
      toast.success("Servidor criado com sucesso!");
      
      // Update local state by fetching servers again or constructing the new one
      const { data: serverData, error: fetchError } = await supabase
        .from("servers")
        .select("*")
        .eq("id", newServerId)
        .single();
        
      if (!fetchError && serverData) {
        const newServer: Server = {
          id: serverData.id,
          name: serverData.name,
          owner_id: serverData.owner_id,
          invite_code: serverData.invite_code || ""
        };
        
        setServers(prev => [...prev, newServer]);
        setActiveServer(newServer);
        
        // Fetch channels for the new server immediately
        const { data: channelsData } = await supabase
          .from("channels")
          .select("*")
          .eq("server_id", newServerId)
          .order("created_at", { ascending: true });
          
        if (channelsData) {
          setChannels(channelsData as Channel[]);
          const textChannel = channelsData.find((c: any) => c.type === 'text');
          if (textChannel) setActiveChannel(textChannel as Channel);
        }
      }

      setNewServerName("");
      setIsCreatingServer(false);
    } catch (error: any) {
      console.error("Erro ao criar servidor:", error);
      toast.error(error.message || "Erro ao criar servidor");
    }
  };

  const handleJoinServer = async () => {
    if (!inviteCodeInput.trim() || !myProfile?.id) return;
    
    try {
      // 1. Find server by invite code
      const { data: server, error: findError } = await supabase
        .from("servers")
        .select("*")
        .eq("invite_code", inviteCodeInput.trim())
        .maybeSingle();
        
      if (findError || !server) {
        toast.error("Código de convite inválido!");
        return;
      }
      
      // 2. Check if already a member
      const { data: existingMember } = await supabase
        .from("members")
        .select("*")
        .eq("server_id", server.id)
        .eq("user_id", myProfile.id)
        .maybeSingle();
        
      if (existingMember) {
        toast.info("Você já é membro deste servidor.");
        setActiveServer(server as Server);
        setIsCreatingServer(false);
        setInviteCodeInput("");
        return;
      }
      
      // 3. Join server
      const { error: joinError } = await supabase
        .from("members")
        .insert({
          server_id: server.id,
          user_id: myProfile.id,
          role: 'member'
        });
        
      if (joinError) throw joinError;
      
      toast.success("Você entrou no servidor!");
      
      // Update local state
      const newServer: Server = server as Server;
      setServers(prev => [...prev, newServer]);
      setActiveServer(newServer);
      
      setInviteCodeInput("");
      setIsCreatingServer(false);
    } catch (error: any) {
      console.error("Erro ao entrar no servidor:", error);
      toast.error(error.message || "Erro ao entrar no servidor");
    }
  };

  const handleDeleteServer = async () => {
    if (!serverToDelete || !myProfile?.id) return;
    
    try {
      const { error } = await supabase
        .from("servers")
        .delete()
        .eq("id", serverToDelete.id);
        
      if (error) throw error;
      
      toast.success("Servidor excluído com sucesso!");
      
      // Update local state
      setServers(prev => prev.filter(s => s.id !== serverToDelete.id));
      
      if (activeServer?.id === serverToDelete.id) {
        setActiveServer(null);
      }
      
      setServerToDelete(null);
      setIsDeletingServer(false);
    } catch (error: any) {
      console.error("Erro ao excluir servidor:", error);
      toast.error(error.message || "Erro ao excluir servidor");
    }
  };

  const handleLeaveServer = async (serverId: string) => {
    if (!myProfile?.id) return;
    
    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("server_id", serverId)
        .eq("user_id", myProfile.id);
        
      if (error) throw error;
      
      toast.success("Você saiu do servidor");
      
      setServers(prev => prev.filter(s => s.id !== serverId));
      if (activeServer?.id === serverId) {
        setActiveServer(null);
      }
    } catch (error: any) {
      console.error("Erro ao sair do servidor:", error);
      toast.error(error.message || "Erro ao sair do servidor");
    }
  };

  const fetchFriendships = async () => {
    if (!myProfile?.id) return;
    const { data, error } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`);
    
    if (!error && data) {
      const mapped = data.map((f: any) => ({
        ...f,
        friend_profile: f.requester_id === myProfile.id ? f.addressee : f.requester
      }));
      setFriendships(mapped);
    }
  };

  useEffect(() => {
    fetchFriendships();
    const sub = supabase
      .channel('friendships_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, fetchFriendships)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [myProfile?.id]);

  const handleSendFriendRequest = async () => {
    if (!addFriendUsername.trim() || !myProfile?.id) return;
    const { data: targetProfile, error: searchError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', addFriendUsername.trim())
      .maybeSingle();
      
    if (searchError || !targetProfile) {
      toast.error("Nenhum usuário encontrado com esse username.");
      return;
    }
    
    if (targetProfile.id === myProfile.id) {
      toast.error("Você não pode adicionar a si mesmo!");
      return;
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: myProfile.id, addressee_id: targetProfile.id });
      
    if (error) {
      toast.error("Pedido já existe ou erro ao enviar.");
    } else {
      toast.success("Pedido de amizade enviado!");
      setAddFriendUsername("");
    }
  };

  const handleAcceptFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    if (error) toast.error("Erro ao aceitar pedido.");
  };

  const handleDeclineFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) toast.error("Erro ao recusar pedido.");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !myProfile?.id) return;
    
    const content = newMessage;
    setNewMessage("");

    if (activeChannel) {
      const { error } = await supabase
        .from("messages")
        .insert({ channel_id: activeChannel.id, user_id: myProfile.id, content });
      if (error) toast.error("Erro ao enviar mensagem");
    } else if (activeDMFriend) {
      const { error } = await supabase
        .from("direct_messages")
        .insert({ sender_id: myProfile.id, recipient_id: activeDMFriend.id, content });
      if (error) toast.error("Erro ao enviar DM");
    }
  };

  // Realtime DMs
  useEffect(() => {
    if (!activeDMFriend || !myProfile?.id) return;
    
    const fetchDMs = async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${myProfile.id},recipient_id.eq.${activeDMFriend.id}),and(sender_id.eq.${activeDMFriend.id},recipient_id.eq.${myProfile.id})`)
        .order('created_at', { ascending: true })
        .limit(50);
      if (!error && data) setMessages(data as Message[]);
    };
    
    fetchDMs();
    const sub = supabase
      .channel(`dms:${activeDMFriend.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `recipient_id=eq.${myProfile.id}` 
      }, fetchDMs)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `sender_id=eq.${myProfile.id}` 
      }, fetchDMs)
      .subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, [activeDMFriend?.id, myProfile?.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const copyInvite = () => {
    if (!activeServer) return;
    navigator.clipboard.writeText(activeServer.invite_code);
    toast.success("Código de convite copiado!");
  };

// Removed the blocking "Sincronizando Perfil..." interface.

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#050505] text-foreground font-sans md:flex-row">
      {/* Mobile Top Header */}
      <div className="flex h-12 w-full items-center justify-between border-b border-white/5 bg-[#050505] px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-zinc-400 hover:text-white"
          >
            <Menu size={24} />
          </Button>
          <LumeLogo variant="icon" />
        </div>
        <h1 className="text-sm font-bold text-white truncate max-w-[150px]">
          {activeServer?.name || activeDMFriend?.display_name || activeDMFriend?.username || "Amigos"}
        </h1>
        <div className="w-8" /> {/* Spacer for centering */}
      </div>

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Wrapper */}
      <div className={`fixed inset-y-0 left-0 z-[70] flex w-[312px] transform transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full w-full">



        {/* Column 1: Server List */}
      <div className="flex w-[72px] flex-col items-center gap-3 border-r border-white/5 bg-[#050505] py-3 overflow-y-auto overflow-x-hidden">
        <div onClick={() => { setActiveServer(null); setActiveDMFriend(null); setActiveChannel(null); setShowVoiceUI(false); }} className="cursor-pointer transition-transform hover:scale-105 active:scale-95 mb-2">
          <LumeLogo variant="icon" />
        </div>

        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => setActiveServer(server)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, server });
            }}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-[24px] transition-all duration-200 hover:rounded-[16px] ${
              activeServer?.id === server.id ? "rounded-[16px] bg-[#00D1FF] text-black glow-sm" : "bg-[#121212] text-zinc-400 hover:bg-[#00D1FF] hover:text-black"
            }`}
          >
            <div className={`absolute -left-1 h-2 w-2 rounded-full bg-white transition-all ${activeServer?.id === server.id ? "scale-100" : "scale-0 group-hover:scale-100"}`} />
            <span className="text-sm font-bold truncate px-1">{server.name.substring(0, 2).toUpperCase()}</span>
          </button>
        ))}

        {contextMenu && (
          <>
            <div 
              className="fixed inset-0 z-50" 
              onClick={() => setContextMenu(null)} 
              onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} 
            />
            <div 
              style={{ top: contextMenu.y, left: contextMenu.x }}
              className="fixed z-50 w-48 bg-[#141416] border border-zinc-800 rounded-lg p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
            >
              {contextMenu.server.owner_id === myProfile.id ? (
                <button
                  onClick={() => {
                    setServerToDelete(contextMenu.server);
                    setIsDeletingServer(true);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Servidor</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleLeaveServer(contextMenu.server.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do Servidor</span>
                </button>
              )}
            </div>
          </>
        )}
        
        <div className="mx-4 h-[2px] w-8 bg-white/5" />
        
        <Dialog open={isCreatingServer} onOpenChange={(open) => { setIsCreatingServer(open); if (!open) setServerModalTab('create'); }}>
          <DialogTrigger asChild>
            <button className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#121212] text-[#00D1FF] transition-all hover:rounded-[16px] hover:bg-[#00D1FF] hover:text-black glow-sm border border-[#00D1FF]/20">
              <Plus size={24} />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#121212] border-white/10 text-white sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">
                {serverModalTab === 'create' ? "Crie seu servidor" : "Entre em um servidor"}
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-400">
                {serverModalTab === 'create' 
                  ? "Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a conversar." 
                  : "Insira um convite abaixo para entrar em um servidor existente."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex gap-2 p-1 bg-[#050505] rounded-lg mb-4">
              <button 
                onClick={() => setServerModalTab('create')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${serverModalTab === 'create' ? "bg-[#121212] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Criar
              </button>
              <button 
                onClick={() => setServerModalTab('join')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${serverModalTab === 'join' ? "bg-[#121212] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Entrar
              </button>
            </div>

            {serverModalTab === 'create' ? (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-400">Nome do Servidor</label>
                  <Input 
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    placeholder="O servidor de..." 
                    className="bg-[#050505] border-white/10 text-white h-11 focus-visible:ring-[#00D1FF]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-400">Link de convite</label>
                  <Input 
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value)}
                    placeholder="hYp3r-LUM3" 
                    className="bg-[#050505] border-white/10 text-white h-11 focus-visible:ring-[#00D1FF]"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Os convites devem ser parecidos com <span className="text-zinc-400 font-mono">hYp3r-LUM3</span>
                  </p>
                </div>
              </div>
            )}
            
            <DialogFooter className="bg-[#18181b]/50 -mx-6 -mb-6 p-4 rounded-b-lg">
              <div className="flex w-full justify-between items-center">
                <button 
                  onClick={() => setIsCreatingServer(false)}
                  className="text-sm text-zinc-400 hover:underline"
                >
                  Voltar
                </button>
                <Button 
                  onClick={serverModalTab === 'create' ? handleCreateServer : handleJoinServer} 
                  className="bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 glow-sm font-bold px-8 h-10"
                >
                  {serverModalTab === 'create' ? "Criar Servidor" : "Entrar no Servidor"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={isDeletingServer} onOpenChange={setIsDeletingServer}>
          <DialogContent className="bg-[#121212] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Excluir '{serverToDelete?.name}'?</DialogTitle>
              <DialogDescription className="text-zinc-400 pt-2">
                Esta ação não pode ser desfeita. Todos os canais e mensagens serão apagados permanentemente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setIsDeletingServer(false)} className="text-white hover:bg-white/5">
                Cancelar
              </Button>
              <Button 
                onClick={handleDeleteServer} 
                className="bg-red-600 text-white hover:bg-red-700 glow-red border-none"
              >
                Sim, excluir servidor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      <div className="flex w-60 flex-col border-r border-white/5 bg-[#121212]/30">


        <div className="flex h-12 items-center border-b border-white/5 px-4 shadow-sm group cursor-pointer" onClick={activeServer ? copyInvite : undefined}>
          <h2 className="text-sm font-bold truncate flex-1 tracking-tight text-white">{activeServer?.name || "LUME"}</h2>
          {activeServer && <UserPlus size={16} className="text-zinc-500 group-hover:text-white" />}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {!activeServer ? (
            <div className="space-y-4">
              <div className="space-y-0.5">
                <button 
                  onClick={() => setActiveDMFriend(null)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    !activeDMFriend ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <Users size={20} className={!activeDMFriend ? "text-white" : "text-zinc-500"} />
                  <span className="font-medium">Amigos</span>
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                  <span className="flex-1">Mensagens Diretas</span>
                  <Plus size={14} className="cursor-pointer hover:text-white" />
                </div>
                {friendships.filter(f => f.status === 'accepted').map(friendship => {
                  const friend = friendship.friend_profile;
                  if (!friend) return null;
                  return (
                    <button 
                      key={friend.id}
                      onClick={() => { setActiveDMFriend(friend); setActiveChannel(null); setShowVoiceUI(false); }}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        activeDMFriend?.id === friend.id ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8 border border-white/5">
                          <AvatarImage src={friend.avatar_url || ""} />
                          <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px]">
                            {friend.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#121212] ${friend.status === 'online' ? "bg-emerald-500" : "bg-zinc-500"}`} />
                      </div>
                      <span className="flex-1 text-left truncate font-medium">{friend.display_name || friend.username}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-0.5">
                <div className="flex items-center px-2 py-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                  <span className="flex-1">Canais de Texto</span>
                  {activeServer?.owner_id === myProfile.id && (
                    <Plus size={14} className="cursor-pointer hover:text-white" />
                  )}
                </div>
                {channels.filter(c => c.type === 'text').map(channel => (
                  <button 
                    key={channel.id} 
                    onClick={() => { setActiveChannel(channel); setActiveDMFriend(null); setShowVoiceUI(false); }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      activeChannel?.id === channel.id ? "bg-white/5 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    <Hash size={16} className="text-zinc-500" />
                    <span>{channel.name}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center px-2 py-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                  <span className="flex-1">Canais de Voz</span>
                  {activeServer?.owner_id === myProfile.id && (
                    <Plus size={14} className="cursor-pointer hover:text-white" />
                  )}
                </div>
                {channels.filter(c => c.type === 'voice').map(channel => (
                  <div key={channel.id} className="space-y-1">
                    <button 
                      onClick={() => {
                        setActiveVoiceChannel(channel);
                        setShowVoiceUI(true);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                        activeVoiceChannel?.id === channel.id ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                      }`}
                    >
                      <Volume2 size={18} className="text-zinc-500" />
                      <span className="flex-1 text-left font-medium">{channel.name}</span>
                    </button>
                    
                    {/* Background Presence List in Sidebar */}
                    <div className="ml-6 space-y-1">
                      {(voiceParticipantsMap[channel.id] || []).map((p: any) => (
                        <div key={p.user_id} className="flex items-center gap-2 px-2 py-1 rounded-md text-xs text-zinc-400 hover:bg-white/5 transition-colors group">
                          <Avatar className="h-5 w-5 border border-white/10 group-hover:border-[#00D1FF]/30">
                            <AvatarImage src={p.avatar_url || ""} />
                            <AvatarFallback className="text-[8px] bg-zinc-800 text-zinc-500">
                              {p.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`truncate ${p.user_id === myProfile.id ? "text-[#00D1FF] font-medium" : ""}`}>
                            {p.display_name || p.username}
                          </span>
                          <div className="ml-auto flex gap-1">
                            {p.isMuted && <MicOff size={10} className="text-red-500" />}
                            {p.isDeafened && <Headphones size={10} className="text-red-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Voice Connection Widget */}
        {activeVoiceChannel && (
          <div className="mx-2 mb-2 flex flex-col rounded-md bg-[#050505] p-2 border border-[#00D1FF]/20 shadow-[0_0_10px_rgba(0,209,255,0.05)] animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Voz Conectada</span>
                  <span className="text-[11px] text-zinc-300 truncate font-medium">{activeVoiceChannel.name}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowVoiceUI(true)}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
                title="Abrir Tela da Chamada"
              >
                <Monitor size={14} />
              </button>
            </div>
            <div className="flex items-center justify-around bg-white/5 rounded p-1">
              <button 
                onClick={toggleMute} 
                className={`p-1.5 rounded transition-colors ${isMuted ? "text-red-500 hover:bg-red-500/10" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button 
                onClick={toggleDeafen} 
                className={`p-1.5 rounded transition-colors ${isDeafened ? "text-red-500 hover:bg-red-500/10" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                {isDeafened ? <Headphones size={16} className="text-red-500" /> : <Headphones size={16} />}
              </button>
              <button 
                onClick={() => {
                  disconnect();
                  setActiveVoiceChannel(null);
                  setShowVoiceUI(false);
                }} 
                className="p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        )}

        {/* User Footer */}
        <div className="mt-auto flex items-center gap-3 border-t border-white/5 bg-[#050505]/50 p-2">
          <Avatar className="h-8 w-8 border border-white/5">
            <AvatarImage src={myProfile?.avatar_url || ""} />
            <AvatarFallback className="bg-[#00D1FF]/10 text-[#00D1FF] text-[10px]">{(myProfile?.username || "LU").substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-white">
            <p className="truncate text-xs font-bold">{myProfile?.display_name || myProfile?.username || "Usuário Lume"}</p>
            <p className="truncate text-[10px] text-emerald-500">online</p>
          </div>
          <button onClick={handleSignOut} className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500">
            <LogOut size={16} />
          </button>
        </div>
        </div>
      </div>
    </div>
  </div>












      <div className="flex flex-1 flex-col bg-[#050505] overflow-hidden">
        {activeVoiceChannel && showVoiceUI ? (
            <VoiceRoomUI
              participants={participants}
              myProfile={myProfile}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isSharingScreen={isSharingScreen}
              screenStream={screenStream}
              toggleMute={toggleMute}
              toggleDeafen={toggleDeafen}
              toggleScreenShare={toggleScreenShare}
              onDisconnect={() => {
                disconnect();
                setActiveVoiceChannel(null);
                setShowVoiceUI(false);
              }}
              onClose={() => setShowVoiceUI(false)}
            />
        ) : activeChannel || activeDMFriend ? (
          <>
            <div className="flex h-12 items-center border-b border-white/5 px-4 shadow-sm">
              {activeChannel ? (
                <>
                  <Hash size={20} className="mr-2 text-zinc-500" />
                  <h3 className="text-sm font-bold text-white">{activeChannel.name}</h3>
                </>
              ) : (
                <>
                  <div className="relative mr-2">
                    <Avatar className="h-6 w-6 border border-white/5">
                      <AvatarImage src={activeDMFriend?.avatar_url || ""} />
                      <AvatarFallback className="text-[8px] bg-zinc-800 text-zinc-400">
                        {activeDMFriend?.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="text-sm font-bold text-white">{activeDMFriend?.display_name || activeDMFriend?.username}</h3>
                </>
              )}
              <div className="ml-auto flex items-center gap-4 text-zinc-500">
                <Search size={18} className="cursor-pointer hover:text-white" />
                <Settings size={18} className="cursor-pointer hover:text-white" />
                <User size={18} className="cursor-pointer hover:text-white" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => {
                const profile = msg.profile || (msg.sender_id === activeDMFriend?.id ? activeDMFriend : myProfile);
                return (
                  <div key={msg.id || index} className="flex gap-4 group">
                    <Avatar className="h-10 w-10 mt-0.5 border border-white/5">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                        {(profile?.display_name || profile?.username || "?").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold hover:underline cursor-pointer text-white">
                          {profile?.display_name || profile?.username || "Membro do Lume"}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed break-words">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 pt-0">
              <form onSubmit={handleSendMessage} className="relative">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                  placeholder={activeChannel ? `Conversar em #${activeChannel.name}` : `Conversar com @${activeDMFriend?.username}`}
                  className="bg-[#121212] border-none focus-visible:ring-1 focus-visible:ring-[#00D1FF]/50 pr-12 h-11 text-sm text-white"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-[#00D1FF] transition-colors">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : !activeServer ? (
          <div className="flex flex-col h-full">
            <div className="flex h-12 items-center border-b border-white/5 px-4 shadow-sm">
              <Users size={20} className="mr-2 text-zinc-500" />
              <h3 className="text-sm font-bold text-white mr-4">Amigos</h3>
              <div className="h-6 w-[1px] bg-white/10 mx-2" />
              <div className="flex gap-2">
                <button 
                  onClick={() => setFriendFilter('online')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${friendFilter === 'online' ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"}`}
                >
                  Disponível
                </button>
                <button 
                  onClick={() => setFriendFilter('all')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${friendFilter === 'all' ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"}`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setFriendFilter('pending')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors relative ${friendFilter === 'pending' ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"}`}
                >
                  Pendentes
                  {friendships.filter(f => f.status === 'pending' && f.addressee_id === myProfile.id).length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                      {friendships.filter(f => f.status === 'pending' && f.addressee_id === myProfile.id).length}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => setFriendFilter('add')}
                  className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${friendFilter === 'add' ? "text-[#00D1FF]" : "bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90"}`}
                >
                  Adicionar Amigo
                </button>
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              {friendFilter === 'add' ? (
                <div className="max-w-xl space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Adicionar Amigo</h4>
                    <p className="text-xs text-zinc-400">Você pode adicionar amigos com o nome de usuário do Lume.</p>
                  </div>
                  <div className="relative group">
                    <Input 
                      value={addFriendUsername}
                      onChange={(e) => setAddFriendUsername(e.target.value)}
                      placeholder="Insira o nome de usuário..."
                      className="bg-[#121212] border border-[#121212] focus:border-[#00D1FF]/50 text-white h-12 pr-40"
                    />
                    <Button 
                      onClick={handleSendFriendRequest}
                      disabled={!addFriendUsername.trim()}
                      className="absolute right-1 top-1 bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 h-10 px-4"
                    >
                      Enviar pedido
                    </Button>
                  </div>
                </div>
              ) : friendFilter === 'pending' ? (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">
                    Pedidos de Amizade — {friendships.filter(f => f.status === 'pending').length}
                  </h4>
                  {friendships.filter(f => f.status === 'pending').map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 border-t border-white/5 group hover:bg-white/5 rounded-md transition-colors">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={f.friend_profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                          {f.friend_profile?.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{f.friend_profile?.display_name || f.friend_profile?.username}</p>
                        <p className="text-[10px] text-zinc-500">{f.requester_id === myProfile.id ? "Pedido enviado" : "Pedido recebido"}</p>
                      </div>
                      <div className="flex gap-2">
                        {f.addressee_id === myProfile.id ? (
                          <>
                            <button onClick={() => handleAcceptFriendRequest(f.id)} className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-800 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all">
                              <Check size={18} />
                            </button>
                            <button onClick={() => handleDeclineFriendRequest(f.id)} className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-800 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleDeclineFriendRequest(f.id)} className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-red-500 hover:text-white transition-all">
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">
                    Amigos — {friendships.filter(f => f.status === 'accepted' && (friendFilter === 'all' || f.friend_profile?.status === 'online')).length}
                  </h4>
                  {friendships.filter(f => f.status === 'accepted' && (friendFilter === 'all' || f.friend_profile?.status === 'online')).map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 border-t border-white/5 group hover:bg-white/5 rounded-md transition-colors">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={f.friend_profile?.avatar_url || ""} />
                          <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                            {f.friend_profile?.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#050505] ${f.friend_profile?.status === 'online' ? "bg-emerald-500" : "bg-zinc-500"}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{f.friend_profile?.display_name || f.friend_profile?.username}</p>
                        <p className="text-[10px] text-zinc-500 capitalize">{f.friend_profile?.status || 'offline'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setActiveDMFriend(f.friend_profile!); setActiveChannel(null); setShowVoiceUI(false); }}
                          className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-[#00D1FF] hover:text-black transition-all"
                        >
                          <MessageSquare size={16} />
                        </button>
                        <button className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-all">
                          <Sparkles size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-white">
            <div className="max-w-md space-y-6 flex flex-col items-center">
              <div className="flex justify-center items-center my-4">
                <LumeLogo variant="full" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-zinc-500 font-medium tracking-wide">Plataforma de comunicação minimalista. Comece criando seu primeiro servidor.</p>
              </div>
              <Button onClick={() => setIsCreatingServer(true)} className="mt-4 bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 glow-sm font-bold h-12 px-8">
                Criar meu primeiro Servidor
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}













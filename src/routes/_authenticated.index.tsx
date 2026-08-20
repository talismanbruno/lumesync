import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Hash, Settings, Plus, Search, User, LogOut, Send, Volume2, UserPlus } from "lucide-react";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardComponent,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
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
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
};

function DashboardComponent() {
  const navigate = useNavigate();
  const { profile: myProfile } = Route.useLoaderData();
  
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [profilesCache, setProfilesCache] = useState<Record<string, Profile>>({});
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch servers
  useEffect(() => {
    const fetchServers = async () => {
      const { data, error } = await supabase
        .from("members")
        .select("servers(*)")
        .eq("user_id", myProfile.id);
      
      if (error) {
        toast.error("Erro ao carregar servidores");
        return;
      }
      
      const serverList = data.map(item => item.servers) as unknown as Server[];
      setServers(serverList);
      if (serverList.length > 0 && !activeServer) {
        setActiveServer(serverList[0]);
      }
    };
    
    fetchServers();
  }, [myProfile.id]);

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

  // Fetch messages and setup realtime
  useEffect(() => {
    if (!activeChannel) return;
    
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
      
      setMessages(data as Message[]);
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
          const newMsg = payload.new as Message;
          
          // Hydrate profile data
          let profile = profilesCache[newMsg.user_id];
          if (!profile) {
            const { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", newMsg.user_id)
              .single();
            if (data) {
              profile = data as Profile;
              setProfilesCache(prev => ({ ...prev, [newMsg.user_id]: profile }));
            }
          }
          
          setMessages(prev => [...prev, { ...newMsg, profile }]);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime subscribed to channel ${activeChannel.name}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, profilesCache]);

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    
    try {
      // 1. Create server
      const { data: server, error: serverError } = await supabase
        .from("servers")
        .insert({
          name: newServerName,
          owner_id: myProfile.id,
          invite_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        })
        .select()
        .single();
        
      if (serverError) throw serverError;

      // 2. Add owner to members (Trigger handles this usually, but let's be explicit if needed or let RLS/Grants work)
      // Note: If a trigger isn't set up for this yet, we do it here.
      const { error: memberError } = await supabase
        .from("members")
        .insert({
          server_id: server.id,
          user_id: myProfile.id,
          role: 'owner'
        });
        
      if (memberError) throw memberError;

      // 3. Create default channels
      const { data: defaultChannels, error: channelsError } = await supabase
        .from("channels")
        .insert([
          { server_id: server.id, name: "geral", type: 'text' },
          { server_id: server.id, name: "Sala de Voz", type: 'voice' }
        ])
        .select();
        
      if (channelsError) throw channelsError;

      setServers(prev => [...prev, server]);
      setActiveServer(server);
      setNewServerName("");
      setIsCreatingServer(false);
      toast.success("Servidor criado com sucesso!");
      
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar servidor");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel) return;

    const content = newMessage;
    setNewMessage("");

    const { error } = await supabase
      .from("messages")
      .insert({
        channel_id: activeChannel.id,
        user_id: myProfile.id,
        content: content
      });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      setNewMessage(content);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const copyInvite = () => {
    if (!activeServer) return;
    navigator.clipboard.writeText(activeServer.invite_code);
    toast.success("Código de convite copiado!");
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#050505] text-foreground font-sans">
      {/* Column 1: Server List */}
      <div className="flex w-[72px] flex-col items-center gap-3 border-r border-white/5 bg-[#050505] py-3">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => setActiveServer(server)}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-[24px] transition-all duration-200 hover:rounded-[16px] ${
              activeServer?.id === server.id ? "rounded-[16px] bg-[#00D1FF] text-black glow-sm" : "bg-[#121212] text-zinc-400 hover:bg-[#00D1FF] hover:text-black"
            }`}
          >
            <div className={`absolute -left-1 h-2 w-2 rounded-full bg-white transition-all ${activeServer?.id === server.id ? "scale-100" : "scale-0 group-hover:scale-100"}`} />
            <span className="text-sm font-bold truncate px-1">{server.name.substring(0, 2).toUpperCase()}</span>
          </button>
        ))}
        
        <div className="mx-4 h-[2px] w-8 bg-white/5" />
        
        <Dialog open={isCreatingServer} onOpenChange={setIsCreatingServer}>
          <DialogTrigger asChild>
            <button className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#121212] text-[#00D1FF] transition-all hover:rounded-[16px] hover:bg-[#00D1FF] hover:text-black">
              <Plus size={24} />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#121212] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Personalize seu servidor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-zinc-400">Nome do Servidor</label>
                <Input 
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="O servidor de..." 
                  className="bg-[#050505] border-white/10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCreatingServer(false)}>Cancelar</Button>
              <Button onClick={handleCreateServer} className="bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 glow-sm">Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Column 2: Channels/Navigation */}
      <div className="flex w-60 flex-col border-r border-white/5 bg-[#121212]/30">
        <div className="flex h-12 items-center border-b border-white/5 px-4 shadow-sm group cursor-pointer" onClick={copyInvite}>
          <h2 className="text-sm font-bold truncate flex-1 uppercase tracking-tight">{activeServer?.name || "LUME"}</h2>
          <UserPlus size={16} className="text-zinc-500 group-hover:text-white" />
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="space-y-0.5">
            <div className="flex items-center px-2 py-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
              <span className="flex-1">Canais de Texto</span>
              <Plus size={14} className="cursor-pointer hover:text-white" />
            </div>
            {channels.filter(c => c.type === 'text').map(channel => (
              <button 
                key={channel.id} 
                onClick={() => setActiveChannel(channel)}
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
              <Plus size={14} className="cursor-pointer hover:text-white" />
            </div>
            {channels.filter(c => c.type === 'voice').map(channel => (
              <button 
                key={channel.id} 
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
              >
                <Volume2 size={16} className="text-zinc-500" />
                <span>{channel.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User Footer */}
        <div className="mt-auto flex items-center gap-3 border-t border-white/5 bg-[#050505]/50 p-2">
          <Avatar className="h-8 w-8 border border-white/5">
            <AvatarImage src={myProfile.avatar_url || ""} />
            <AvatarFallback className="bg-[#00D1FF]/10 text-[#00D1FF] text-[10px]">{myProfile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-bold">{myProfile.display_name || myProfile.username}</p>
            <p className="truncate text-[10px] text-emerald-500">online</p>
          </div>
          <button onClick={handleSignOut} className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Column 3: Main Content (Chat) */}
      <div className="flex flex-1 flex-col bg-[#050505]">
        {activeChannel ? (
          <>
            <div className="flex h-12 items-center border-b border-white/5 px-4 shadow-sm">
              <Hash size={20} className="mr-2 text-zinc-500" />
              <h3 className="text-sm font-bold">{activeChannel.name}</h3>
              <div className="ml-auto flex items-center gap-4 text-zinc-500">
                <Search size={18} className="cursor-pointer hover:text-white" />
                <Settings size={18} className="cursor-pointer hover:text-white" />
                <User size={18} className="cursor-pointer hover:text-white" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div key={msg.id || index} className="flex gap-4 group">
                  <Avatar className="h-10 w-10 mt-0.5 border border-white/5">
                    <AvatarImage src={msg.profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                      {(msg.profile?.display_name || msg.profile?.username || "?").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold hover:underline cursor-pointer">
                        {msg.profile?.display_name || msg.profile?.username || "Carregando..."}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed break-words">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 pt-0">
              <form onSubmit={handleSendMessage} className="relative">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Conversar em #${activeChannel.name}`}
                  className="bg-[#121212] border-none focus-visible:ring-1 focus-visible:ring-[#00D1FF]/50 pr-12 h-11 text-sm"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-[#00D1FF] transition-colors"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#00D1FF]/10 text-[#00D1FF] glow-sm">
                <Plus size={40} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Crie ou selecione um servidor</h1>
              <p className="text-zinc-500">LUME é o seu novo espaço de comunicação minimalista.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
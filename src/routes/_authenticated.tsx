import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { Hash, Settings, Plus, Search, User, LogOut, Send, Volume2, UserPlus, Sparkles, Trash2, Users, Check, X, MessageSquare, Clock, Monitor, PhoneOff, Mic, MicOff, Headphones, Menu, ChevronUp, Paperclip, Smile, Film, Download, FileText, Image as ImageIcon, Lock, Camera, BadgeCheck, Settings2 } from "lucide-react";
import { MessageText } from "@/components/ui/MessageText";
import { UserProfileCard } from "@/components/ui/UserProfileCard";
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { LumeLogo } from "@/components/ui/LumeLogo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Popover, PopoverContent, PopoverTrigger, PopoverPortal } from "@/components/ui/popover";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { CreateGroupModal } from "@/components/ui/CreateGroupModal";

export const Route = createFileRoute("/_authenticated")({
  loader: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session) {
        throw redirect({ to: "/auth" });
      }
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
        
      if (!profile?.username) {
        throw redirect({ to: "/onboarding" });
      }

      return { session, profile };
    } catch (e) {
      if (isRedirect(e) || e instanceof Response) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  head: () => ({
    meta: [
      { title: "Lume" },
      { name: "description", content: "Lume" },
      { property: "og:title", content: "Lume" },
      { property: "og:description", content: "Lume" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "https://i.ibb.co/99YTNvGS/image.png" }],
  }),
  component: AuthenticatedLayout,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string | null;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  is_admin?: boolean;
  is_verified?: boolean;
  created_at?: string;
};

type Server = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
};

function AuthenticatedLayout() {
  const { profile: globalProfile, user: authUser, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [serverModalTab, setServerModalTab] = useState<'create' | 'join'>('create');
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'amigos' | 'conversas' | 'servidores'>('amigos');

  const myProfile = (globalProfile as Profile) || {
    id: authUser?.id || "",
    username: authUser?.email?.split('@')[0] || "usuário",
    display_name: authUser?.email?.split('@')[0] || "Usuário Lume",
    status: 'online'
  };

  useEffect(() => {
    if (!myProfile?.id) return;
    const fetchServers = async () => {
      const { data } = await supabase
        .from("members")
        .select("servers(*)")
        .eq("user_id", myProfile.id);
      
      const serverList = (data as any[] || []).map(item => item.servers).filter(Boolean) as Server[];
      setServers(serverList);
    };
    fetchServers();
  }, [myProfile?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const handleUpdateStatus = async (newStatus: 'online' | 'idle' | 'dnd' | 'offline') => {
    await updateProfile({ status: newStatus } as any);
    await supabase.from('profiles').update({ status: newStatus }).eq('id', myProfile.id);
    setShowStatusMenu(false);
  };

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    const { data: newServerId, error } = await supabase.rpc('create_server', { server_name: newServerName.trim() });
    if (!error) {
      toast.success("Servidor criado!");
      setNewServerName("");
      setIsCreatingServer(false);
      window.location.reload();
    }
  };

  const handleJoinServer = async () => {
    if (!inviteCodeInput.trim()) return;
    const { data: joinedServerId, error } = await supabase.rpc("join_server_by_invite", { p_code: inviteCodeInput.trim() });
    if (!error && joinedServerId) {
      toast.success("Você entrou!");
      setIsCreatingServer(false);
      window.location.reload();
    } else {
      toast.error("Código inválido");
    }
  };

  const handleSelectServer = (serverId: string | null) => {
    setSelectedServerId(serverId);
    if (serverId) {
        setActiveTab('servidores');
    } else {
        setActiveTab('amigos');
    }
    const server = servers.find(s => s.id === serverId);
    if (server) {
      window.dispatchEvent(new CustomEvent('lume-server-change', { detail: server }));
    } else {
      window.dispatchEvent(new CustomEvent('lume-server-change', { detail: null }));
    }
  };

  const handleGoHome = () => {
    handleSelectServer(null);
  };

  const [setIsStatusOpen, setSetIsStatusOpen] = useState(false); // Dummy for implementation requirement compatibility

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-zinc-100 overflow-hidden font-sans select-none">
      
      {/* COLUNA 1: BARRA DE SERVIDORES (72px FIXO) */}
      <div className="w-[72px] bg-[#050505] flex flex-col items-center py-3 gap-2 border-r border-white/5 shrink-0">
        
        <div 
          onClick={handleGoHome}
          className={`w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center cursor-pointer hover:rounded-xl transition-all group ${!selectedServerId ? 'rounded-xl bg-cyan-500' : ''}`}
        >
          <img src="https://i.ibb.co/99YTNvGS/image.png" className="w-7 h-7 object-contain" alt="Home" />
        </div>
        
        <div className="w-8 h-[2px] bg-zinc-800 rounded-full my-1" />

        <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar pb-4">
          {servers.map((server) => (
            <div 
              key={server.id}
              onClick={() => handleSelectServer(server.id)} 
              className={`w-12 h-12 rounded-2xl bg-zinc-900 font-bold text-sm hover:rounded-xl hover:bg-zinc-800 text-white transition-all flex items-center justify-center cursor-pointer ${selectedServerId === server.id ? 'rounded-xl border-2 border-white/20' : ''}`}
            >
              {server.name.slice(0, 2).toUpperCase()}
            </div>
          ))}
          
          <button 
            onClick={() => setIsCreatingServer(true)} 
            className="w-12 h-12 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-700 hover:border-cyan-400 hover:text-cyan-400 text-zinc-400 flex items-center justify-center transition-all"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* COLUNA 2: CANAIS OU DMs (240px FIXO) */}
      <div className="w-[240px] bg-[#121212] flex flex-col border-r border-white/5 shrink-0">
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <Outlet />
        </div>

        {/* PERFIL DO USUÁRIO NO RODAPÉ */}
        <div className="p-2 bg-[#0a0a0d] flex items-center gap-2 border-t border-white/5">
          <div 
            onClick={() => setShowStatusMenu(true)} 
            className="flex items-center gap-2.5 overflow-hidden cursor-pointer flex-1 min-w-0 p-1 hover:bg-white/5 rounded-lg transition-colors"
          >
            <div className="relative shrink-0">
              <UserAvatar avatarUrl={myProfile.avatar_url} name={myProfile.display_name || myProfile.username} size="h-8 w-8" />
              <div className="absolute -bottom-0.5 -right-0.5">
                <StatusBadge status={myProfile.status} size="sm" />
              </div>
            </div>
            
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-sm font-bold truncate text-zinc-100">
                {myProfile?.display_name || myProfile?.username}
              </span>
              <span className="text-[10px] text-zinc-500 truncate uppercase tracking-tighter">
                #{myProfile?.username}
              </span>
            </div>
          </div>

          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* COLUNA 3: CHAT / AMIGOS / VOZ (FLEX-1 WIDESCREEN) */}
      <div className="flex-1 bg-[#050505] flex flex-col relative min-w-0">
         {/* Main content area - children routes should render their own column 3 content or we can manage it here */}
      </div>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      {/* DUMMY POPOVER FOR STATUS TO SATISFY SidebarUserFooter needs if any */}
      {showStatusMenu && (
          <div className="fixed inset-0 z-[60]" onClick={() => setShowStatusMenu(false)}>
              <div 
                  className="absolute bottom-16 left-20 w-48 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-2"
                  onClick={e => e.stopPropagation()}
              >
                  {(['online', 'idle', 'dnd', 'offline'] as const).map((s) => (
                      <button
                          key={s}
                          onClick={() => handleUpdateStatus(s)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition-colors"
                      >
                          <StatusBadge status={s} size="sm" />
                          <span className="capitalize">{s === 'dnd' ? 'Não perturbar' : s === 'idle' ? 'Ausente' : s === 'offline' ? 'Invisível' : 'Online'}</span>
                      </button>
                  ))}
                  <div className="h-[1px] bg-white/5 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 text-sm transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Sair da Conta</span>
                  </button>
              </div>
          </div>
      )}

      <Dialog open={isCreatingServer} onOpenChange={setIsCreatingServer}>
        <DialogContent className="bg-[#0d0d11]/95 backdrop-blur-2xl border border-white/5 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              {serverModalTab === 'create' ? "Novo Servidor" : "Entrar no Servidor"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-4 border border-white/5">
            <button 
              onClick={() => setServerModalTab('create')} 
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${serverModalTab === 'create' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Criar
            </button>
            <button 
              onClick={() => setServerModalTab('join')} 
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${serverModalTab === 'join' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Entrar
            </button>
          </div>

          {serverModalTab === 'create' ? (
            <div className="space-y-4 py-2">
              <Input 
                value={newServerName} 
                onChange={(e) => setNewServerName(e.target.value)} 
                placeholder="Nome do servidor..." 
                className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-[#00D1FF]/50 transition-all" 
              />
              <Button 
                onClick={handleCreateServer} 
                className="w-full bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold h-12 rounded-xl"
              >
                Criar Servidor
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Input 
                value={inviteCodeInput} 
                onChange={(e) => setInviteCodeInput(e.target.value)} 
                placeholder="Código de convite..." 
                className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-[#00D1FF]/50 transition-all" 
              />
              <Button 
                onClick={handleJoinServer} 
                className="w-full bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold h-12 rounded-xl"
              >
                Entrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

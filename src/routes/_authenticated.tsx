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

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const handleSelectServer = (serverId: string | null) => {
    setSelectedServerId(serverId);
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

  const handleServerContextMenu = (e: React.MouseEvent, server: Server) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050505] text-zinc-100 overflow-hidden font-sans select-none">
      
      {/* 1. BARRA SUPERIOR HORIZONTAL (TOP NAVIGATION BAR - 60px) */}
      <header className="h-16 px-6 bg-[#0a0a0d] border-b border-white/5 flex items-center justify-between shrink-0 z-40">
        
        {/* Logo Oficial Lume à Esquerda */}
        <div className="flex items-center gap-3">
          <img src="https://i.ibb.co/C3h465Sr/image.png" alt="Lume" className="h-7 w-auto object-contain" />
        </div>

        {/* Seletor Horizontal de Servidores e Home (Cápsulas Centrais) */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-[60%] py-1 scrollbar-none">
          {/* Botão Home / Mensagens Diretas */}
          <button
            onClick={handleGoHome}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              selectedServerId === null 
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,209,255,0.2)]' 
                : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
            }`}
          >
            <span>🏠 Mensagens Diretas</span>
          </button>

          {/* Lista Horizontal de Servidores */}
          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => handleSelectServer(server.id)}
              onContextMenu={(e) => handleServerContextMenu(e, server)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                selectedServerId === server.id 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,209,255,0.2)]' 
                  : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedServerId === server.id ? 'bg-cyan-400 shadow-[0_0_8px_rgba(0,209,255,0.6)]' : 'bg-zinc-600'}`} />
              <span>{server.name}</span>
            </button>
          ))}

          {/* Botão + Criar Servidor */}
          <button
            onClick={() => setIsCreatingServer(true)}
            className="p-2 rounded-xl bg-zinc-900/40 hover:bg-cyan-500/10 hover:text-cyan-400 border border-dashed border-zinc-700 hover:border-cyan-500/40 text-zinc-400 transition-all shrink-0"
            title="Criar Servidor"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Perfil do Usuário e Configurações à Direita */}
        <div className="flex items-center gap-3">
          {/* Widget de Perfil com Avatar e Status */}
          <Popover open={isStatusDropdownOpen} onOpenChange={setIsStatusDropdownOpen}>
            <PopoverTrigger asChild>
              <div 
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-zinc-700 transition-all cursor-pointer"
              >
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800">
                  <img src={myProfile?.avatar_url || ""} alt="Avatar" className="w-full h-full object-cover" />
                  <StatusBadge status={myProfile?.status || 'online'} />
                </div>
                <span className="text-xs font-semibold text-white">{myProfile?.display_name || 'Usuário'}</span>
                {myProfile?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-cyan-400" />}
              </div>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent side="bottom" align="end" sideOffset={8} className="w-48 bg-[#0d0d11] border border-white/5 rounded-2xl p-1.5 shadow-2xl z-50 backdrop-blur-xl">
                {['online', 'idle', 'dnd', 'offline'].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(s as any)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white rounded-xl transition-colors text-left"
                  >
                    <StatusBadge status={s as any} size="sm" />
                    <span className="capitalize">{s === 'offline' ? 'Invisível' : s === 'dnd' ? 'Não Perturbe' : s === 'idle' ? 'Ausente' : 'Disponível'}</span>
                  </button>
                ))}
                <div className="h-[1px] bg-white/5 my-1" />
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-400/5 rounded-xl transition-colors text-left"
                >
                  <LogOut size={16} />
                  <span>Sair</span>
                </button>
              </PopoverContent>
            </PopoverPortal>
          </Popover>

          {/* Botão de Configurações ⚙️ */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-zinc-900/60 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. CORPO PRINCIPAL (2 COLUNAS: CANAIS/DMS + CHAT/VOZ WIDESCREEN) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <Dialog open={isCreatingServer} onOpenChange={setIsCreatingServer}>
        <DialogContent className="bg-[#0d0d11]/95 backdrop-blur-2xl border border-white/5 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              {serverModalTab === 'create' ? "Novo Servidor" : "Entrar no Servidor"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-4 border border-white/5">
            <button onClick={() => setServerModalTab('create')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${serverModalTab === 'create' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Criar</button>
            <button onClick={() => setServerModalTab('join')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${serverModalTab === 'join' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Entrar</button>
          </div>

          {serverModalTab === 'create' ? (
            <div className="space-y-4 py-2">
              <Input value={newServerName} onChange={(e) => setNewServerName(e.target.value)} placeholder="Nome do servidor..." className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-[#00D1FF]/50 transition-all" />
              <Button onClick={handleCreateServer} className="w-full bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold h-12 rounded-xl">Criar Servidor</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Input value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} placeholder="Código de convite..." className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-[#00D1FF]/50 transition-all" />
              <Button onClick={handleJoinServer} className="w-full bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold h-12 rounded-xl">Entrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

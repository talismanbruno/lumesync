
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Hash, Settings, Plus, Search, User, LogOut, Send, Volume2, UserPlus, Sparkles, Trash2, Users, Check, X, MessageSquare, Clock, Monitor, PhoneOff, Mic, MicOff, Headphones, Menu, ChevronUp, Paperclip, Smile, Film, Download, FileText, Image as ImageIcon, Lock, Camera, BadgeCheck, Settings2, ScreenShare, Phone, ShieldCheck } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
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
import { ActiveCallBar } from "@/components/voice/ActiveCallBar";
import { OrbitalConnectionPanel } from "@/components/voice/OrbitalConnectionPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Popover, PopoverContent, PopoverTrigger, PopoverPortal } from "@/components/ui/popover";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { CreateGroupModal } from "@/components/ui/CreateGroupModal";
import { FriendsView } from "@/components/ui/FriendsView";
import { AdminVerifiedBadge } from "@/components/ui/AdminVerifiedBadge";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Lume" },
      { name: "description", content: "Lume" },
      { property: "og:title", content: "Lume" },
      { property: "og:description", content: "Lume" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
  }),
  component: DashboardComponent,
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
  file_url?: string | null;
  file_type?: string | null;
  file_name?: string | null;
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
  const getDisplayName = (profile: any) => {
    if (!profile) return "Usuário";
    const name = (profile.display_name || profile.username || "").trim().toLowerCase();
    return name || "usuario";
  };

  const getGroupTitle = (group: any, currentUserId: string) => {
    if (!group) return "Grupo";
    if (group.name && group.name.trim()) return group.name;

    const members = group.dm_group_members || [];
    if (members.length === 0) return "Carregando...";

    const others = members
      .filter((m: any) => m.user_id !== currentUserId)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.joined_at || a.created_at || 0).getTime();
        const dateB = new Date(b.joined_at || b.created_at || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.user_id.localeCompare(b.user_id);
      });

    if (others.length === 0) return "Grupo Vazio";

    const names = others.map((m: any) => getDisplayName(m.profiles));

    if (others.length === 1) return names[0];
    if (others.length === 2) return `${names[0]} e ${names[1]}`;
    return `${names[0]}, ${names[1]} +${others.length - 2}`;
  };


  const navigate = useNavigate();
  const { profile: globalProfile, user: authUser, signOut, updateProfile } = useAuth();
  
  const LUME_BOT_ID = '00000000-0000-0000-0000-000000000001';


  
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  // Local state as fallback/override if needed, but primary is from context
  const [currentUser, setCurrentUser] = useState<{ id: string, email?: string | null | undefined } | null>(null);
  const [dbProfile, setDbProfile] = useState<Profile | null>(null);


  useEffect(() => {
    if (authUser) {
      setCurrentUser({ id: authUser.id, email: authUser.email });
    }
    if (globalProfile) {
      setDbProfile(globalProfile as Profile);
      setProfilesCache(prev => ({ ...prev, [globalProfile.id]: globalProfile as Profile }));
    }
  }, [authUser, globalProfile]);

  const myProfile: Profile = (globalProfile as Profile) ?? dbProfile ?? {
    id: authUser?.id || "",
    username: authUser?.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || "usuario",
    display_name: authUser?.email?.split('@')[0] || "Usuário Lume",
    avatar_url: null,
    status: 'online'
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server?: Server; group?: any } | null>(null);
  
  // Media State
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Home / Friends state
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [addFriendUsername, setAddFriendUsername] = useState("");
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [activeDMFriend, setActiveDMFriend] = useState<Profile | null>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null);
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [serverModalTab, setServerModalTab] = useState<'create' | 'join'>('create');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [voiceParticipantsMap, setVoiceParticipantsMap] = useState<Record<string, any[]>>({});
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [dmGroups, setDmGroups] = useState<any[]>([]);
  const [activeDMGroup, setActiveDMGroup] = useState<any | null>(null);
  const [groupToLeave, setGroupToLeave] = useState<any | null>(null);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const bannerUploadRef = useRef<HTMLInputElement>(null);
  
  const [profilesCache, setProfilesCache] = useState<Record<string, Profile>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'conversas' | 'servidores' | 'amigos'>('amigos');
  const [friendFilter, setFriendFilter] = useState<'online' | 'all' | 'pending' | 'add'>('online');


  
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isOfficialLumeConversation = (profile: Profile | null) => {
    if (!profile) return false;
    return profile.id === LUME_BOT_ID || profile.username === 'lume';
  };
  const isBotChat = !activeChannel && isOfficialLumeConversation(activeDMFriend);

  
  const {
    participants,
    connectionStatus,
    screenStream,
    isMuted,
    isDeafened,
    isSharingScreen,
    isNoiseSuppressionEnabled,
    isNoiseSuppressionSupported,
    remoteVideoStreams,
    peerConnections,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    toggleNoiseSuppression,
    disconnect
  } = useVoiceRoom(activeVoiceChannel ? `server-channel-${activeVoiceChannel.id}` : null, myProfile);


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

  // Background Presence and Realtime for Sidebar Voice Participants
  useEffect(() => {
    if (!channels.length) return;
    
    const voiceChannels = channels.filter(c => c.type === 'voice');
    
    const fetchAllParticipants = async () => {
      const channelIds = voiceChannels.map(vc => vc.id);
      if (channelIds.length === 0) return;

      const { data, error } = await supabase
        .from('voice_participants')
        .select('user_id, channel_id, profiles(*)')
        .in('channel_id', channelIds);

      if (!error && data) {
        const grouped: Record<string, any[]> = {};
        (data as any[]).forEach((p: any) => {
          const profile = p.profiles as any;
          const channelId = p.channel_id;
          if (!grouped[channelId]) grouped[channelId] = [];
          
          // Se for o canal ativo e estivermos na call, priorizamos o estado do hook (Presence)
          // caso contrário, usamos os dados do banco.
          grouped[channelId].push({
            user_id: p.user_id,
            username: profile?.username || 'Usuário',
            display_name: profile?.display_name,
            avatar_url: profile?.avatar_url
          });
        });

        // Overlay do estado do Hook para o canal ativo (mais preciso e real-time)
        if (activeVoiceChannel?.id && participants.length > 0) {
          grouped[activeVoiceChannel.id] = participants.map(p => ({
            user_id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            isSpeaking: p.isSpeaking,
            isMuted: p.isMuted
          }));
        }

        setVoiceParticipantsMap(grouped);
      }
    };

    fetchAllParticipants();

    const channel = supabase
      .channel('voice_participants_global')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'voice_participants' 
      }, () => {
        fetchAllParticipants();
      })
      .subscribe();
        
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channels]);

  // Fetch messages and setup realtime
  useEffect(() => {
    if (!activeChannel) return;
    
    let isSubscribed = true;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, profile:profiles!user_id(*)")
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
          } else {
            // Ensure the profilesCache is used for the message mapping
            setProfilesCache(prev => ({ ...prev, [newMsg.user_id]: profile as Profile }));
          }
          
          if (isSubscribed) {
            const hydratedMsg: Message = { 
              id: newMsg.id,
              channel_id: newMsg.channel_id,
              user_id: newMsg.user_id,
              content: newMsg.content,
              created_at: newMsg.created_at,
              profile: profile,
              file_url: newMsg.file_url,
              file_type: newMsg.file_type,
              file_name: newMsg.file_name
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

  const handleFileUpload = async (file: File) => {
    if (!myProfile?.id) return;
    
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande! O limite é 50MB.");
      return;
    }

    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${myProfile.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      const messageData = {
        content: newMessage || "",
        file_url: publicUrl,
        file_type: file.type || 'application/octet-stream',
        file_name: file.name,
      };

      if (activeChannel) {
        await supabase.from("messages").insert({
          ...messageData,
          channel_id: activeChannel.id,
          user_id: myProfile.id
        } as any);
      } else if (activeDMFriend) {
        // Correção: Garantir que recipient_id e sender_id estejam corretos e usar nomes de colunas exatos
        await supabase.from("direct_messages").insert({
          content: messageData.content,
          file_url: messageData.file_url,
          file_type: messageData.file_type,
          file_name: messageData.file_name,
          sender_id: myProfile.id,
          recipient_id: activeDMFriend.id,
          is_read: false
        } as any);
      }

      setNewMessage("");
      setAttachmentPreview(null);
      setSelectedFile(null);
      toast.success("Arquivo enviado!");
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type && item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          setSelectedFile(file);
          setAttachmentPreview(URL.createObjectURL(file));
        }
      }
    }
  };

  const fetchGifs = async (query: string) => {
    try {
      const apiKey = "GlVGYHqc3SyCE12HN0SOMsO92g1UGOyK";
      const endpoint = query 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=g`;
        
      const res = await fetch(endpoint);
      const { data } = await res.json();
      setGifs(data || []);
    } catch (e) {
      console.error("Giphy error", e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGifs(gifSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [gifSearch]);

   const sendGif = async (url: string, gifData?: any) => {
    if (!myProfile?.id) return;
    const messageData = {
      content: "",
      file_url: gifData?.images?.original?.url || gifData?.images?.fixed_height?.url || url,
      file_type: "image/gif",
      file_name: "gif"
    };

    if (activeChannel) {
      await supabase.from("messages").insert({ ...messageData, channel_id: activeChannel.id, user_id: myProfile.id } as any);
    } else if (activeDMFriend) {
      await supabase.from("direct_messages").insert({ 
        sender_id: myProfile.id, 
        recipient_id: activeDMFriend.id, 
        content: messageData.content,
        file_url: messageData.file_url,
        file_type: messageData.file_type,
        file_name: messageData.file_name,
        is_read: false
      } as any);
    }
    setShowGifPicker(false);
    setGifSearch("");
  };

  useEffect(() => {
    fetchGifs(""); // Load trending on mount
  }, []);

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
      // Server-side validated join (invite code is never exposed to non-members)
      const { data: joinedServerId, error: joinError } = await supabase.rpc("join_server_by_invite", {
        p_code: inviteCodeInput.trim(),
      });

      if (joinError || !joinedServerId) {
        toast.error("Código de convite inválido!");
        return;
      }

      const { data: server, error: findError } = await supabase
        .from("servers")
        .select("*")
        .eq("id", joinedServerId as string)
        .maybeSingle();

      if (findError || !server) {
        toast.error("Erro ao carregar o servidor.");
        return;
      }

      const newServer: Server = server as Server;
      setServers(prev => (prev.some(s => s.id === newServer.id) ? prev : [...prev, newServer]));
      setActiveServer(newServer);
      toast.success("Você entrou no servidor!");

      setInviteCodeInput("");
      setIsCreatingServer(false);
    } catch (error: any) {
      console.error("Erro ao entrar no servidor:", error);
      toast.error("Erro ao entrar no servidor");
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

  const handleLeaveGroup = async () => {
    if (!groupToLeave || !myProfile?.id || isLeavingGroup) return;
    
    setIsLeavingGroup(true);
    try {
      const { error } = await supabase
        .from('dm_group_members')
        .delete()
        .eq('group_id', groupToLeave.id)
        .eq('user_id', myProfile.id);

      if (error) throw error;

      toast.success("Você saiu do grupo");
      
      // Update local state
      setDmGroups(prev => prev.filter(g => g.id !== groupToLeave.id));
      
      if (activeDMGroup?.id === groupToLeave.id) {
        clearChats();
        setFriendFilter('online');
      }

      setGroupToLeave(null);
    } catch (error: any) {
      console.error("Erro ao sair do grupo:", error);
      toast.error("Erro ao sair do grupo: " + error.message);
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const fetchConversations = async () => {
    if (!myProfile?.id) return;
    
    // Fetch Group DMs with detailed members
    const { data: membersData, error: membersError } = await supabase
      .from('dm_group_members')
      .select('group_id')
      .eq('user_id', myProfile.id);

    if (!membersError && membersData) {
      const groupIds = membersData.map(m => m.group_id);
      
      if (groupIds.length > 0) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('dm_groups')
          .select('*, dm_group_members(*, profiles(*))')
          .in('id', groupIds);
          
        if (!groupsError && groupsData) {
          setDmGroups(groupsData);
          
          if (activeDMGroup) {
            const updatedActive = groupsData.find((g: any) => g.id === activeDMGroup.id);
            if (updatedActive) setActiveDMGroup(updatedActive);
          }
        }
      } else {
        setDmGroups([]);
      }
    }

  };


  const fetchFriendships = async () => {
    if (!myProfile?.id) return;
    
    // Garantir que o bot Lume esteja sempre na lista, mesmo que não haja "amizade"
    const { data: friendshipsData, error } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`);
    
    // Buscar perfil do bot
    const { data: botProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', LUME_BOT_ID)
      .maybeSingle();

    if (!error && friendshipsData) {
      const mapped = friendshipsData.map((f: any) => ({
        ...f,
        friend_profile: f.requester_id === myProfile.id ? f.addressee : f.requester
      }));

      // Adicionar o bot se ele não estiver na lista (como accepted)
      if (botProfile && !mapped.some(f => f.friend_profile?.id === LUME_BOT_ID)) {
        mapped.unshift({
          id: 'lume-bot-fixed',
          requester_id: LUME_BOT_ID,
          addressee_id: myProfile.id,
          status: 'accepted',
          created_at: new Date().toISOString(),
          friend_profile: botProfile as Profile
        });
      }

      setFriendships(mapped);
    }
  };

  const fetchUnreadCounts = async () => {
    if (!myProfile?.id) return;
    const { data, error } = await supabase
      .from('direct_messages')
      .select('sender_id')
      .eq('recipient_id', myProfile.id)
      .eq('is_read', false);
    
    if (!error && data) {
      const counts: Record<string, number> = {};
      data.forEach(msg => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  useEffect(() => {
    fetchFriendships();
    fetchConversations();
    fetchUnreadCounts();

    const subFriends = supabase
      .channel('friendships_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, fetchFriendships)
      .subscribe();

    const subMessages = supabase
      .channel('unread_messages_realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `recipient_id=eq.${myProfile.id}`
      }, fetchUnreadCounts)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${myProfile.id}`
      }, fetchUnreadCounts)
      .subscribe();

    // Listen for Group DM member changes
    const subGroupMembers = supabase
      .channel('dm_group_members_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'dm_group_members' 
      }, (payload: any) => {
        console.log("[Realtime] dm_group_members change:", payload);
        
        if (payload.eventType === 'DELETE') {
          const { group_id, user_id } = payload.old as any;
          if (group_id && user_id) {
            // Se eu fui removido, recarrego tudo (para sumir da sidebar)
            if (user_id === myProfile.id) {
              fetchConversations();
            } else {
              // Se outro saiu, atualizo imutavelmente o estado local dos grupos
              setDmGroups(prev => prev.map(group => {
                if (group.id === group_id) {
                  return {
                    ...group,
                    dm_group_members: (group.dm_group_members || []).filter((m: any) => m.user_id !== user_id)
                  };
                }
                return group;
              }));

              // Atualizo o activeDMGroup se ele for o grupo afetado
              setActiveDMGroup((current: any) => {
                if (current?.id === group_id) {
                  return {
                    ...current,
                    dm_group_members: (current.dm_group_members || []).filter((m: any) => m.user_id !== user_id)
                  };
                }
                return current;
              });
            }
          } else {
            // Fallback se o payload for incompleto
            fetchConversations();
          }
        } else {
          // INSERT ou UPDATE
          fetchConversations();
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(subFriends);
      supabase.removeChannel(subMessages);
      supabase.removeChannel(subGroupMembers);
    };
  }, [myProfile?.id]);


  // Realtime Status for Profiles
  useEffect(() => {
    if (!myProfile?.id) return;

    const channel = supabase
      .channel('public_profiles_realtime')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles' 
      }, async (payload) => {
        const updated = payload.new as Profile;
        
        // Atualiza myProfile se for eu
        if (updated.id === myProfile.id) {
          setDbProfile(updated);
        }
        
        // Atualiza cache de perfis
        setProfilesCache(prev => ({ ...prev, [updated.id]: updated }));
        
        // Atualiza lista de amigos se necessário
        setFriendships(prev => prev.map(f => {
          if (f.friend_profile?.id === updated.id) {
            return { ...f, friend_profile: updated };
          }
          return f;
        }));
        
        // Atualiza DM ativa se for o amigo
        if (activeDMFriend?.id === updated.id) {
          setActiveDMFriend(updated);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfile?.id, activeDMFriend?.id]);

  const handleSendFriendRequest = async (usernameArg?: string) => {
    const uname = (usernameArg ?? addFriendUsername).trim();
    if (!uname || !myProfile?.id) return;
    const { data: found, error: searchError } = await supabase.rpc("find_profile_by_username", {
      p_username: uname,
    });


    const targetProfile = Array.isArray(found) ? found[0] : found;

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
    if ((!newMessage.trim() && !selectedFile) || !myProfile?.id) return;
    
    // Canal oficial somente leitura: somente Admins podem enviar
    const isBotChat = !activeChannel && isOfficialLumeConversation(activeDMFriend);
    if (isBotChat && !myProfile.is_admin) return;
    
    const content = newMessage;
    const fileToUpload = selectedFile;
    
    setNewMessage("");
    setSelectedFile(null);
    setAttachmentPreview(null);

    try {
      let fileData = {
        file_url: null as string | null,
        file_type: null as string | null,
        file_name: null as string | null
      };

      if (fileToUpload) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(fileToUpload);
        });
        const base64String = await base64Promise;

        fileData = {
          file_url: base64String,
          file_type: fileToUpload.type || 'application/octet-stream',
          file_name: fileToUpload.name
        };
      }

      if (activeChannel) {
        const { error } = await supabase
          .from("messages")
          .insert({ 
            channel_id: activeChannel.id, 
            user_id: myProfile.id, 
            content,
            file_url: fileData.file_url,
            file_type: fileData.file_type,
            file_name: fileData.file_name
          } as any);
        if (error) toast.error("Erro ao enviar mensagem");
      } else if (activeDMFriend) {
        // Se for o bot e for admin, disparar broadcast
        if (isBotChat && myProfile.is_admin) {
          const { error: broadcastError } = await supabase.rpc('broadcast_system_update', {
            update_text: content
          });
          if (broadcastError) {
            toast.error("Erro ao disparar broadcast: " + broadcastError.message);
          } else {
            toast.success("Broadcast enviado com sucesso!");
          }
        } else {
          const { error } = await supabase
            .from("direct_messages")
            .insert({ 
              sender_id: myProfile.id, 
              recipient_id: activeDMFriend.id, 
              content,
              file_url: fileData.file_url,
              file_type: fileData.file_type,
              file_name: fileData.file_name,
              is_read: false
            } as any);
          if (error) toast.error("Erro ao enviar DM");
        }
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    }
  };

  // Realtime DMs
  const markAsRead = async (userId?: string) => {
    const targetId = userId || activeDMFriend?.id;
    if (!myProfile?.id || !targetId) return;
    
    // 1. Zera no estado local
    setUnreadCounts(prev => ({ ...prev, [targetId]: 0 }));
    
    // 2. Atualiza no banco de dados de forma definitiva
    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('recipient_id', myProfile.id)
      .eq('sender_id', targetId)
      .eq('is_read', false);
  };

  useEffect(() => {
    if (activeDMFriend?.id) {
      markAsRead(activeDMFriend.id);
    }
  }, [activeDMFriend?.id]);

  useEffect(() => {
    if (!activeDMFriend || !myProfile?.id) return;
    
    markAsRead(activeDMFriend.id);

    const fetchDMs = async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*, profile:profiles!sender_id(*)')
        .or(`and(sender_id.eq.${myProfile.id},recipient_id.eq.${activeDMFriend.id}),and(sender_id.eq.${activeDMFriend.id},recipient_id.eq.${myProfile.id})`)

        .order('created_at', { ascending: true })
        .limit(50);
      if (!error && data) setMessages(data as Message[]);
    };
    
    fetchDMs();
    markAsRead();
    const sub = supabase
      .channel(`dms:${activeDMFriend.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `recipient_id=eq.${myProfile.id},sender_id=eq.${activeDMFriend.id}` 
      }, () => {
        fetchDMs();
        markAsRead();
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `recipient_id=eq.${activeDMFriend.id},sender_id=eq.${myProfile.id}` 
      }, fetchDMs)
      .subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, [activeDMFriend?.id, myProfile?.id]);

  

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const handleUpdateStatus = async (newStatus: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (!myProfile?.id) return;
    
    // Use o updateProfile do contexto para garantir sincronia global
    await updateProfile({ status: newStatus } as any);
    
    const { error } = await supabase

      .from('profiles')
      .update({ status: newStatus })
      .eq('id', myProfile.id);
      
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Status: ${newStatus}`);
    }
    setShowStatusMenu(false);
  };



  const copyInvite = () => {
    if (!activeServer) return;
    navigator.clipboard.writeText(activeServer.invite_code);
    toast.success("Código de convite copiado!");
  };

  // ===== Mensagens de grupo (DM Groups) =====
  useEffect(() => {
    if (!activeDMGroup?.id) return;

    const fetchGroupMessages = async () => {
      const { data } = await supabase
        .from('dm_group_messages')
        .select('*, profile:profiles!user_id(*)')
        .eq('group_id', activeDMGroup.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) setMessages(data as any as Message[]);
    };

    fetchGroupMessages();
    const sub = supabase
      .channel(`dmgroup:${activeDMGroup.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_group_messages',
        filter: `group_id=eq.${activeDMGroup.id}`,
      }, fetchGroupMessages)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [activeDMGroup?.id]);

  const sendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeDMGroup?.id || !myProfile?.id) return;
    const content = newMessage;
    setNewMessage("");
    const { error } = await supabase.from('dm_group_messages').insert({
      group_id: activeDMGroup.id,
      user_id: myProfile.id,
      content,
    } as any);
    if (error) toast.error("Erro ao enviar mensagem no grupo");
  };

  // ===== Navegação =====

  const clearChats = () => {
    setActiveChannel(null);
    setActiveDMFriend(null);
    setActiveDMGroup(null);
    setMessages([]);
  };


  const goHome = () => {
    setActiveServer(null);
    setChannels([]);
    clearChats();
    setFriendFilter('online');
  };

  const openServer = async (server: Server) => {
    clearChats();
    setActiveServer(server);
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("server_id", server.id)
      .order("created_at", { ascending: true });
    const list = (data || []) as Channel[];
    setChannels(list);
    const geral = list.find(c => c.type === 'text' && c.name === 'geral') || list.find(c => c.type === 'text');
    if (geral) setActiveChannel(geral);
  };

  const openDM = (friend: Profile) => {
    setActiveServer(null);
    setChannels([]);
    setActiveChannel(null);
    setActiveDMGroup(null);
    setMessages([]);
    setActiveDMFriend(friend);
  };

  const openGroup = (group: any) => {
    setActiveServer(null);
    setChannels([]);
    setActiveChannel(null);
    setActiveDMFriend(null);
    setMessages([]);
    setActiveDMGroup(group);
  };

  const friendsList = friendships
    .filter(f => f.status === 'accepted')
    .map(f => f.friend_profile)
    .filter(Boolean) as Profile[];

  const isReadOnly = isBotChat && !myProfile.is_admin;
  const inChat = !!(activeChannel || activeDMFriend || activeDMGroup);

  const renderMessage = (msg: Message) => {
    const authorId = (msg as any).user_id || (msg as any).sender_id;
    const isBotAuthor = authorId === LUME_BOT_ID;
    const author = isBotAuthor
      ? { id: LUME_BOT_ID, username: 'lume', display_name: 'Lume', avatar_url: 'https://i.ibb.co/99YTNvGS/image.png' } as Profile
      : (msg.profile || profilesCache[authorId || ''] || null);




    const fileUrl = msg.file_url || undefined;
    const isImage = !!fileUrl && (msg.file_type?.startsWith('image') || fileUrl.startsWith('data:image'));
    const isVideo = !!fileUrl && (msg.file_type?.startsWith('video') || fileUrl.startsWith('data:video'));

    return (
      <div key={msg.id} className="flex gap-3 px-6 py-2 hover:bg-white/[0.02] transition-colors group">
        <UserProfileCard user={(author || { id: '', username: '?' }) as any} isMe={author?.id === myProfile.id}>
          <div className="shrink-0 cursor-pointer">
            <UserAvatar
              avatarUrl={author?.avatar_url}
              name={author?.display_name || author?.username || "?"}
              size="h-10 w-10"
              className="rounded-xl"
            />
          </div>
        </UserProfileCard>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 truncate">
              {author?.display_name || author?.username || "Usuário"}
              <AdminVerifiedBadge isAdmin={author?.is_admin} size={12} />
            </span>
            {isBotAuthor && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded">
                Oficial
              </span>
            )}
            <span className="text-[10px] text-zinc-600">
              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {msg.content && (
            <div className="text-sm text-zinc-300 break-words whitespace-pre-wrap leading-relaxed">
              <MessageText content={msg.content} />
            </div>
          )}

          {fileUrl && isImage && (
            <PhotoProvider>
              <PhotoView src={fileUrl}>
                <img
                  src={fileUrl}
                  alt={msg.file_name || "imagem"}
                  className="mt-2 max-h-80 max-w-md w-auto rounded-xl border border-white/5 cursor-zoom-in object-contain"
                />
              </PhotoView>
            </PhotoProvider>
          )}

          {fileUrl && isVideo && (
            <video src={fileUrl} controls className="mt-2 max-h-80 max-w-md rounded-xl border border-white/5" />
          )}

          {fileUrl && !isImage && !isVideo && (
            <a
              href={fileUrl}
              download={msg.file_name || undefined}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#121212] border border-white/5 text-xs text-zinc-300 hover:border-cyan-500/40 transition-all"
            >
              <FileText size={16} className="text-cyan-400" />
              <span className="truncate max-w-[220px]">{msg.file_name || "Arquivo"}</span>
              <Download size={14} className="text-zinc-500" />
            </a>
          )}
        </div>
      </div>
    );
  };

  const renderComposer = (onSubmit: (e: React.FormEvent) => void, placeholder: string) => (
    <form onSubmit={onSubmit} className="px-6 pb-6 pt-2 shrink-0">
      {attachmentPreview && (
        <div className="mb-2 relative inline-block">
          <img src={attachmentPreview} alt="preview" className="h-24 rounded-xl border border-white/10 object-cover" />
          <button
            type="button"
            onClick={() => { setSelectedFile(null); setAttachmentPreview(null); }}
            className="absolute -top-2 -right-2 bg-red-500 text-black rounded-full p-1"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 bg-[#121212] border border-white/5 rounded-2xl px-3 py-2 focus-within:border-cyan-500/40 transition-all">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) { setSelectedFile(file); setAttachmentPreview(file.type.startsWith('image') ? URL.createObjectURL(file) : null); }
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-zinc-500 hover:text-cyan-400 transition-colors">
          <Paperclip size={18} />
        </button>

        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm text-zinc-100 placeholder:text-zinc-600 min-w-0"
        />

        <Popover open={showGifPicker} onOpenChange={setShowGifPicker}>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 text-zinc-500 hover:text-cyan-400 transition-colors">
              <Film size={18} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-80 p-2 bg-[#0d0d11] border-white/10 z-50">
            <Input value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} placeholder="Buscar GIFs..." className="h-9 mb-2 bg-black/40 border-white/5" />
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
              {gifs.map((g: any) => (
                <img
                  key={g.id}
                  src={g.images?.fixed_height_small?.url}
                  onClick={() => sendGif(g.images?.original?.url, g)}
                  className="rounded-lg cursor-pointer hover:opacity-80"
                  alt="gif"
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <button type="button" className="p-1.5 text-zinc-500 hover:text-cyan-400 transition-colors">
              <Smile size={18} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="p-0 border-none bg-transparent w-auto z-50">
            <EmojiPicker
              theme={Theme.DARK}
              onEmojiClick={(emoji: EmojiClickData) => setNewMessage(prev => prev + emoji.emoji)}
            />
          </PopoverContent>
        </Popover>

        <button type="submit" disabled={isUploading} className="p-2 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 transition-all">
          <Send size={16} />
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#050505] text-zinc-100 select-none">

      {/* COLUNA 1 — SERVIDORES (72px) */}
      <nav className="w-[72px] shrink-0 bg-[#050505] border-r border-white/5 flex flex-col items-center py-3 gap-2 overflow-y-auto scrollbar-none">
        <button
          onClick={goHome}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${!activeServer ? 'bg-cyan-500/15 border border-cyan-500/40 rounded-xl' : 'bg-[#121212] hover:rounded-xl'}`}
          title="Início"
        >
          <img src="/brand/lume-mark.png" alt="Início" className="w-7 h-7 object-contain" />
        </button>

        <div className="w-8 h-[2px] bg-white/5 rounded-full my-1 shrink-0" />

        {servers.map(server => (
          <ContextMenu key={server.id}>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => openServer(server)}
                className={`w-12 h-12 shrink-0 rounded-2xl bg-[#121212] text-sm font-bold text-zinc-300 flex items-center justify-center transition-all hover:rounded-xl hover:text-white ${activeServer?.id === server.id ? 'rounded-xl border-2 border-cyan-500/60 text-white' : ''}`}
                title={server.name}
              >
                {server.name.slice(0, 2).toUpperCase()}
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-[#0d0d11] border-white/10 text-zinc-200">
              {server.owner_id === myProfile.id ? (
                <ContextMenuItem className="text-red-400 focus:text-red-400" onClick={() => setServerToDelete(server)}>
                  <Trash2 size={14} className="mr-2" /> Apagar servidor
                </ContextMenuItem>
              ) : (
                <ContextMenuItem className="text-red-400 focus:text-red-400" onClick={() => handleLeaveServer(server.id)}>
                  <LogOut size={14} className="mr-2" /> Sair do servidor
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}

        <button
          onClick={() => setIsCreatingServer(true)}
          className="w-12 h-12 shrink-0 rounded-2xl bg-[#121212]/60 border border-dashed border-zinc-800 text-zinc-500 hover:border-cyan-500/60 hover:text-cyan-400 flex items-center justify-center transition-all"
          title="Adicionar servidor"
        >
          <Plus size={22} />
        </button>
      </nav>

      {/* COLUNA 2 — CANAIS OU DMs (240px) */}
      <aside className="w-[240px] shrink-0 bg-[#0a0a0b] border-r border-white/5 flex flex-col overflow-x-hidden">

        <header className="h-14 px-4 flex items-center justify-between border-b border-white/5 shrink-0 overflow-hidden">
          <span className="text-sm font-bold truncate text-zinc-100">
            {activeServer ? activeServer.name : (activeDMGroup ? getGroupTitle(activeDMGroup, myProfile.id) : "Mensagens Diretas")}
          </span>
          {activeServer ? (
            <button onClick={copyInvite} className="p-1.5 text-zinc-500 hover:text-cyan-400 transition-colors shrink-0" title="Copiar convite">
              <UserPlus size={16} />
            </button>
          ) : (
            <button onClick={() => setIsCreateGroupOpen(true)} className="p-1.5 text-zinc-500 hover:text-cyan-400 transition-colors shrink-0" title="Criar grupo">
              <Plus size={16} />
            </button>
          )}
        </header>


        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-2 py-3 space-y-4">
          {activeServer ? (
            <>
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Canais de Texto</p>
                {channels.filter(c => c.type === 'text').map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => { setActiveDMFriend(null); setActiveDMGroup(null); setActiveChannel(channel); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all overflow-hidden ${activeChannel?.id === channel.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`}
                  >
                    <Hash size={15} className="shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Canais de Voz</p>
                {channels.filter(c => c.type === 'voice').map(channel => {
                  const isCallActive = activeVoiceChannel?.id === channel.id;
                  // Usamos participants do hook para a sala ativa, e voiceParticipantsMap para as outras
                  const roomParticipants = isCallActive && participants.length > 0 
                    ? participants.map(p => ({
                        user_id: p.id,
                        username: p.username,
                        display_name: p.display_name,
                        avatar_url: p.avatar_url
                      }))
                    : (voiceParticipantsMap[channel.id] || []);

                  return (
                    <div key={channel.id} className="space-y-0.5">
                      <button
                        onClick={() => { setActiveVoiceChannel(channel); setShowVoiceUI(true); }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all overflow-hidden ${isCallActive ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`}
                      >
                        <Volume2 size={15} className="shrink-0" />
                        <span className="truncate">{channel.name}</span>
                        {roomParticipants.length > 0 && (
                          <span className="ml-auto text-[10px] text-cyan-400 shrink-0">{roomParticipants.length}</span>
                        )}
                      </button>

                      {/* Lista de participantes na sidebar */}
                      {roomParticipants.length > 0 && (
                        <div className="pl-7 pr-2 flex flex-col gap-1 pb-1">
                          {[...roomParticipants]
                            .sort((a, b) => {
                              if (a.user_id === myProfile.id) return -1;
                              if (b.user_id === myProfile.id) return 1;
                              return (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
                            })
                            .map((participant) => (
                              <div 
                                key={participant.user_id} 
                                className="flex items-center gap-2 py-0.5 group cursor-default"
                              >
                                <UserAvatar 
                                  avatarUrl={participant.avatar_url} 
                                  name={participant.display_name || participant.username} 
                                  size="h-5 w-5" 
                                  className="rounded-full shrink-0 border border-white/5" 
                                />
                                <span className="text-[12px] text-zinc-400 group-hover:text-zinc-300 truncate transition-colors">
                                  {participant.display_name || participant.username}
                                  {participant.user_id === myProfile.id && (
                                    <span className="ml-1 text-[10px] text-cyan-500/60">(Você)</span>
                                  )}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={goHome}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-all overflow-hidden ${!inChat ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5'}`}
              >
                <Users size={16} className="shrink-0" />
                <span className="truncate font-semibold">Amigos</span>
              </button>

              <div className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Conversas</p>

                {/* Canal oficial fixado */}
                <button
                  onClick={() => { markAsRead(LUME_BOT_ID); openDM({ id: LUME_BOT_ID, username: 'lume', display_name: 'Lume', avatar_url: '/brand/lume-mark.png' } as Profile); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all overflow-hidden ${activeDMFriend?.id === LUME_BOT_ID ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <UserAvatar avatarUrl="/brand/lume-mark.png" name="Lume" size="h-8 w-8" className="rounded-lg" />
                  <span className="truncate text-sm text-zinc-200">Lume</span>
                  <span className="ml-auto text-[9px] font-bold text-cyan-400 shrink-0">OFICIAL</span>
                </button>

                  {dmGroups.map(group => (
                    <ContextMenu key={group.id}>
                      <ContextMenuTrigger asChild>
                        <button
                          onClick={() => openGroup(group)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all overflow-hidden ${activeDMGroup?.id === group.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                          <div className="h-8 w-8 shrink-0 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                            <Users size={14} />
                          </div>
                          <span className="truncate text-sm text-zinc-300">
                            {getGroupTitle(group, myProfile.id)}
                          </span>
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="bg-[#0d0d11] border-white/10 text-zinc-200">
                        <ContextMenuItem 
                          className="text-red-400 focus:text-red-400" 
                          onClick={() => setGroupToLeave(group)}
                        >
                          <LogOut size={14} className="mr-2" /> Sair do grupo
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}


                {friendsList.map(friend => (
                  <button
                    key={friend.id}
                    onClick={() => { markAsRead(friend.id); openDM(friend); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all overflow-hidden ${activeDMFriend?.id === friend.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  >
                    <UserAvatar
                      avatarUrl={friend.avatar_url}
                      name={friend.display_name || friend.username}
                      status={friend.status}
                      showStatus
                      size="h-8 w-8"
                      className="rounded-lg"
                    />
                    <span className="truncate text-sm text-zinc-300">{friend.display_name || friend.username}</span>
                    {(unreadCounts[friend.id] || 0) > 0 && (
                      <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-black text-[10px] font-bold flex items-center justify-center">
                        {unreadCounts[friend.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* RODAPÉ DO PERFIL */}
        <div className="p-2 bg-[#070708] border-t border-white/5 flex items-center gap-2 overflow-hidden shrink-0">
          <Popover open={showStatusMenu} onOpenChange={setShowStatusMenu}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 flex-1 min-w-0 p-1 rounded-lg hover:bg-white/5 transition-colors overflow-hidden">
                <div className="relative shrink-0">
                  <UserAvatar avatarUrl={myProfile.avatar_url} name={myProfile.display_name || myProfile.username} size="h-8 w-8" className="rounded-lg" />
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <StatusBadge status={myProfile.status} size="sm" />
                  </div>
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-xs font-bold truncate text-zinc-100">{myProfile.display_name || myProfile.username}</span>
                  <span className="text-[10px] text-zinc-600 truncate">@{myProfile.username}</span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent side="top" align="start" className="w-52 p-2 bg-[#0d0d11] border-white/10 z-50">
                {(['online', 'idle', 'dnd', 'offline'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(s)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-zinc-200 transition-colors"
                  >
                    <StatusBadge status={s} size="sm" />
                    <span>{s === 'dnd' ? 'Não perturbar' : s === 'idle' ? 'Ausente' : s === 'offline' ? 'Invisível' : 'Online'}</span>
                  </button>
                ))}
                <div className="h-px bg-white/5 my-1" />
                <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm text-red-400 transition-colors">
                  <LogOut size={16} /> Sair da conta
                </button>
              </PopoverContent>
            </PopoverPortal>
          </Popover>

          <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 shrink-0 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <Settings size={18} />
          </button>
        </div>

        {/* Órbita de Voz: Conexão Orbital (Persistente no Rodapé) */}
        {activeVoiceChannel && (
          <OrbitalConnectionPanel 
            myProfile={myProfile}
            connectionStatus={connectionStatus}
            isMuted={isMuted}
            isDeafened={isDeafened}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onDisconnect={() => {
              disconnect();
              setActiveVoiceChannel(null);
              setShowVoiceUI(false);
            }}
            onOpenSettings={() => toast.info("Configurações de áudio em breve")}
          />
        )}
      </aside>

      {/* COLUNA 3 — CANVAS PRINCIPAL */}
      <main className="flex-1 min-w-0 flex flex-col bg-[#050505] overflow-hidden">
        {showVoiceUI && activeVoiceChannel ? (
          <VoiceRoomUI
            participants={participants}
            myProfile={myProfile}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isSharingScreen={isSharingScreen}
            isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
            screenStream={screenStream}
            remoteVideoStreams={remoteVideoStreams}
            peerConnections={peerConnections}
            toggleMute={toggleMute}
            toggleDeafen={toggleDeafen}
            toggleScreenShare={toggleScreenShare}
            toggleNoiseSuppression={toggleNoiseSuppression}
            onDisconnect={() => {
              disconnect();
              setActiveVoiceChannel(null);
              setShowVoiceUI(false);
            }}
            onClose={() => setShowVoiceUI(false)}
          />
        ) : inChat ? (
          <>
            <div className="flex flex-col flex-none z-40">
              {activeVoiceChannel && (
                <ActiveCallBar 
                  participants={participants}
                  roomName={activeVoiceChannel.name}
                  connectionStatus={connectionStatus}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  isSharingScreen={isSharingScreen}
                  isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                  onToggleMute={toggleMute}
                  onToggleDeafen={toggleDeafen}
                  onToggleScreenShare={toggleScreenShare}
                  onToggleNoiseSuppression={toggleNoiseSuppression}
                  onDisconnect={() => {
                    disconnect();
                    setActiveVoiceChannel(null);
                    setShowVoiceUI(false);
                  }}
                  onOpenStage={() => setShowVoiceUI(true)}
                />
              )}
              <header className="h-14 px-6 flex items-center gap-3 border-b border-white/5 shrink-0 overflow-hidden">

              {activeChannel ? (
                <>
                  <Hash size={18} className="text-zinc-600 shrink-0" />
                  <span className="text-sm font-bold truncate">{activeChannel.name}</span>
                </>
              ) : activeDMGroup ? (
                <>
                  <Users size={18} className="text-cyan-400 shrink-0" />
                  <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{getGroupTitle(activeDMGroup, myProfile.id)}</span>
                  </h2>
                  <div className="ml-auto flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const roomKey = `dm-group-${activeDMGroup.id}`;
                        // Aqui seria disparado o convite via broadcast no futuro
                        setActiveVoiceChannel({ id: roomKey, name: getGroupTitle(activeDMGroup, myProfile.id), type: 'voice', server_id: 'dm' });
                        setShowVoiceUI(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-cyan-400 transition-colors"
                      title="Chamada de voz"
                    >
                      <Phone size={18} />
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors">
                          <Users size={18} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 bg-[#181818] border-white/10 p-2 z-[60]" side="bottom" align="end">
                        <div className="space-y-2">
                          <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                            Membros — {activeDMGroup.dm_group_members?.length || 0}
                          </p>
                          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                            {(activeDMGroup.dm_group_members || [])
                              .sort((a: any, b: any) => {
                                if (a.user_id === myProfile.id) return -1;
                                if (b.user_id === myProfile.id) return 1;
                                const nameA = getDisplayName(a.profiles);
                                const nameB = getDisplayName(b.profiles);
                                return nameA.localeCompare(nameB);
                              })
                              .map((member: any) => (
                                <div key={member.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 group">
                                  <UserAvatar 
                                    avatarUrl={member.profiles?.avatar_url} 
                                    name={getDisplayName(member.profiles)} 
                                    size="h-8 w-8" 
                                    className="rounded-lg"
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors truncate">
                                        {getDisplayName(member.profiles)}
                                      </span>
                                      <AdminVerifiedBadge isAdmin={member.profiles?.is_admin} size={10} />
                                      {member.user_id === myProfile.id && <span className="ml-1 text-[10px] text-zinc-500 shrink-0">(Você)</span>}
                                    </div>
                                    {member.profiles?.status && (
                                      <span className="text-[10px] text-zinc-500 truncate capitalize">{member.profiles.status}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                          <div className="pt-2 mt-2 border-t border-white/5">
                            <Button 
                              variant="ghost" 
                              onClick={() => setGroupToLeave(activeDMGroup)}
                              className="w-full justify-start gap-2 text-xs text-red-400 hover:text-red-400 hover:bg-red-400/10 h-8 font-medium"
                            >
                              <LogOut size={14} />
                              Sair do grupo
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </>

              ) : (
                <>
                  <UserAvatar
                    avatarUrl={activeDMFriend?.avatar_url}
                    name={activeDMFriend?.display_name || activeDMFriend?.username || "?"}
                    size="h-7 w-7"
                    className="rounded-lg"
                  />
                  <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{activeDMFriend?.display_name || activeDMFriend?.username}</span>
                    <AdminVerifiedBadge isAdmin={activeDMFriend?.is_admin} size={12} />
                    {isBotChat && <BadgeCheck size={15} className="text-cyan-400 shrink-0" />}
                  </h2>
                  {!isBotChat && activeDMFriend && (
                    <div className="ml-auto flex items-center gap-2">
                      <button 
                        onClick={() => handleStartVoiceCall(activeDMFriend)}
                        className="p-2 text-zinc-400 hover:text-cyan-400 transition-colors"
                        title="Chamada de voz"
                      >
                        <Phone size={18} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </header>
          </div>


            <div className="flex-1 overflow-y-auto custom-scrollbar py-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-2">
                  <Sparkles size={40} strokeWidth={1} className="opacity-30" />
                  <p className="text-sm">Nenhuma mensagem ainda.</p>
                </div>
              )}
              {messages.map(renderMessage)}
              <div ref={chatEndRef} />
            </div>

            {isReadOnly || (activeDMGroup && !activeDMGroup.dm_group_members?.some((m: any) => m.user_id === myProfile.id)) ? (
              <div className="px-6 pb-6 pt-2 shrink-0">
                <div className="flex items-center justify-center gap-2 bg-[#121212] border border-white/5 rounded-2xl py-3 text-xs text-zinc-600">
                  <Lock size={14} /> Canal somente leitura
                </div>
              </div>
            ) : activeDMGroup ? (
              renderComposer(sendGroupMessage, `Mensagem para ${getGroupTitle(activeDMGroup, myProfile.id)}`)
            ) : (
              renderComposer(handleSendMessage, activeChannel ? `Conversar em #${activeChannel.name}` : `Mensagem para ${getDisplayName(activeDMFriend)}`)
            )}

          </>
        ) : (
          <FriendsView
            activeSubTab={friendFilter}
            onChangeSubTab={setFriendFilter}
            friendships={friendships}
            myProfile={myProfile}
            onSelectDM={openDM}
            onAcceptRequest={handleAcceptFriendRequest}
            onDeclineRequest={handleDeclineFriendRequest}
            onSendRequest={handleSendFriendRequest}
            onStartCall={handleStartVoiceCall}
          />
        )}
      </main>

      {/* MODAIS */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <Dialog open={isCreatingServer} onOpenChange={setIsCreatingServer}>
        <DialogContent className="bg-[#0d0d11]/95 backdrop-blur-2xl border border-white/5 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              {serverModalTab === 'create' ? "Novo Servidor" : "Entrar no Servidor"}
            </DialogTitle>
            <DialogDescription className="text-center text-zinc-500 text-sm">
              Crie um espaço novo ou entre com um código de convite.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-2 border border-white/5">
            <button onClick={() => setServerModalTab('create')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${serverModalTab === 'create' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Criar</button>
            <button onClick={() => setServerModalTab('join')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${serverModalTab === 'join' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Entrar</button>
          </div>

          {serverModalTab === 'create' ? (
            <div className="space-y-4 py-2">
              <Input value={newServerName} onChange={(e) => setNewServerName(e.target.value)} placeholder="Nome do servidor..." className="bg-black/40 border-white/5 text-white h-12 rounded-xl" />
              <Button onClick={handleCreateServer} className="w-full bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold h-12 rounded-xl">Criar Servidor</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Input value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} placeholder="Código de convite..." className="bg-black/40 border-white/5 text-white h-12 rounded-xl" />
              <Button onClick={handleJoinServer} className="w-full bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold h-12 rounded-xl">Entrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!serverToDelete} onOpenChange={(open) => !open && setServerToDelete(null)}>
        <DialogContent className="bg-[#0d0d11]/95 backdrop-blur-2xl border border-white/5 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Apagar servidor</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Tem certeza que deseja apagar "{serverToDelete?.name}"? Esta ação é permanente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setServerToDelete(null)} className="text-zinc-400">Cancelar</Button>
            <Button
              onClick={async () => { await handleDeleteServer(); goHome(); }}
              disabled={isDeletingServer}
              className="bg-red-500 text-black hover:bg-red-400 font-bold"
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        myProfile={myProfile}
        friendships={friendships}
        onCreateGroup={async (memberIds: string[], name?: string | null) => {
          if (isCreatingGroup) return;
          setIsCreatingGroup(true);
          try {
            console.log("[CreateGroup] Tentando criar grupo com:", memberIds);
            
            const creatorId = dbProfile?.id || authUser?.id;
            if (!creatorId) throw new Error("Usuário não autenticado");

            // 1. Criar o grupo
            const { data: group, error: groupError } = await supabase
              .from('dm_groups')
              .insert({ 
                name: (name && name.trim()) ? name.trim() : null, 
                created_by: creatorId 
              })
              .select()
              .single();

            if (groupError) throw groupError;

            // 2. Preparar membros (garantir que o criador está incluído e IDs são únicos)
            const allMemberIds = Array.from(new Set([creatorId, ...memberIds]));
            const memberInserts = allMemberIds.map(uid => ({
              group_id: group.id,
              user_id: uid,
            }));

            console.log("[CreateGroup] Inserindo membros efetivos:", memberInserts);

            const { error: membersError } = await supabase
              .from('dm_group_members')
              .insert(memberInserts);

            if (membersError) throw membersError;

            toast.success("Grupo criado com sucesso!");
            
            // 3. Forçar atualização e abrir
            if (typeof fetchConversations === 'function') {
              await fetchConversations();
            }
            
            openGroup(group);
            setIsCreateGroupOpen(false);
          } catch (err: any) {
            console.error("[CreateGroup] Falha crítica:", err);
            toast.error("Erro ao criar grupo: " + err.message);
          } finally {
            setIsCreatingGroup(false);
          }
        }}


      />

      {/* Confirmação de Sair do Grupo */}
      <Dialog open={!!groupToLeave} onOpenChange={(open) => !open && setGroupToLeave(null)}>
        <DialogContent className="bg-[#121212] border-white/10 text-white sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Sair do grupo?</DialogTitle>
            <DialogDescription className="text-zinc-400 pt-2">
              Você deixará de ver esta conversa, mas ela continuará disponível para os outros participantes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="ghost" 
              onClick={() => setGroupToLeave(null)}
              className="hover:bg-white/5 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleLeaveGroup}
              disabled={isLeavingGroup}
              className="bg-red-500 hover:bg-red-600 text-white border-none"
            >
              {isLeavingGroup ? "Saindo..." : "Sair do grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


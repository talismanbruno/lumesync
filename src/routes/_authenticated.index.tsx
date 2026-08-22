/**
 * REDESIGN DE INTERFACE: IMPLEMENTAR LAYOUT "FLUID DOCK & FLOATING CANVAS" (ESTILO LINEAR / ARC)
 * 
 * 1. ESTRUTURA DO CONTAINER PRINCIPAL
 * - Dock Flutuante (Sidebar 1)
 * - Aside Flutuante (Sidebar 2)
 * - Main Canvas Flutuante
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Hash, Settings, Plus, Search, User, LogOut, Send, Volume2, UserPlus, Sparkles, Trash2, Users, Check, X, MessageSquare, Clock, Monitor, PhoneOff, Mic, MicOff, Headphones, Menu, ChevronUp, Paperclip, Smile, Film, Download, FileText, Image as ImageIcon, Lock, Camera, BadgeCheck, Settings2, ScreenShare } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Popover, PopoverContent, PopoverTrigger, PopoverPortal } from "@/components/ui/popover";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { CreateGroupModal } from "@/components/ui/CreateGroupModal";
import { FriendsView } from "@/components/ui/FriendsView";


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
    links: [{ rel: "icon", type: "image/png", href: "https://i.ibb.co/99YTNvGS/image.png" }],
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
  const navigate = useNavigate();
  const { profile: globalProfile, user: authUser, signOut, updateProfile } = useAuth();
  
  const LUME_BOT_ID = '00000000-0000-0000-0000-000000000001';


  
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
    username: authUser?.email?.split('@')[0] || "usuário",
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server: Server } | null>(null);
  
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
  const bannerUploadRef = useRef<HTMLInputElement>(null);
  
  const [profilesCache, setProfilesCache] = useState<Record<string, Profile>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'conversas' | 'servidores' | 'amigos'>('amigos');
  const [friendFilter, setFriendFilter] = useState<'online' | 'all' | 'pending' | 'add'>('online');


  
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isBotChat = !activeChannel && (activeDMFriend?.id === LUME_BOT_ID || activeDMFriend?.username === 'lume');

  
  const {
    participants,
    allParticipantsInRoom,
    screenStream,
    isMuted,
    isDeafened,
    isSharingScreen,
    remoteVideoStreams,
    peerConnections,
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
          grouped[channelId].push({
            user_id: p.user_id,
            username: profile?.username || 'Usuário',
            display_name: profile?.display_name,
            avatar_url: profile?.avatar_url
          });
        });
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

  const fetchConversations = async () => {
    if (!myProfile?.id) return;
    
    // Fetch Group DMs
    const { data: groupsData, error: groupsError } = await supabase
      .from('dm_groups')
      .select('*, dm_group_members!inner(*)')
      .eq('dm_group_members.user_id', myProfile.id);
      
    if (!groupsError && groupsData) {
      setDmGroups(groupsData);
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

    return () => { 
      supabase.removeChannel(subFriends);
      supabase.removeChannel(subMessages);
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

  const handleSendFriendRequest = async () => {
    if (!addFriendUsername.trim() || !myProfile?.id) return;
    const { data: found, error: searchError } = await supabase.rpc("find_profile_by_username", {
      p_username: addFriendUsername.trim(),
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
    const isBotChat = !activeChannel && (activeDMFriend?.id === LUME_BOT_ID || activeDMFriend?.username === 'lume');
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

// Removed the blocking "Sincronizando Perfil..." interface.

  return (
    <div className="flex h-full w-full overflow-hidden bg-transparent">
      {/* PAINEL DE INSTRUÇÕES (DEBUG) */}
      {/* Debug Panel removed per UI requirements */}

      {/* Mobile Top Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center justify-between border-b border-white/5 bg-[#050505] px-4 md:hidden">
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
        <div className="w-8" />
      </div>

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Wrapper (Unified 2-Panel Layout) */}
      <div className={`fixed inset-y-0 left-0 z-[70] flex w-80 transform transition-transform duration-300 md:relative md:translate-x-0 md:shrink-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-full w-full bg-[#0d0d10] border-r border-white/5">
          {/* Top: Logo + Quick Search */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <LumeLogo variant="full" className="h-6 w-auto" />
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-zinc-500 hover:text-white transition-colors md:hidden"
              >
                <X size={20} onClick={() => setIsMobileMenuOpen(false)} />
              </button>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-cyan-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Busca rápida..." 
                className="w-full bg-black/40 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/30 transition-all"
              />
            </div>
          </div>

          {/* Middle: Unified Tabs (Capsules) */}
          <div className="px-4 py-2">
            <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
              <button 
                onClick={() => { setActiveTab('conversas'); setActiveServer(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'conversas' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <MessageSquare size={12} />
                <span>Conversas</span>
              </button>
              <button 
                onClick={() => { setActiveTab('servidores'); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'servidores' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Hash size={12} />
                <span>Servidores</span>
              </button>
              <button 
                onClick={() => { setActiveTab('amigos'); setActiveServer(null); setActiveDMFriend(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'amigos' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Users size={12} />
                <span>Amigos</span>
              </button>
            </div>
          </div>

          {/* Dynamic Content List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar">
            {activeTab === 'conversas' && (
              <div className="space-y-1">
                <div className="flex items-center px-2 py-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                  <span className="flex-1">Mensagens Diretas</span>
                  <Plus size={14} className="cursor-pointer hover:text-white transition-colors" onClick={() => setIsCreateGroupOpen(true)} />
                </div>
                {/* Lume Bot Fixed */}
                <button
                  onClick={() => {
                    setActiveDMFriend({
                      id: LUME_BOT_ID,
                      username: 'lume',
                      display_name: 'Lume',
                      avatar_url: 'https://i.ibb.co/99YTNvGS/image.png',
                      status: 'online',
                      is_verified: true
                    } as Profile);
                    setActiveChannel(null);
                    setShowVoiceUI(false);
                    markAsRead(LUME_BOT_ID);
                  }}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-all ${
                    activeDMFriend?.id === LUME_BOT_ID ? 'bg-white/5 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src="https://i.ibb.co/99YTNvGS/image.png" alt="Lume" className="w-8 h-8 rounded-xl object-contain" />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00D1FF] ring-2 ring-[#0d0d10]" />
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="font-semibold text-sm truncate">Lume</span>
                      <BadgeCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="px-1 py-0.2 text-[8px] bg-cyan-500/20 text-cyan-400 font-bold rounded">OFICIAL</span>
                    </div>
                  </div>
                </button>

                {/* Friend Conversations */}
                {friendships
                  .filter(f => f.status === 'accepted' && f.friend_profile?.id !== LUME_BOT_ID)
                  .map(f => {
                    const friend = f.friend_profile;
                    if (!friend) return null;
                    return (
                      <button 
                        key={friend.id}
                        onClick={() => { setActiveDMFriend(friend); setActiveChannel(null); setShowVoiceUI(false); markAsRead(friend.id); }}
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors overflow-hidden ${
                          activeDMFriend?.id === friend.id ? "bg-white/5 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-8 w-8 rounded-xl border border-white/5">
                            <AvatarImage src={friend.avatar_url || ""} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px] rounded-xl">
                              {friend.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <StatusBadge status={friend.status} size="sm" className="absolute bottom-0 right-0 border-2 border-[#0d0d10]" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium">{friend.display_name || friend.username}</span>
                            {friend.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                          </div>
                        </div>
                        {(unreadCounts[friend.id] || 0) > 0 && (
                          <span className="w-4 h-4 bg-cyan-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,209,255,0.4)]">
                            {unreadCounts[friend.id]}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}

            {activeTab === 'servidores' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center px-2 py-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                    <span className="flex-1">Seus Servidores</span>
                    <Plus size={14} className="cursor-pointer hover:text-white transition-colors" onClick={() => setIsCreatingServer(true)} />
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {servers.map(server => (
                      <button 
                        key={server.id}
                        onClick={() => setActiveServer(server)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${activeServer?.id === server.id ? "bg-white/10 text-white shadow-sm border border-white/5" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${activeServer?.id === server.id ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,209,255,0.3)]" : "bg-zinc-800 text-zinc-400"}`}>
                          {server.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium truncate flex-1 text-left">{server.name}</span>
                        {activeServer?.id === server.id && <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,209,255,0.8)]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {activeServer && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="h-px bg-white/5 mx-2" />
                    <div className="space-y-1">
                      <div className="flex items-center px-2 py-1 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Canais</div>
                      {channels.map(channel => (
                        <button 
                          key={channel.id}
                          onClick={() => { 
                            if (channel.type === 'text') { setActiveChannel(channel); setActiveDMFriend(null); setShowVoiceUI(false); }
                            else { setActiveVoiceChannel(channel); setShowVoiceUI(true); }
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            (channel.type === 'text' && activeChannel?.id === channel.id) || (channel.type === 'voice' && activeVoiceChannel?.id === channel.id)
                              ? "bg-white/5 text-cyan-400" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                          }`}
                        >
                          {channel.type === 'text' ? <Hash size={16} /> : <Volume2 size={16} />}
                          <span className="font-medium">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'amigos' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center px-2 py-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Amigos</div>
                  {['online', 'all', 'pending', 'add'].map(f => (
                    <button 
                      key={f}
                      onClick={() => setFriendFilter(f as any)}
                      className={`flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${friendFilter === f ? "bg-white/5 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}`}
                    >
                      {f === 'online' ? <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,209,255,0.8)]" /> :
                       f === 'all' ? <Users size={16} /> :
                       f === 'pending' ? <Clock size={16} /> : <Plus size={16} />}
                      <span className="capitalize">{f === 'online' ? 'Disponível' : f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Adicionar'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Spacer to push profile to bottom */}
          <div className="flex-1" />

          {/* Bottom: Profile Widget */}
          <div className="p-4 bg-black/20 border-t border-white/5 space-y-3">
            {/* Widget de Voz (Se Conectado) */}
            {activeVoiceChannel && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-cyan-400 truncate uppercase tracking-widest">Voz Conectada</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setShowVoiceUI(true)}
                        className="p-1 text-zinc-500 hover:text-white transition-colors"
                      >
                        <Monitor size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          disconnect();
                          setActiveVoiceChannel(null);
                          setShowVoiceUI(false);
                        }}
                        className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                      >
                        <PhoneOff size={14} />
                      </button>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <button onClick={toggleMute} className={`flex-1 p-2 rounded-xl transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                     {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                   </button>
                   <button onClick={toggleDeafen} className={`flex-1 p-2 rounded-xl transition-colors ${isDeafened ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                     <Headphones size={14} />
                   </button>
                   <button onClick={toggleScreenShare} className={`flex-1 p-2 rounded-xl transition-colors ${isSharingScreen ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                     <ScreenShare size={14} />
                   </button>
                 </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-2 bg-[#121214] border border-white/5 rounded-2xl group hover:border-zinc-700 transition-all">
              <div className="relative shrink-0">
                <Popover open={showStatusMenu} onOpenChange={setShowStatusMenu}>
                  <PopoverTrigger asChild>
                    <button className="relative w-9 h-9 rounded-xl overflow-hidden bg-zinc-800 transition-transform active:scale-90">
                      <img src={myProfile?.avatar_url || ""} alt="Avatar" className="w-full h-full object-cover" />
                      <StatusBadge status={myProfile?.status} size="sm" className="absolute bottom-0 right-0 border-2 border-[#121214]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent side="top" align="start" sideOffset={12} className="w-48 bg-[#0d0d11] border border-white/5 rounded-2xl p-1.5 shadow-2xl z-50 backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200">
                      {['online', 'idle', 'dnd', 'offline'].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleUpdateStatus(s as any)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white rounded-xl transition-colors text-left"
                        >
                          <StatusBadge status={s as any} size="sm" />
                          <span className="capitalize font-medium">{s === 'offline' ? 'Invisível' : s === 'dnd' ? 'Não Perturbe' : s === 'idle' ? 'Ausente' : 'Disponível'}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </PopoverPortal>
                </Popover>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{myProfile?.display_name || myProfile?.username}</p>
                <p className="text-[10px] text-zinc-500 font-medium truncate capitalize">{myProfile?.status || 'online'}</p>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <Settings2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Área Principal de Chat / Chamada de Voz em Tela Ampla */}
      <main className="flex-1 min-w-0 h-full bg-[#050505] flex flex-col relative overflow-hidden z-10 w-full items-center">

        <div className="flex flex-1 flex-col overflow-hidden w-full">
          {activeVoiceChannel && showVoiceUI ? (

            <VoiceRoomUI
              participants={participants}
              myProfile={myProfile}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isSharingScreen={isSharingScreen}
              screenStream={screenStream}
              remoteVideoStreams={remoteVideoStreams}
              peerConnections={peerConnections}
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
              <header className="h-14 px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-transparent">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <span className="text-zinc-500 font-medium">Lume</span>
                  <span className="text-zinc-600">✦</span>
                  <span className="text-zinc-300 font-semibold">{activeServer?.name || "Home"}</span>
                  {activeChannel && activeChannel.name !== 'geral' && activeChannel.name !== 'Sala de Voz' && (
                    <>
                      <span className="text-zinc-600">✦</span>
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                        {activeChannel.type === 'voice' ? '🔊' : '#'} {activeChannel.name}
                      </span>
                    </>
                  )}
                  {activeDMFriend && (
                    <>
                      <span className="text-zinc-600">✦</span>
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                        @ {activeDMFriend.display_name || activeDMFriend.username}
                      </span>
                    </>
                  )}
                </div>
                
                {activeServer && (
                  <button onClick={copyInvite} className="p-2 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                    <UserPlus size={14} />
                    <span>Convidar</span>
                  </button>
                )}
              </header>

              <div className="flex-1 w-full max-w-5xl px-8 py-4 overflow-y-auto space-y-4 custom-scrollbar">
                <div className="space-y-6">

                  {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className="group flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <UserProfileCard user={msg.profile || ({} as Profile)} isMe={msg.user_id === myProfile.id}>
                        <div className="shrink-0 cursor-pointer">
                          <UserAvatar 
                            avatarUrl={msg.profile?.avatar_url}
                            name={msg.profile?.display_name || msg.profile?.username}
                            size="h-10 w-10"
                            className="rounded-xl border border-white/5 shadow-lg"
                          />
                        </div>
                      </UserProfileCard>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold text-white hover:underline cursor-pointer">
                            {msg.profile?.display_name || msg.profile?.username || 'Usuário'}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-medium">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed break-words">
                          <MessageText content={msg.content} />
                        </div>
                        {msg.file_url && (
                          <div className="mt-2 rounded-2xl overflow-hidden border border-white/5 bg-black/20 max-w-sm">
                            {msg.file_type?.startsWith('image/') ? (
                              <PhotoProvider>
                                <PhotoView src={msg.file_url}>
                                  <img src={msg.file_url} alt="Attachment" className="w-full h-auto cursor-zoom-in hover:opacity-90 transition-opacity" />
                                </PhotoView>
                              </PhotoProvider>
                            ) : msg.file_type?.startsWith('video/') ? (
                              <video src={msg.file_url} controls className="w-full h-auto" />
                            ) : (
                              <div className="p-4 flex items-center gap-3">
                                <FileText className="text-cyan-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-white truncate">{msg.file_name || 'Arquivo'}</p>
                                  <a href={msg.file_url} download className="text-[10px] text-cyan-400 hover:underline">Download</a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Message Input */}
              <div className="w-full max-w-5xl px-8 pb-8 bg-gradient-to-t from-[#050505] to-transparent">
                <div className="relative group">

                  {attachmentPreview && (
                    <div className="absolute bottom-full left-0 mb-4 p-2 bg-[#121214] border border-white/5 rounded-2xl animate-in slide-in-from-bottom-2">
                      <div className="relative">
                        <img src={attachmentPreview} alt="Preview" className="h-32 w-auto rounded-xl object-cover" />
                        <button onClick={() => { setAttachmentPreview(null); setSelectedFile(null); }} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <form 
                    onSubmit={handleSendMessage}
                    className="flex items-end gap-2 bg-[#121214] border border-white/5 rounded-2xl p-2 focus-within:border-cyan-500/30 transition-all shadow-2xl"
                  >
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-zinc-500 hover:text-white transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          if (file.type.startsWith('image/')) setAttachmentPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e as any);
                        }
                      }}
                      placeholder={isBotChat ? "Canal oficial (somente leitura)" : `Conversar em ${activeChannel ? '#' + activeChannel.name : '@' + (activeDMFriend?.display_name || activeDMFriend?.username)}`}
                      disabled={isBotChat && !myProfile.is_admin}
                      className="flex-1 bg-transparent border-none text-sm text-white py-2.5 px-2 resize-none max-h-32 focus:ring-0 placeholder:text-zinc-600 custom-scrollbar"
                      rows={1}
                    />
                    <div className="flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => setShowGifPicker(!showGifPicker)}
                        className={`p-2 transition-colors ${showGifPicker ? "text-cyan-400" : "text-zinc-500 hover:text-white"}`}
                      >
                        <Film size={20} />
                      </button>
                      <button 
                        type="submit"
                        disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                        className="p-2.5 bg-cyan-500 text-black rounded-xl hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,209,255,0.2)] disabled:opacity-50"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="w-24 h-24 rounded-3xl bg-zinc-900 flex items-center justify-center border border-white/5 shadow-2xl animate-pulse">
                <LumeLogo variant="icon" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Bem-vindo ao Lume</h2>
                <p className="text-sm text-zinc-500 max-w-xs mx-auto">Selecione uma conversa ou servidor no painel esquerdo para começar.</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={() => setActiveTab('servidores')} 
                  variant="outline" 
                  className="rounded-xl border-white/5 hover:bg-white/5 text-zinc-400"
                >
                  Explorar Servidores
                </Button>
                <Button 
                  onClick={() => setActiveTab('amigos')} 
                  className="bg-cyan-500 text-black hover:bg-cyan-400 rounded-xl font-bold px-6 shadow-[0_0_20px_rgba(0,209,255,0.1)]"
                >
                  Adicionar Amigos
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <CreateGroupModal 
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        myProfile={myProfile}
        friendships={friendships}
        onCreateGroup={async (memberIds, name) => {
          try {
            const { data: group, error: groupError } = await supabase
              .from('dm_groups')
              .insert({ name: name || null, created_by: myProfile.id })
              .select()
              .single();
              
            if (groupError) throw groupError;
            
            const memberInserts = [myProfile.id, ...memberIds].map(uid => ({
              group_id: group.id,
              user_id: uid
            }));
            
            const { error: membersError } = await supabase
              .from('dm_group_members')
              .insert(memberInserts);
              
            if (membersError) throw membersError;
            
            toast.success("Grupo criado com sucesso!");
            await fetchConversations();
            setActiveDMGroup(group);
            setActiveDMFriend(null);
            setActiveChannel(null);
            setActiveServer(null);
            setActiveTab('conversas');
          } catch (err: any) {
            toast.error("Erro ao criar grupo: " + err.message);
          }
        }}
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
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
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const bannerUploadRef = useRef<HTMLInputElement>(null);
  
  const [profilesCache, setProfilesCache] = useState<Record<string, Profile>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  
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

  const sendGif = async (url: string) => {
    if (!myProfile?.id) return;
    const messageData = {
      content: "",
      file_url: url,
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
        const filePath = `${myProfile.id}/${Date.now()}-${fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, fileToUpload);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);
          
        fileData = {
          file_url: publicUrl,
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
        .select('*')
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-white">
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

      {/* Sidebar Wrapper (Columns 1 & 2) */}
      <div className={`fixed inset-y-0 left-0 z-[70] flex w-[312px] transform transition-transform duration-300 md:relative md:translate-x-0 md:w-auto md:shrink-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full w-full">
          {/* COLUNA 1: SERVIDORES (LARGURA FIXA E NUNCA ESMAGA) */}
          <nav className="w-[72px] min-w-[72px] shrink-0 h-full bg-[#0a0a0c] border-r border-zinc-800/60 flex flex-col items-center py-3 z-30 select-none overflow-x-hidden">
            {/* 1. Botão Home / Lume Logo */}
            <button 
              onClick={() => { setActiveServer(null); setActiveDMFriend(null); setActiveChannel(null); setShowVoiceUI(false); }} 
              className="w-12 h-12 rounded-2xl flex items-center justify-center hover:rounded-xl transition-all mb-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 relative"
            >
              <img src="https://i.ibb.co/99YTNvGS/image.png" alt="Lume" className="w-10 h-10 rounded-xl object-contain" />
            </button>
            
            <div className="w-8 h-[2px] bg-zinc-800 rounded my-1" />
            
            {/* 2. Lista de Servidores com o Botão + no final da lista */}
            <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar overflow-x-hidden py-1">
              {servers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => setActiveServer(server)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY, server });
                  }}
                  className={`group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] transition-all duration-200 hover:rounded-[16px] ${
                    activeServer?.id === server.id ? "rounded-[16px] bg-[#00D1FF] text-black glow-sm" : "bg-[#121212] text-zinc-400 hover:bg-[#00D1FF] hover:text-black"
                  }`}
                >
                  <div className={`absolute -left-1 h-2 w-2 rounded-full bg-white transition-all ${activeServer?.id === server.id ? "scale-100" : "scale-0 group-hover:scale-100"}`} />
                  <span className="text-sm font-bold truncate px-1">{server.name.substring(0, 2).toUpperCase()}</span>
                </button>
              ))}
              
              {/* O Botão + DEVE FICAR AQUI DENTRO DA COLUNA 1, ABAIXO DOS SERVIDORES */}
              <button 
                onClick={() => setIsCreatingServer(true)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] bg-[#121212] text-[#00D1FF] transition-all hover:rounded-[16px] hover:bg-[#00D1FF] hover:text-black glow-sm border border-[#00D1FF]/20"
              >
                <Plus size={24} />
              </button>
            </div>
          </nav>
      {/* Moved context menu and dialogs outside the nav but inside the wrapper if needed, 
          or just ensured the wrapper is closed correctly */}



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
        
        {/* Remove old Plus button location outside Column 1 */}
        <Dialog open={isCreatingServer} onOpenChange={(open) => { setIsCreatingServer(open); if (!open) setServerModalTab('create'); }}>
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
      {/* COLUNA 2: CANAIS / DMs (LARGURA FIXA 240px NO DESKTOP) */}
      <aside className="w-60 min-w-[240px] max-w-[240px] shrink-0 h-full bg-[#121214] border-r border-zinc-800/60 flex flex-col justify-between z-20">






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
                {/* CHAT FIXO DO BOT OFICIAL */}
                <UserProfileCard
                  user={{
                    id: LUME_BOT_ID,
                    username: 'lume',
                    display_name: 'Lume',
                    avatar_url: 'https://i.ibb.co/99YTNvGS/image.png',
                    status: 'online',
                    is_verified: true,
                    bio: 'Bot oficial do Lume. Aqui você recebe as últimas novidades e atualizações da plataforma.'
                  }}
                  isMe={false}
                  onMessageClick={() => {
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
                >
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all mb-1 ${
                      activeDMFriend?.id === LUME_BOT_ID ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                  <div className="relative shrink-0">
                    <img 
                      src="https://i.ibb.co/99YTNvGS/image.png" 
                      alt="Lume" 
                      className="w-8 h-8 rounded-xl object-contain" 
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00D1FF] ring-2 ring-[#121214]" />
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="font-semibold text-sm text-white truncate">Lume</span>
                      <BadgeCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="px-1 py-0.2 text-[9px] bg-cyan-500/20 text-cyan-400 font-bold rounded">OFICIAL</span>
                    </div>
                    <span className="text-xs text-zinc-500 truncate">Canal de Novidades e Atualizações</span>
                  </div>
                  </button>
                </UserProfileCard>

                {friendships
                  .filter(f => f.status === 'accepted' && f.friend_profile?.id !== LUME_BOT_ID)
                  .map(friendship => {
                    const friend = friendship.friend_profile;
                    if (!friend) return null;
                    const isBot = friend.id === LUME_BOT_ID;
                    return (
                      <button 
                        key={friend.id}
                        onClick={() => { 
                          setActiveDMFriend(friend); 
                          setActiveChannel(null); 
                          setShowVoiceUI(false);
                          markAsRead(friend.id);
                        }}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                          activeDMFriend?.id === friend.id ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        }`}
                      >
                        <div className="relative">
                          <UserProfileCard
                            user={{
                              ...friend,
                              status: friend.id === LUME_BOT_ID ? 'online' : friend.status
                            }}
                            isMe={false}
                            onMessageClick={() => { 
                              setActiveDMFriend(friend); 
                              setActiveChannel(null); 
                              setShowVoiceUI(false);
                              markAsRead(friend.id);
                            }}
                          >
                            <Avatar className="h-8 w-8 border border-white/5 hover:opacity-90 transition-opacity">
                              <AvatarImage src={friend.avatar_url || ""} />
                              <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px]">
                                {friend.username.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </UserProfileCard>
                          <StatusBadge 
                            status={isBot ? 'online' : friend.status} 
                            size="sm" 
                            className="absolute bottom-0 right-0 border-2 border-[#121212]" 
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium">{friend.display_name || friend.username}</span>
                            {friend.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                            {isBot && (
                              <span className="shrink-0 px-1 py-0.5 text-[9px] bg-[#00D1FF]/20 text-[#00D1FF] font-bold rounded uppercase">OFICIAL</span>
                            )}
                          </div>
                          {isBot && <p className="text-[10px] text-zinc-500 truncate">Canal de Novidades e Atualizações</p>}
                        </div>
                        {(unreadCounts[friend.id] || 0) > 0 && (
                          <span className="w-4 h-4 bg-[#00D1FF] text-black text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                            {unreadCounts[friend.id]}
                          </span>
                        )}
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
                        <UserProfileCard 
                          user={{
                            id: p.user_id,
                            username: p.username,
                            display_name: p.display_name,
                            avatar_url: p.avatar_url,
                            banner_url: p.banner_url,
                            bio: p.bio,
                            created_at: p.created_at,
                            status: p.profiles?.status,
                            is_verified: p.is_verified || p.user_id === LUME_BOT_ID
                          }}
                          isMe={p.user_id === myProfile.id}
                          onEditClick={p.user_id === myProfile.id ? () => setIsSettingsOpen(true) : undefined}
                          onMessageClick={p.user_id !== myProfile.id ? () => {
                            const friend = friendships.find(f => f.friend_profile?.id === p.user_id)?.friend_profile;
                            if (friend) {
                              setActiveDMFriend(friend);
                              setActiveChannel(null);
                              setShowVoiceUI(false);
                            }
                          } : undefined}
                        >
                          <div className="flex items-center gap-2 px-2 py-1 rounded-md text-xs text-zinc-400 hover:bg-white/5 transition-colors group cursor-pointer">
                            <div className="relative">
                              <UserAvatar 
                                avatarUrl={p.avatar_url}
                                name={p.display_name || p.username}
                                size="h-5 w-5"
                                status={p.profiles?.status}
                                showStatus={true}
                                className="group-hover:border-[#00D1FF]/30 border border-white/10"
                              />
                            </div>
                            <span className={`truncate ${p.user_id === myProfile.id ? "text-[#00D1FF] font-medium" : ""}`}>
                              {p.display_name || p.username}
                            </span>
                          <div className="ml-auto flex gap-1">
                            {p.isMuted && <MicOff size={10} className="text-red-500" />}
                            {p.isDeafened && <Headphones size={10} className="text-red-500" />}
                          </div>
                        </div>
                      </UserProfileCard>
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
        <div className="mt-auto flex items-center gap-3 border-t border-white/5 bg-[#050505]/50 p-2 relative overflow-x-hidden">
          <Popover open={showStatusMenu} onOpenChange={setShowStatusMenu}>
            <PopoverTrigger asChild>
              <UserAvatar 
                avatarUrl={myProfile?.avatar_url}
                name={myProfile?.display_name || myProfile?.username}
                size="h-9 w-9"
                status={myProfile?.status || 'online'}
                showStatus={true}
                className="cursor-pointer group"
              />
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent 
                side="top" 
                align="start" 
                sideOffset={12}
                className="w-48 bg-[#141416] border border-zinc-800 rounded-lg p-1.5 shadow-2xl z-[100] animate-in slide-in-from-bottom-2 duration-200"
              >
                <div className="px-2 py-1.5 mb-1 border-b border-white/5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Definir Status</span>
                </div>
                {[
                  { id: 'online', label: 'Disponível', color: '#00D1FF' },
                  { id: 'idle', label: 'Ausente', color: '#F59E0B' },
                  { id: 'dnd', label: 'Não Perturbe', color: '#EF4444' },
                  { id: 'offline', label: 'Invisível', color: '#71717A' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleUpdateStatus(s.id as any)}
                    className="w-full flex items-center gap-3 px-2 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white rounded-md transition-colors text-left"
                  >
                    <StatusBadge status={s.id} size="sm" showGlow={s.id === 'online'} />
                    <span>{s.label}</span>
                    {myProfile.status === s.id && <Check size={14} className="ml-auto text-[#00D1FF]" />}
                  </button>
                ))}
              </PopoverContent>
            </PopoverPortal>
          </Popover>
          
          <UserProfileCard
            user={myProfile}
            isMe={true}
            onEditClick={() => setIsSettingsOpen(true)}
          >
            <div 
              className="flex flex-col items-start flex-1 min-w-0 overflow-hidden text-white cursor-pointer"
            >
              <div className="flex items-center gap-1 w-full min-w-0">
                <p className="truncate text-xs font-bold w-full">{myProfile?.display_name || myProfile?.username || "Usuário Lume"}</p>
                {myProfile.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
              </div>
              <p className="truncate text-[10px] text-zinc-500 uppercase tracking-tight w-full">
                {myProfile.status === 'online' ? 'Disponível' : 
                 myProfile.status === 'idle' ? 'Ausente' : 
                 myProfile.status === 'dnd' ? 'Não Perturbe' : 'Invisível'}
              </p>
            </div>
          </UserProfileCard>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Configurações"
          >
            <Settings size={16} />
          </button>
          
          <button onClick={handleSignOut} className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </div>
  </div>

  {/* COLUNA 3: CHAT / SALA DE VOZ (OCUPA TODO O RESTANTE SEM COMPRIMIR O LADO) */}
  <main className="flex-1 min-w-0 h-full bg-[#0e0e11] flex flex-col relative overflow-hidden pt-12 md:pt-0">


































    return (
      <div className="flex flex-1 flex-col overflow-hidden">

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
            <div className="flex h-12 items-center border-b border-white/5 px-4 shadow-sm">
              {activeChannel ? (
                <>
                  <Hash size={20} className="mr-2 text-zinc-500" />
                  <h3 className="text-sm font-bold text-white">{activeChannel.name}</h3>
                </>
              ) : (
                <>
                  <div className="relative mr-2">
                    <UserAvatar 
                      avatarUrl={activeDMFriend?.avatar_url}
                      name={activeDMFriend?.display_name || activeDMFriend?.username}
                      size="h-6 w-6"
                      status={activeDMFriend?.id ? (profilesCache[activeDMFriend.id]?.status || activeDMFriend.status) : activeDMFriend?.status}
                      showStatus={true}
                      className="border border-white/5"
                    />
                  </div>
                  {activeDMFriend && (
                    <UserProfileCard
                      user={activeDMFriend}
                      isMe={activeDMFriend.id === myProfile.id}
                      onEditClick={activeDMFriend.id === myProfile.id ? () => setIsSettingsOpen(true) : undefined}
                    >

                      <div className="flex items-center gap-1.5 min-w-0 cursor-pointer">
                        <h3 className="text-sm font-bold text-white truncate">{activeDMFriend.display_name || activeDMFriend.username}</h3>
                        {activeDMFriend.is_verified && (
                          <BadgeCheck className="w-4 h-4 text-cyan-400 ml-0.5 shrink-0" />
                        )}
                        {activeDMFriend.id === LUME_BOT_ID && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[8px] bg-[#00D1FF]/20 text-[#00D1FF] font-bold rounded uppercase">OFICIAL</span>
                        )}
                      </div>
                    </UserProfileCard>
                  )}
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
                // STATUS DINÂMICO EM TODAS AS MENSAGENS DO CHAT: Use profilesCache for real-time status
                const userId = msg.user_id || msg.sender_id;
                
                // Se message.user_id === user.id, renderize profile.avatar_url e profile.display_name
                const authorProfile = userId === authUser?.id 
                  ? myProfile 
                  : (userId ? (profilesCache[userId] || profile) : profile);
                  
                const currentAuthorStatus = authorProfile?.status || 'offline';

                
                return (
                  <div key={msg.id || index} className="flex gap-4 group">
                    <div className="relative h-fit">
                      <UserProfileCard
                        user={{
                          id: userId || "",
                          username: authorProfile?.username || "usuário",
                          display_name: authorProfile?.display_name,
                          avatar_url: authorProfile?.avatar_url,
                          banner_url: authorProfile?.banner_url,
                          bio: authorProfile?.bio,
                          created_at: authorProfile?.created_at,
                          status: currentAuthorStatus,
                          is_verified: authorProfile?.is_verified || authorProfile?.id === LUME_BOT_ID
                        }}
                        isMe={userId === myProfile.id}
                        onEditClick={userId === myProfile.id ? () => setIsSettingsOpen(true) : undefined}
                        onMessageClick={userId !== myProfile.id ? () => {
                          const friend = friendships.find(f => f.friend_profile?.id === userId)?.friend_profile || authorProfile;
                          if (friend) {
                            setActiveDMFriend(friend as Profile);
                            setActiveChannel(null);
                            setShowVoiceUI(false);
                            markAsRead(userId);
                          }
                        } : undefined}
                      >
                        <UserAvatar 
                          avatarUrl={authorProfile?.avatar_url}
                          name={authorProfile?.display_name || authorProfile?.username}
                          size="h-10 w-10"
                          status={currentAuthorStatus}
                          showStatus={true}
                          className="mt-0.5 border border-white/5 hover:opacity-90 transition-opacity"
                        />
                      </UserProfileCard>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <UserProfileCard
                            user={{
                              id: userId || "",
                              username: authorProfile?.username || "usuário",
                              display_name: authorProfile?.display_name,
                              avatar_url: authorProfile?.avatar_url,
                              banner_url: authorProfile?.banner_url,
                              bio: authorProfile?.bio,
                              created_at: authorProfile?.created_at,
                              status: currentAuthorStatus,
                              is_verified: authorProfile?.is_verified || authorProfile?.id === LUME_BOT_ID
                            }}
                            isMe={userId === myProfile.id}
                            onEditClick={userId === myProfile.id ? () => setIsSettingsOpen(true) : undefined}
                            onMessageClick={userId !== myProfile.id ? () => {
                              const friend = friendships.find(f => f.friend_profile?.id === userId)?.friend_profile || authorProfile;
                              if (friend) {
                                setActiveDMFriend(friend as Profile);
                                setActiveChannel(null);
                                setShowVoiceUI(false);
                                markAsRead(userId);
                              }
                            } : undefined}
                          >
                            <span className="text-sm font-bold hover:underline cursor-pointer text-white truncate">
                              {authorProfile?.display_name || authorProfile?.username || "Membro do Lume"}
                            </span>
                          </UserProfileCard>
                          {authorProfile?.is_verified && (
                            <BadgeCheck className="w-4 h-4 text-cyan-400 ml-0.5 shrink-0" />
                          )}
                          {(authorProfile?.id === LUME_BOT_ID || msg.sender_id === LUME_BOT_ID || msg.user_id === LUME_BOT_ID) && (
                            <span className="shrink-0 px-1.5 py-0.5 text-[8px] bg-[#00D1FF]/20 text-[#00D1FF] font-bold rounded uppercase">OFICIAL</span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {msg.content && <MessageText content={msg.content} />}
                      
                      {msg.file_url && (
                        <div className="mt-2 max-w-sm">
                          {msg.file_type?.startsWith('image/') ? (
                            <PhotoProvider
                              maskOpacity={0.8}
                              loadingElement={<div className="text-[#00D1FF] animate-pulse">Carregando...</div>}
                            >
                              <PhotoView src={msg.file_url}>
                                <img 
                                  src={msg.file_url} 
                                  alt={msg.file_name || "image"} 
                                  className="max-h-80 w-auto rounded-xl border border-zinc-800 cursor-pointer hover:opacity-90 transition-opacity" 
                                />
                              </PhotoView>
                            </PhotoProvider>
                          ) : msg.file_type?.startsWith('video/') ? (
                            <video controls className="max-h-80 rounded-xl border border-zinc-800 w-full bg-black">
                              <source src={msg.file_url} type={msg.file_type} />
                            </video>
                          ) : (
                            <a 
                              href={msg.file_url} 
                              download={msg.file_name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-[#121212] border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors group/file"
                            >
                              <div className="p-2 bg-zinc-900 rounded-lg group-hover/file:bg-zinc-800 transition-colors">
                                <FileText className="w-6 h-6 text-[#00D1FF]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-200 truncate">{msg.file_name || "Arquivo"}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Clique para baixar</p>
                              </div>
                              <Download className="w-4 h-4 text-zinc-500 group-hover/file:text-[#00D1FF]" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {isBotChat ? (
              myProfile?.is_admin ? (
                <div className="p-4 pt-0">
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newMessage.trim()) return;
                      const msg = newMessage;
                      setNewMessage("");
                      try {
                        const { error } = await supabase.rpc('broadcast_system_update', { update_text: msg });
                        if (error) throw error;
                        toast.success("Atualização global enviada!");
                      } catch (err: any) {
                        toast.error("Erro ao enviar broadcast: " + err.message);
                      }
                    }}
                    className="flex items-center gap-2 p-3 bg-[#0a0a0c] border border-cyan-500/50 rounded-xl shadow-[0_0_15px_rgba(0,209,255,0.1)]"
                  >
                    <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 animate-pulse" />
                    <Input 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Modo Admin: Digite o changelog para disparar para todos os usuários..."
                      className="bg-transparent border-none text-white placeholder:text-zinc-600 focus-visible:ring-0 h-9"
                    />
                    <Button type="submit" size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold h-8">
                      DISPARAR
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="p-3.5 mx-4 mb-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center gap-2 text-zinc-400 text-xs font-medium select-none shadow-lg">
                  <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Este é um canal oficial de transmissão somente leitura. Apenas a equipe do Lume publica novidades aqui.</span>
                </div>
              )
            ) : (
            <div className="p-4 pt-0 relative">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-4 mb-4 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)} />
                  <div className="relative">
                    <EmojiPicker 
                      theme={Theme.DARK} 
                      onEmojiClick={(emoji: EmojiClickData) => {
                        setNewMessage(prev => prev + emoji.emoji);
                        setShowEmojiPicker(false);
                      }}
                      lazyLoadEmojis
                    />
                  </div>
                </div>
              )}

              {showGifPicker && (
                <div className="absolute bottom-full left-4 mb-4 z-50 w-80 bg-[#121212] border border-zinc-800 rounded-xl p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                  <div className="fixed inset-0" onClick={() => setShowGifPicker(false)} />
                  <div className="relative flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-2 py-1 bg-[#050505] rounded-lg border border-white/5">
                      <Search size={14} className="text-zinc-500" />
                      <input 
                        className="bg-transparent border-none outline-none text-xs text-white w-full h-8" 
                        placeholder="Buscar GIFs no GIPHY..." 
                        value={gifSearch}
                        onChange={(e) => setGifSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {gifs.length > 0 ? gifs.map(gif => (
                        <button 
                          key={gif.id} 
                          onClick={() => sendGif(gif.images.fixed_height.url)}
                          className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity h-24"
                        >
                          <img src={gif.images.fixed_height.url} className="w-full h-full object-cover" alt="gif" />
                        </button>
                      )) : (
                        <div className="col-span-2 py-8 text-center text-zinc-500 text-xs">
                          {gifSearch ? "Nenhum GIF encontrado" : "Carregando GIFs..."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setAttachmentPreview(URL.createObjectURL(file));
                  }
                }}
                accept="image/*,video/*,.pdf,.zip,.doc,.docx"
              />

              {attachmentPreview && (
                <div className="absolute bottom-full left-4 mb-2 animate-in fade-in slide-in-from-bottom-2 z-10">
                  <div className="relative group bg-zinc-900 border border-zinc-800 rounded-xl p-2 shadow-2xl overflow-hidden">
                    {selectedFile?.type.startsWith('image/') ? (
                      <img src={attachmentPreview} className="max-h-32 rounded-lg object-contain" alt="Preview" />
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-4 text-xs text-zinc-300">
                        <FileText className="w-8 h-8 text-[#00D1FF]" />
                        <span className="truncate max-w-[150px]">{selectedFile?.name}</span>
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        setAttachmentPreview(null);
                        setSelectedFile(null);
                      }}
                      className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 bg-[#121212] rounded-xl px-2 focus-within:ring-1 focus-within:ring-[#00D1FF]/50 transition-all">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                  disabled={isUploading}
                >
                  <Paperclip size={20} className={isUploading ? "animate-pulse text-[#00D1FF]" : ""} />
                </button>
                
                <form onSubmit={handleSendMessage} className="flex-1 flex items-center relative">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                      }
                    }}
                    placeholder={
                      isBotChat

                        ? (myProfile.is_admin ? "Disparar atualização oficial..." : "Canal oficial de transmissão somente leitura")
                        : (activeChannel ? `Conversar em #${activeChannel.name}` : `Conversar com @${activeDMFriend?.username}`)
                    }
                    disabled={isBotChat && !myProfile.is_admin}
                    className="bg-transparent border-none shadow-none focus-visible:ring-0 h-11 text-sm text-white px-0 disabled:opacity-50"

                  />
                  <div className="flex items-center gap-1 pr-1">
                    <button 
                      type="button"
                      onClick={() => setShowGifPicker(!showGifPicker)}
                      className={`p-2 transition-colors ${showGifPicker ? "text-[#00D1FF]" : "text-zinc-500 hover:text-white"}`}
                    >
                      <Film size={20} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 transition-colors ${showEmojiPicker ? "text-[#00D1FF]" : "text-zinc-500 hover:text-white"}`}
                    >
                      <Smile size={20} />
                    </button>
                    <button 
                      type="submit" 
                      className="p-2 text-zinc-500 hover:text-[#00D1FF] transition-colors"
                      disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
            )}
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
                  Disponível {friendships.filter(f => f.status === 'accepted' && f.friend_profile && f.friend_profile.status && ['online', 'idle', 'dnd'].includes(f.friend_profile.status)).length > 0 ? `— ${friendships.filter(f => f.status === 'accepted' && f.friend_profile && f.friend_profile.status && ['online', 'idle', 'dnd'].includes(f.friend_profile.status)).length}` : ''}
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
                    Amigos — {friendships.filter(f => f.status === 'accepted' && (friendFilter === 'all' || (f.friend_profile?.status && ['online', 'idle', 'dnd'].includes(f.friend_profile.status)))).length}
                  </h4>
                  {friendships.filter(f => f.status === 'accepted' && (friendFilter === 'all' || (f.friend_profile?.status && ['online', 'idle', 'dnd'].includes(f.friend_profile.status)))).map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 border-t border-white/5 group hover:bg-white/5 rounded-md transition-colors">
                      <div className="relative">
                        <UserProfileCard
                          user={f.friend_profile!}
                          isMe={false}
                          onMessageClick={() => { setActiveDMFriend(f.friend_profile!); setActiveChannel(null); setShowVoiceUI(false); }}
                        >
                          <Avatar className="h-8 w-8 hover:opacity-90 transition-opacity cursor-pointer">
                            <AvatarImage src={f.friend_profile?.avatar_url || ""} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                              {f.friend_profile?.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </UserProfileCard>
                        <StatusBadge 
                          status={f.friend_profile?.status} 
                          size="sm" 
                          className="absolute bottom-0 right-0 border-2 border-[#050505]" 
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white">{f.friend_profile?.display_name || f.friend_profile?.username}</p>
                          {f.friend_profile?.id === LUME_BOT_ID && (
                            <span className="shrink-0 px-1.5 py-0.5 text-[8px] bg-[#00D1FF]/20 text-[#00D1FF] font-bold rounded uppercase">OFICIAL</span>
                          )}
                        </div>
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
    </main>

    {/* Settings Modal (Estilo Discord) */}
    <SettingsModal 
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />


  </div>
  );
}

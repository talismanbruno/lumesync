import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminVerifiedBadge } from "./AdminVerifiedBadge";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  is_admin?: boolean | null;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  myProfile: Profile;
  friendships: any[];
  onCreateGroup: (memberIds: string[], name?: string | null) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  myProfile,
  friendships,
  onCreateGroup
}) => {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const friends = friendships
    .filter(f => f.status === 'accepted')
    .map(f => f.friend_profile)
    .filter(Boolean) as Profile[];

  const q = searchTerm.toLowerCase();
  const filteredFriends = friends.filter(f =>
    (f.username ?? "").toLowerCase().includes(q) ||
    (f.display_name ?? "").toLowerCase().includes(q)
  );

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleCreateGroup = async () => {
    if (isLoading) return; // Proteção contra múltiplos cliques
    if (selectedFriends.length === 0) {
      toast.error("Selecione pelo menos 1 amigo para criar o grupo!");
      return;
    }

    // Apenas passamos a intenção para o componente pai.
    // O modal não deve realizar operações de banco de dados diretamente
    // para evitar conflitos de lógica e criação duplicada.
    if (onCreateGroup) {
      onCreateGroup([myProfile.id, ...selectedFriends], groupName.trim() || null);
    }
    
    // Limpamos o estado local
    setSelectedFriends([]);
    setGroupName("");
    onClose();
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#121212] border-white/10 text-white sm:max-w-[420px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold">Criar Grupo</DialogTitle>
          <p className="text-xs text-zinc-400">Você pode adicionar amigos para criar um grupo.</p>
        </DialogHeader>

        <div className="px-6 py-2 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Nome do Grupo (Opcional)</label>
            <Input 
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ex: Time Lume"
              className="bg-[#050505] border-white/10 text-sm h-10 focus-visible:ring-[#00D1FF]"
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar amigos..."
              className="bg-[#050505] border-white/10 pl-10 text-sm h-10 focus-visible:ring-[#00D1FF]"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar space-y-1">
            {filteredFriends.length > 0 ? filteredFriends.map(friend => (
              <div 
                key={friend.id}
                onClick={() => toggleFriend(friend.id)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <UserAvatar 
                  avatarUrl={friend.avatar_url}
                  name={friend.display_name || friend.username}
                  size="h-8 w-8"
                  status={friend.status}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                    {friend.display_name || friend.username}
                    <AdminVerifiedBadge isAdmin={friend.is_admin} size={12} />
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">@{friend.username}</p>
                </div>
                <Checkbox 
                  checked={selectedFriends.includes(friend.id)}
                  onCheckedChange={() => toggleFriend(friend.id)}
                  className="border-zinc-700 data-[state=checked]:bg-[#00D1FF] data-[state=checked]:text-black"
                />
              </div>
            )) : (
              <div className="py-8 text-center text-zinc-500 text-sm">Nenhum amigo encontrado</div>
            )}
          </div>
        </div>

        <DialogFooter className="bg-[#18181b]/50 p-4 mt-2">
          <Button 
            onClick={handleCreateGroup}
            disabled={isLoading || selectedFriends.length < 1}
            className="w-full bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold glow-sm border-none"
          >
            {isLoading ? "Criando..." : "Criar Grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

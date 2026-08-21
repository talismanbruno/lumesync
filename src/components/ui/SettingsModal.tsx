import * as React from "react";
import { X, User, Settings, Volume2, Palette, Shield, Sparkles, Image as ImageIcon, Camera, Check, BadgeCheck } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  onProfileUpdate: (updatedProfile: any) => void;
}

export function SettingsModal({ isOpen, onClose, userProfile, onProfileUpdate }: SettingsModalProps) {
  const [activeTab, setActiveTab] = React.useState<'my-account' | 'profile' | 'voice' | 'appearance'>('profile');
  const [editDisplayName, setEditDisplayName] = React.useState(userProfile?.display_name || "");
  const [editBio, setEditBio] = React.useState(userProfile?.bio || "");
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(userProfile?.avatar_url || null);
  const [bannerPreview, setBannerPreview] = React.useState<string | null>(userProfile?.banner_url || null);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 1. Preview Instantâneo (URL Local)
    const localUrl = URL.createObjectURL(file);
    if (type === 'avatar') setAvatarPreview(localUrl);
    if (type === 'banner') setBannerPreview(localUrl);

    // 2. Upload Automático Imediato
    const filePath = `${userProfile.id}/${Date.now()}_${type}`;
    const { error } = await supabase.storage.from('chat-attachments').upload(filePath, file);
    
    if (error) {
      toast.error(`Erro ao subir ${type}`);
      return;
    }
    
    // 3. Pegar URL Pública e Salvar no Banco
    const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
    
    const updateData: any = {};
    updateData[type === 'avatar' ? 'avatar_url' : 'banner_url'] = publicUrl;

    const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', userProfile.id);
    
    if (!updateError) {
      onProfileUpdate({
        ...userProfile,
        [type === 'avatar' ? 'avatar_url' : 'banner_url']: publicUrl
      });
      toast.success(`${type === 'avatar' ? 'Foto' : 'Banner'} atualizado com sucesso!`);
    } else {
      toast.error(`Erro ao salvar ${type} no perfil`);
    }
  };

  const handleSaveInfo = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: editDisplayName,
        bio: editBio
      }).eq('id', userProfile.id);

      if (error) throw error;
      
      onProfileUpdate({
        ...userProfile,
        display_name: editDisplayName,
        bio: editBio
      });
      toast.success("Perfil atualizado!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1000px] h-[80vh] w-[90vw] p-0 overflow-hidden bg-[#121214] border-zinc-800 flex flex-row outline-none">
        {/* Sidebar Esquerda */}
        <aside className="w-60 bg-[#0A0A0C] flex flex-col p-4 border-r border-white/5">
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Configurações do Usuário</h3>
              <div className="space-y-0.5">
                <button 
                  onClick={() => setActiveTab('my-account')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${activeTab === 'my-account' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                  <User size={16} />
                  Minha Conta
                </button>
                <button 
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${activeTab === 'profile' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                  <Sparkles size={16} />
                  Perfil
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Configurações do App</h3>
              <div className="space-y-0.5">
                <button 
                  onClick={() => setActiveTab('voice')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${activeTab === 'voice' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                  <Volume2 size={16} />
                  Voz e Vídeo
                </button>
                <button 
                  onClick={() => setActiveTab('appearance')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${activeTab === 'appearance' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                  <Palette size={16} />
                  Aparência
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Área Principal Direita */}
        <main className="flex-1 bg-[#121214] flex flex-col overflow-hidden relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all z-50"
          >
            <X size={20} />
          </button>

          <div className="flex-1 overflow-y-auto p-10">
            {activeTab === 'profile' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Perfil do Usuário</h2>
                  <p className="text-zinc-400 text-sm">Personalize sua aparência global no Lume.</p>
                </div>

                {/* Preview da Carta */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Preview do Perfil</h3>
                  <div className="relative w-full rounded-2xl bg-[#121214] border border-zinc-800 overflow-hidden mt-4 max-w-[340px]">
                    {/* Banner (Altura fixa de 120px) */}
                    <div className="h-[120px] w-full bg-zinc-900">
                      {bannerPreview ? (
                        <img src={bannerPreview} className="w-full h-full object-cover" alt="Banner" />
                      ) : (
                        <div className="w-full h-full bg-[#00D1FF]/10" />
                      )}
                    </div>
                    
                    {/* Informações com padding top generoso para o Avatar não engolir o texto */}
                    <div className="px-5 pb-5 pt-12 relative">
                      {/* Avatar posicionado metade dentro, metade fora do banner */}
                      <div className="absolute -top-10 left-5 w-20 h-20 rounded-full border-4 border-[#121214] bg-zinc-800 overflow-hidden">
                        {avatarPreview ? (
                          <img src={avatarPreview} className="w-full h-full object-cover" alt="Avatar" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-zinc-900">
                            <User size={32} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 mt-1">
                        <h3 className="font-bold text-white text-lg">{editDisplayName || userProfile?.username || 'Seu Nome'}</h3>
                        {userProfile?.is_verified && <BadgeCheck className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <div className="text-sm text-zinc-400 mt-1 line-clamp-3 min-h-[1.25rem]">
                        {editBio || "Este usuário não possui bio."}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Controles de Upload */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Foto de Perfil</h3>
                    <Button variant="secondary" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white gap-2" asChild>
                      <label>
                        <Camera size={16} />
                        Mudar Avatar
                        <input type="file" hidden accept="image/*,.gif" onChange={(e) => handleFileChange(e, 'avatar')} />
                      </label>
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Banner do Perfil</h3>
                    <Button variant="secondary" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white gap-2" asChild>
                      <label>
                        <ImageIcon size={16} />
                        Mudar Banner
                        <input type="file" hidden accept="image/*,.gif" onChange={(e) => handleFileChange(e, 'banner')} />
                      </label>
                    </Button>
                  </div>
                </div>

                {/* Campos de Texto */}
                <div className="space-y-6 pt-4 border-t border-white/5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Nome de Exibição</label>
                    <Input 
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="Como você quer ser chamado?"
                      className="bg-[#050505] border-white/5 focus:border-[#00D1FF]/50 text-white h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Sobre Mim (Bio)</label>
                    <textarea 
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Conte um pouco sobre você..."
                      className="w-full bg-[#050505] border border-white/5 focus:border-[#00D1FF]/50 text-white rounded-md p-3 text-sm min-h-[100px] outline-none transition-colors resize-none"
                    />
                  </div>

                  <Button 
                    onClick={handleSaveInfo}
                    disabled={isSaving}
                    className="bg-[#00D1FF] text-black hover:bg-[#00D1FF]/90 font-bold px-8 glow-sm h-11"
                  >
                    {isSaving ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'my-account' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Minha Conta</h2>
                  <p className="text-zinc-400 text-sm">Gerencie suas informações de segurança.</p>
                </div>
                <div className="bg-[#0A0A0C] border border-zinc-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">E-mail</p>
                      <p className="text-white">{userProfile?.email || "..."}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'voice' || activeTab === 'appearance') && (
              <div className="max-w-2xl h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 opacity-50">
                <Settings size={48} className="text-zinc-700 animate-spin-slow" />
                <div className="text-center">
                  <h3 className="text-white font-bold">Em Breve</h3>
                  <p className="text-zinc-500 text-sm">Esta seção das configurações está sendo aprimorada.</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </DialogContent>
    </Dialog>
  );
}

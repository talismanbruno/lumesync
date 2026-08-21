import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, ImageIcon, User, BadgeCheck } from 'lucide-react';

// Função utilitária para converter arquivo para Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const ProfileSettingsTab = () => {
  const { user, profile, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarData, setAvatarData] = useState('');
  const [bannerData, setBannerData] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Carrega os dados reais do perfil
  useEffect(() => {
    if (profile) {
      setName(profile.display_name || profile.username || '');
      setBio(profile.bio || '');
      setAvatarData(profile.avatar_url || '');
      setBannerData(profile.banner_url || '');
    }
  }, [profile]);

  // Captura do Avatar
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setAvatarData(base64); // Exibe o preview na hora
      } catch (err) {
        toast.error("Erro ao processar imagem");
      }
    }
  };

  // Captura do Banner
  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setBannerData(base64); // Exibe o preview na hora
      } catch (err) {
        toast.error("Erro ao processar banner");
      }
    }
  };

  // Salvar tudo no Supabase
  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: name.trim() || profile?.username,
          bio: bio.trim(),
          avatar_url: avatarData,
          banner_url: bannerData
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // We use updateProfile from context to update global state
        await updateProfile(data);
      }
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast.error(err.message || "Erro ao salvar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Perfil do Usuário</h2>
        <p className="text-zinc-400 text-sm">Personalize sua aparência global no Lume.</p>
      </div>

      {/* Inputs Escondidos */}
      <input 
        type="file" 
        ref={avatarInputRef} 
        onChange={handleAvatarSelect} 
        accept="image/*,.gif" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={bannerInputRef} 
        onChange={handleBannerSelect} 
        accept="image/*,.gif" 
        className="hidden" 
      />

      {/* Card de Preview */}
      <div className="relative w-full rounded-2xl bg-[#121214] border border-zinc-800 overflow-hidden mt-4 max-w-[340px]">
        {/* Banner */}
        <div className="h-[120px] w-full bg-zinc-900">
          {bannerData ? (
            <img src={bannerData} className="w-full h-full object-cover" alt="Banner" />
          ) : (
            <div className="w-full h-full bg-[#00D1FF]/10" />
          )}
        </div>

        {/* Informações com Avatar sobreposto */}
        <div className="px-5 pb-5 pt-12 relative">
          <div className="absolute -top-10 left-5 w-20 h-20 rounded-full border-4 border-[#121214] bg-zinc-800 overflow-hidden">
            {avatarData ? (
              <img src={avatarData} className="w-full h-full object-cover" alt="Avatar" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-zinc-900">
                <span className="text-2xl font-bold">
                  {name ? name.slice(0, 2).toUpperCase() : 'LM'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 mt-1">
            <h3 className="font-bold text-white text-lg">{name || 'Usuário'}</h3>
            {profile?.is_verified && <BadgeCheck className="w-4 h-4 text-cyan-400" />}
          </div>
          <p className="text-sm text-zinc-400 mt-1 line-clamp-3 min-h-[1.25rem]">
            {bio || 'Este usuário não possui bio.'}
          </p>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
        >
          <Camera size={16} />
          Mudar Avatar
        </button>
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
        >
          <ImageIcon size={16} />
          Mudar Banner
        </button>
      </div>

      {/* Campos de Nome e Bio */}
      <div className="space-y-6 pt-4 border-t border-white/5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Nome de Exibição</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Sobre Mim (Bio)</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Botão Salvar */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(0,209,255,0.4)] transition-all cursor-pointer"
      >
        {isSaving ? "Salvando..." : "Salvar Alterações"}
      </button>
    </div>
  );
};

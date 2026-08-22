import * as React from "react";
import { X, User, Settings, Volume2, Palette, Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { ProfileSettingsTab } from "./ProfileSettingsTab";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: any;
  onProfileUpdate?: (updatedProfile: any) => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'my-account' | 'profile' | 'voice' | 'appearance'>('profile');

  // Adiciona suporte a tecla Escape como fallback, embora o Dialog já suporte
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1000px] h-[80vh] w-[90vw] p-0 overflow-hidden bg-[#121214] border-zinc-800 flex flex-row outline-none shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* Sidebar Esquerda */}
        <aside className="w-60 bg-[#0A0A0C] flex flex-col p-4 border-r border-white/5 shrink-0">
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
          {/* Botão de Fechar Único e Acessível */}
          <DialogClose 
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full border border-zinc-800 bg-[#0A0A0C] text-zinc-400 hover:text-white hover:border-zinc-700 transition-all z-50 group cursor-pointer"
            aria-label="Fechar configurações"
          >
            <X size={20} className="group-hover:scale-110 transition-transform" />
          </DialogClose>

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            {activeTab === 'profile' && (
              <ProfileSettingsTab />
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
                      <p className="text-white">{user?.email || "..."}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <Button 
                      onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = '/auth';
                      }}
                      className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all w-full flex items-center justify-center gap-2"
                    >
                      <LogOut size={16} />
                      Sair da Conta
                    </Button>
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

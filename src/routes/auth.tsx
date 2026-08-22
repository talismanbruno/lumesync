import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LumeLogo } from "@/components/ui/LumeLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export const Route = createFileRoute("/auth")({
  component: () => {
    const { profile, user, isAuthChecking } = useAuth();
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
      if (!isAuthChecking && user && profile?.username) {
        navigate({ to: "/", replace: true });
      }
    }, [user, profile, navigate, isAuthChecking]);

    const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isLoading) return;
      setIsLoading(true);
      try {
        if (isLogin) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          
          if (data.session) {
            toast.success("Bem-vindo de volta!");
            navigate({ to: "/", replace: true });
          }
        } else {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          toast.success("Cadastro realizado! Verifique seu e-mail.");
        }
      } catch (error: any) {
        toast.error(error.message || "Erro na autenticação");
        setIsLoading(false);
      }
    };

    if (isAuthChecking) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <LumeLogo variant="icon" className="h-16 w-16 animate-pulse opacity-50" />
            <p className="text-cyan-500/50 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">Sincronizando Lume...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center space-y-4">
            <LumeLogo variant="full" className="h-12 w-auto mb-2" />
            <p className="text-zinc-500 text-sm font-medium tracking-wide">Comunicação minimalista em tempo real.</p>
          </div>

          <div className="bg-[#121212] border border-white/5 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">E-mail</label>
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-cyan-500/50 transition-all placeholder:text-zinc-700" 
                    placeholder="exemplo@lume.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Senha</label>
                  <Input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-cyan-500/50 transition-all placeholder:text-zinc-700"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-cyan-500 text-black hover:bg-cyan-400 font-bold h-12 rounded-xl transition-all shadow-[0_0_20px_rgba(0,209,255,0.15)] hover:shadow-[0_0_25px_rgba(0,209,255,0.3)] disabled:opacity-50"
              >
                {isLoading ? "Entrando..." : (isLogin ? "Entrar" : "Criar Conta")}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-zinc-500 text-xs hover:text-cyan-400 transition-colors font-medium"
              >
                {isLogin ? "Não tem uma conta? Registre-se" : "Já tem uma conta? Entre"}
              </button>
            </div>
          </div>
          
          <div className="text-center opacity-20 hover:opacity-100 transition-opacity duration-1000">
             <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] pointer-events-none">LUME ETHERNET • 2026</p>
          </div>
        </div>
      </div>
    );
  }
});

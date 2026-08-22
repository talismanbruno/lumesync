import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LumeLogo } from "@/components/ui/LumeLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowRight, UserPlus, LogIn, RefreshCcw, ArrowLeft } from "lucide-react";

type AuthState = "idle" | "submitting" | "awaiting_email_confirmation" | "error";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { profile, user, isAuthChecking } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!isAuthChecking && user && profile?.username) {
      navigate({ to: "/", replace: true });
    }
  }, [user, profile, navigate, isAuthChecking]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authState === "submitting") return;
    
    setAuthState("submitting");
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (data.session) {
          toast.success("Bem-vindo de volta!");
          navigate({ to: "/", replace: true });
        } else {
          // This happens if email confirmation is required even for login
          setAuthState("awaiting_email_confirmation");
        }
      } else {
        const redirectTo = window.location.origin + "/auth/callback";
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              username: email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6)
            }
          }
        });

        if (error) throw error;

        // Diagnostic log (safe)
        console.log("[Lume Auth] SignUp response:", { 
          hasUser: !!data.user, 
          hasSession: !!data.session,
          identities: data.user?.identities?.length
        });

        if (data.session) {
          toast.success("Conta criada e logada!");
          navigate({ to: "/", replace: true });
        } else if (data.user) {
          setAuthState("awaiting_email_confirmation");
          toast.info("Verifique seu e-mail para confirmar a conta.");
        } else {
          throw new Error("Resposta inesperada do servidor.");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Erro na autenticação");
      setAuthState("idle");
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: window.location.origin + "/auth/callback"
        }
      });
      if (error) throw error;
      toast.success("E-mail de confirmação reenviado!");
      setResendCooldown(60);
    } catch (error: any) {
      toast.error(error.message || "Erro ao reenviar e-mail");
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

  // Awaiting confirmation screen
  if (authState === "awaiting_email_confirmation") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center space-y-6">
            <div className="h-20 w-20 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_30px_rgba(0,209,255,0.1)]">
              <Mail className="h-10 w-10 text-cyan-400" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Verifique seu e-mail</h1>
              <p className="text-zinc-500 text-sm max-w-[280px] mx-auto">
                Enviamos um link de confirmação para <span className="text-zinc-300 font-medium">{email.replace(/(.{2})(.*)(?=@)/, "$1***")}</span>
              </p>
            </div>
          </div>

          <div className="bg-[#121212] border border-white/5 p-8 rounded-3xl shadow-2xl space-y-6">
            <p className="text-zinc-400 text-xs text-center leading-relaxed">
              Clique no link presente no e-mail para ativar sua conta e acessar o LUME.
            </p>
            
            <Button 
              onClick={handleResendEmail}
              disabled={resendCooldown > 0}
              variant="outline"
              className="w-full border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold h-12 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCcw className={`h-4 w-4 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
              {resendCooldown > 0 ? `Aguarde ${resendCooldown}s` : "Reenviar e-mail"}
            </Button>

            <div className="space-y-3 pt-2">
              <button 
                onClick={() => setAuthState("idle")}
                className="w-full text-zinc-500 text-xs hover:text-cyan-400 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-3 w-3" />
                Usar outro e-mail
              </button>
              <button 
                onClick={() => {
                  setAuthState("idle");
                  setIsLogin(true);
                }}
                className="w-full text-cyan-500/70 text-xs hover:text-cyan-400 transition-colors font-bold uppercase tracking-widest pt-2"
              >
                Voltar para entrar
              </button>
            </div>
          </div>
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
                <div className="relative">
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-cyan-500/50 transition-all placeholder:text-zinc-700 pl-10" 
                    placeholder="exemplo@lume.com"
                    required
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                </div>
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
                  minLength={8}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={authState === "submitting"}
              className="w-full bg-cyan-500 text-black hover:bg-cyan-400 font-bold h-12 rounded-xl transition-all shadow-[0_0_20px_rgba(0,209,255,0.15)] hover:shadow-[0_0_25px_rgba(0,209,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {authState === "submitting" ? (
                <>
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  {isLogin ? "Entrando..." : "Criando conta..."}
                </>
              ) : (
                <>
                  {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {isLogin ? "Entrar" : "Criar Conta"}
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setAuthState("idle");
              }}
              className="text-zinc-500 text-xs hover:text-cyan-400 transition-colors font-medium flex items-center justify-center gap-2 mx-auto"
            >
              {isLogin ? "Não tem uma conta? Registre-se" : "Já tem uma conta? Entre"}
              <ArrowRight className="h-3 w-3" />
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

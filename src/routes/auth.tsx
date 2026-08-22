import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LumeLogo } from "@/components/ui/LumeLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowRight, UserPlus, LogIn, RefreshCcw, ArrowLeft, Phone, Sparkles, Download, Eye, EyeOff } from "lucide-react";

type AuthState = "idle" | "submitting" | "awaiting_email_confirmation" | "error";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Lume | Autenticação" },
      { name: "description", content: "Lume" },
      { property: "og:title", content: "Lume" },
      { property: "og:description", content: "Lume" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { profile, user, isAuthChecking } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (isAuthChecking) return;

    if (user && profile?.username) {
      navigate({ to: "/", replace: true });
    }
  }, [user, profile, navigate, isAuthChecking]);

  const validateUsername = (val: string) => {
    let normalized = val.replace(/^@/, "").toLowerCase();
    normalized = normalized.replace(/[^a-z0-9_]/g, "");
    setUsername(normalized);

    if (normalized.length > 0 && normalized.length < 3) {
      setUsernameError("Mínimo 3 caracteres");
    } else if (normalized.length > 20) {
      setUsernameError("Máximo 20 caracteres");
    } else {
      setUsernameError("");
    }
  };

  useEffect(() => {
    let timeoutId: any;
    if (username.length >= 3 && !isLogin) {
      timeoutId = setTimeout(async () => {
        setIsCheckingUsername(true);
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("username")
            .eq("username", username)
            .maybeSingle();
          
          if (data) {
            setUsernameError("Este username já está em uso");
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsCheckingUsername(false);
        }
      }, 500);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [username, isLogin]);

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
              username: username.toLowerCase().trim(),
              display_name: email.split('@')[0]
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
    return undefined; // Garante retorno explícito
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

  if (isAuthChecking || (user && !profile?.username)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/10 rounded-full animate-[spin_60s_linear_infinite] motion-reduce:animate-none" />
        </div>
        <div className="flex flex-col items-center space-y-6 z-10 animate-in fade-in duration-700">
          <LumeLogo variant="icon" className="h-20 w-20 animate-pulse opacity-80 shadow-[0_0_40px_rgba(0,209,255,0.2)]" />
          <div className="flex flex-col items-center space-y-2">
            <p className="text-cyan-400 text-xs font-bold uppercase tracking-[0.4em] animate-pulse">
              {user ? "Redirecionando..." : "Sincronizando sua sessão..."}
            </p>
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i} 
                  className="w-1 h-1 rounded-full bg-cyan-500/40 animate-bounce motion-reduce:animate-none" 
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Awaiting confirmation screen
  if (authState === "awaiting_email_confirmation") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
        {/* Orbital Light Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/10 rounded-full animate-[spin_60s_linear_infinite]" />
        </div>

        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in-95 duration-500 z-10">
          <div className="flex flex-col items-center space-y-6">
            <div className="h-20 w-20 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_30px_rgba(0,209,255,0.2)] animate-pulse">
              <Mail className="h-10 w-10 text-cyan-400" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Verifique seu e-mail</h1>
              <p className="text-zinc-500 text-sm max-w-[280px] mx-auto">
                Enviamos um link de confirmação para <span className="text-zinc-300 font-medium">{email.replace(/(.{2})(.*)(?=@)/, "$1***")}</span>
              </p>
            </div>
          </div>

          <div className="bg-[#121212] border border-white/5 p-8 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
            
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
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      {/* Orbital Light Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/10 rounded-full animate-[spin_60s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-cyan-500/5 rounded-full animate-[spin_40s_linear_infinite_reverse]" />
      </div>

      <div className={`w-full ${isLogin ? 'max-w-[400px]' : 'max-w-[900px]'} transition-all duration-500 z-10`}>
        {isLogin ? (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
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
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-cyan-500/50 transition-all placeholder:text-zinc-700 pr-10"
                        placeholder="••••••••"
                        required
                        minLength={8}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-cyan-400 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <button 
                  onClick={() => {
                    setIsLogin(false);
                    setAuthState("idle");
                  }}
                  className="text-zinc-500 text-xs hover:text-cyan-400 transition-colors font-medium flex items-center justify-center gap-2 mx-auto"
                >
                  Não tem uma conta? Registre-se
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            
            <div className="text-center opacity-20 hover:opacity-100 transition-opacity duration-1000">
               <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] pointer-events-none">LUME ETHERNET • 2026</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row bg-[#121212] border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Left Side: Presentation */}
            <div className="lg:w-1/2 p-12 lg:p-16 flex flex-col justify-between relative bg-black/20 border-r border-white/5 overflow-hidden">
              {/* Internal Orbital Effect */}
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative z-10 space-y-8">
                <LumeLogo variant="full" className="h-10 w-auto" />
                
                <div className="space-y-4">
                  <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                    Seu espaço.<br />
                    <span className="text-cyan-400">Sua comunidade.</span>
                  </h1>
                  <p className="text-zinc-400 text-lg max-w-[320px]">
                    Converse, jogue e compartilhe momentos em tempo real.
                  </p>
                </div>

                <div className="space-y-4 pt-4">
                  {[
                    { icon: Phone, text: "Chamadas e compartilhamento de tela" },
                    { icon: Sparkles, text: "Personalização com GIFs" },
                    { icon: Download, text: "Anexos de até 50 MB" }
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 text-zinc-300">
                      <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                        <benefit.icon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <span className="text-sm font-medium">{benefit.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-10 pt-12">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">LUME ETHERNET • 2026</p>
              </div>
            </div>

            {/* Right Side: Register Form */}
            <div className="lg:w-1/2 p-12 lg:p-16 space-y-8 bg-black/10">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Crie sua conta</h2>
                <p className="text-zinc-500 text-sm">Comece sua jornada no LUME hoje mesmo.</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Nome de usuário</label>
                      <div className="relative">
                        <Input 
                          type="text" 
                          value={username}
                          onChange={(e) => validateUsername(e.target.value)}
                          className={`bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-cyan-500/50 transition-all placeholder:text-zinc-700 pl-10 ${usernameError ? 'border-red-500/50' : ''}`} 
                          placeholder="seu_username"
                          required
                          minLength={3}
                          maxLength={20}
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 text-sm font-bold">@</span>
                        {isCheckingUsername && (
                          <RefreshCcw className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3 w-3 text-cyan-500/50 animate-spin" />
                        )}
                      </div>
                      {usernameError ? (
                        <p className="text-[9px] text-red-400 px-1 font-medium">{usernameError}</p>
                      ) : username.length >= 3 && !isCheckingUsername ? (
                        <p className="text-[9px] text-cyan-500/50 px-1 font-medium italic">Seu identificador será @{username}</p>
                      ) : null}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">E-mail</label>
                    <div className="relative">
                      <Input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-cyan-500/50 transition-all placeholder:text-zinc-700 pl-10" 
                        placeholder="seu@email.com"
                        required
                      />
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Senha</label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-black/40 border-white/5 text-white h-12 rounded-xl focus:border-cyan-500/50 transition-all placeholder:text-zinc-700 pr-10"
                        placeholder="No mínimo 8 caracteres"
                        required
                        minLength={8}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-cyan-400 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-zinc-600 px-1 pt-1 italic">
                      Use letras, números e símbolos para maior segurança.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button 
                    type="submit" 
                    disabled={authState === "submitting" || (!isLogin && (!!usernameError || username.length < 3 || isCheckingUsername))}
                    className="w-full bg-cyan-500 text-black hover:bg-cyan-400 font-bold h-12 rounded-xl transition-all shadow-[0_0_20px_rgba(0,209,255,0.15)] hover:shadow-[0_0_25px_rgba(0,209,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {authState === "submitting" ? (
                      <>
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Criar conta
                      </>
                    )}
                  </Button>

                  <button 
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setAuthState("idle");
                    }}
                    className="w-full text-zinc-500 text-xs hover:text-cyan-400 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    Já tem uma conta? Entrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

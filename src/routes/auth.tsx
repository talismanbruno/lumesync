import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check, Circle } from "lucide-react";
import { LumeLogo } from "@/components/ui/LumeLogo";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthComponent,
});

function AuthComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);

  const passwordRequirements = [
    { label: "Mínimo de 8 caracteres", test: (pw: string) => pw.length >= 8 },
    { label: "Pelo menos 1 letra minúscula (a-z)", test: (pw: string) => /[a-z]/.test(pw) },
    { label: "Pelo menos 1 letra maiúscula (A-Z)", test: (pw: string) => /[A-Z]/.test(pw) },
    { label: "Pelo menos 1 número (0-9)", test: (pw: string) => /[0-9]/.test(pw) },
    { label: "Pelo menos 1 caractere especial (!@#$%^&*...)", test: (pw: string) => /[^a-zA-Z0-9]/.test(pw) },
  ];

  const allRequirementsMet = passwordRequirements.every(req => req.test(password));

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso! Verifique seu e-mail se necessário.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      }
    } catch (error: any) {
      if (error.message?.toLowerCase().includes("weak") || error.message?.toLowerCase().includes("common")) {
        toast.error("Esta senha é muito comum. Tente combinar palavras diferentes.");
      } else {
        toast.error(error.message || "Erro ao autenticar. Verifique suas credenciais.");
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center flex flex-col items-center">
          <LumeLogo size="lg" className="mb-4" />
          <h1 className="text-4xl font-bold tracking-tighter text-[#00D1FF] glow-sm inline-block px-2">
            LUME
          </h1>
          <p className="mt-2 text-muted-foreground">Plataforma de comunicação minimalista</p>
        </div>

        <div className="rounded-xl border border-border bg-[#121212] p-6 shadow-2xl">
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 text-foreground border-border/50 focus:border-[#00D1FF]/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                required
                className="bg-background/50 text-foreground border-border/50 focus:border-[#00D1FF]/50 transition-colors"
              />
              {isSignUp && (password.length > 0 || passwordFocus) && (
                <div className="mt-2 space-y-2 rounded-lg border border-border/50 bg-[#121212] p-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  {passwordRequirements.map((req, i) => {
                    const met = req.test(password);
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                          met ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {met ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Circle className="h-3 w-3 opacity-20" />
                        )}
                        <span>{req.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              className={`w-full font-semibold transition-all duration-300 ${
                isSignUp && !allRequirementsMet 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                  : "bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-black glow-sm"
              }`}
              disabled={loading || (isSignUp && !allRequirementsMet)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Criar Conta" : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-[#00D1FF] hover:underline transition-all"
            >
              {isSignUp ? "Já tem uma conta? Entre aqui" : "Não tem uma conta? Crie uma agora"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
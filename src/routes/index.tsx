import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/" as any)({
  component: Index,
});

function Index() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#050505] text-white p-8">
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="flex justify-center mb-12">
          <img src="https://i.ibb.co/C3h465Sr/image.png" alt="LUME" className="h-16 w-auto" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tighter text-white glow-sm">
            Comunicação <span className="text-[#00D1FF]">Minimalista</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            A plataforma de comunicação ultra-veloz, clean e premium para times e comunidades.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <a 
            href="/auth" 
            className="px-8 py-3 bg-[#00D1FF] text-black font-bold rounded-xl hover:bg-[#00D1FF]/90 transition-all shadow-[0_0_20px_rgba(0,209,255,0.3)] hover:scale-105 active:scale-95"
          >
            Entrar no Lume
          </a>
          <a 
            href="/auth" 
            className="px-8 py-3 bg-[#121212] text-white font-bold rounded-xl border border-white/5 hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95"
          >
            Criar Conta
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
          <div className="p-6 rounded-2xl bg-[#121212] border border-white/5 space-y-3 text-left">
            <div className="text-[#00D1FF]">⚡</div>
            <h3 className="font-bold text-white">Ultra-veloz</h3>
            <p className="text-xs text-zinc-500">Performance otimizada para respostas instantâneas.</p>
          </div>
          <div className="p-6 rounded-2xl bg-[#121212] border border-white/5 space-y-3 text-left">
            <div className="text-[#00D1FF]">💎</div>
            <h3 className="font-bold text-white">Design Premium</h3>
            <p className="text-xs text-zinc-500">Interface minimalista focada no que importa.</p>
          </div>
          <div className="p-6 rounded-2xl bg-[#121212] border border-white/5 space-y-3 text-left">
            <div className="text-[#00D1FF]">🔒</div>
            <h3 className="font-bold text-white">Segurança</h3>
            <p className="text-xs text-zinc-500">Criptografia e controle total sobre seus dados.</p>
          </div>
        </div>
        
        <div className="pt-16 border-t border-white/5 flex justify-center">
          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.2em]">Lume System v1.0 — 2026</p>
        </div>
      </div>
    </div>
  );
}

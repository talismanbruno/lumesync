import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-4xl mx-auto space-y-12">
        <section className="space-y-6">
          <h1 className="text-2xl font-bold tracking-tighter text-cyan-400">
            DESIGN DE INTERFACE EXCLUSIVO: SISTEMA DE CHAMADA DE VOZ E TELA "LUME ORBITAL"
          </h1>
          
          <p className="text-zinc-400 leading-relaxed">
            Vamos criar uma interface de chamada de voz e vídeo para DMs e Grupos com a identidade visual única do LUME (Dark Glassmorphism + Glow Ciano), sem copiar o layout genérico de outros apps.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-white">1. PALCO DE CHAMADA ATIVA (LumeVoiceStage.tsx):</h2>
          <p className="text-zinc-500 text-sm">Quando uma chamada estiver conectada no topo da DM ou no grupo:</p>
          <p className="text-zinc-500 text-sm">Renderize um Stage Flutuante com Glassmorphism no topo da área central:</p>
          
          <div className="bg-[#121212] rounded-xl border border-zinc-800 p-4 font-mono text-xs overflow-x-auto text-cyan-300/80">
            <pre>{`<div className="mx-4 my-3 p-6 rounded-3xl bg-[#0e0e11]/80 backdrop-blur-xl border border-cyan-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)] relative overflow-hidden transition-all">
  {/* Arco de luz sutil no fundo */}
  <div className="absolute inset-x-0 -top-24 h-40 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />
  
  {/* Grade de Nós/Participantes */}
  <div className="flex items-center justify-center gap-8 relative z-10">
    {participants.map((p) => (
      <div key={p.id} className="flex flex-col items-center gap-2 group">
        {/* Avatar com Aura de Voz */}
        <div className={\`relative w-20 h-20 rounded-2xl overflow-hidden transition-all duration-300 \${
          p.isSpeaking 
            ? 'ring-2 ring-[#00D1FF] shadow-[0_0_25px_rgba(0,209,255,0.7)] scale-105' 
            : 'ring-1 ring-zinc-800'
        }\`}>
          <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" />
          {p.isMuted && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
              <MicOff className="w-5 h-5 text-red-400" />
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-zinc-300 group-hover:text-white tracking-wide">{p.display_name}</span>
      </div>
    ))}
  </div>

  {/* Cápsula Flutuante de Controles (Lume Dock) */}
  <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-zinc-800/60">
    <button onClick={toggleMic} className={\`p-3 rounded-2xl transition-all \${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-cyan-400 border border-zinc-800'}\`}>
      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
    
    <button onClick={toggleDeafen} className={\`p-3 rounded-2xl transition-all \${isDeafened ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-cyan-400 border border-zinc-800'}\`}>
      <Headphones className="w-4 h-4" />
    </button>

    <button onClick={handleShareScreen} className="p-3 rounded-2xl bg-zinc-900 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-400 text-zinc-200 border border-zinc-800 transition-all">
      <Monitor className="w-4 h-4" />
    </button>

    <button onClick={handleLeaveCall} className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all">
      Desconectar
    </button>
  </div>
</div>`}</pre>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">2. BANNER DE CONVITE ("FREQUÊNCIA ABERTA"):</h2>
          <p className="text-zinc-400">Quando houver chamada ativa na DM e o usuário local não estiver nela:</p>
          <p className="text-zinc-400">Exiba um card translúcido com o título: <span className="text-white">"Chamada Recebida"</span> e o botão luminoso em Ciano: <span className="text-cyan-400 font-bold">"Conectar"</span>.</p>
        </section>

        <section className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 space-y-4">
          <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-widest">Validação Obrigatória</h2>
          <ul className="space-y-3 text-sm text-zinc-300 list-disc pl-5">
            <li>Inicie a chamada em uma DM: o Stage translúcido com o arco de luz e os avatares em formato de squircle (cantos arredondados de 24px) DEVE abrir no topo.</li>
            <li>Ao falar no microfone, confirme que a aura ciano com glow luminoso pulsa ao redor do seu avatar.</li>
            <li>Na conta que recebe a chamada, confirme que o convite de "Chamada Recebida" aparece para entrar com 1 clique.</li>
          </ul>
        </section>

        <footer className="pt-8 border-t border-zinc-900">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
            IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.
          </p>
        </footer>
      </div>
    </div>
  )
});

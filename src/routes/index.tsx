import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="flex flex-col h-screen w-screen bg-[#050505] text-zinc-100 overflow-hidden font-sans select-none p-10 overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">REDESIGN COMPLETO: LAYOUT "HORIZONTAL HORIZON" (ELIMINAR PADRÃO DISCORD E DUPLICAÇÕES)</h1>
      <p className="mb-4 text-zinc-400">Remova a coluna vertical duplicada de servidores da esquerda. Vamos mudar a arquitetura para navegação horizontal superior com foco em tela ampla (Widescreen).</p>
      
      <h2 className="text-xl font-semibold mb-2">1. ESTRUTURA DO LAYOUT BASE (src/routes/_authenticated.tsx):</h2>
      <p className="mb-2">Substitua o layout principal pela estrutura abaixo:</p>
      
      <pre className="bg-zinc-900 p-4 rounded-xl border border-white/5 overflow-x-auto text-xs mb-6">
{`
<div className="flex flex-col h-screen w-screen bg-[#050505] text-zinc-100 overflow-hidden font-sans select-none">
  
  {/* 1. BARRA SUPERIOR HORIZONTAL (TOP NAVIGATION BAR - 60px) */}
  <header className="h-16 px-6 bg-[#0a0a0d] border-b border-white/5 flex items-center justify-between shrink-0 z-40">
    
    {/* Logo Oficial Lume à Esquerda */}
    <div className="flex items-center gap-3">
      <img src="https://i.ibb.co/C3h465Sr/image.png" alt="Lume" className="h-7 w-auto object-contain" />
    </div>

    {/* Seletor Horizontal de Servidores e Home (Cápsulas Centrais) */}
    <div className="flex items-center gap-2 overflow-x-auto max-w-[60%] py-1 scrollbar-none">
      {/* Botão Home / Mensagens Diretas */}
      <button
        onClick={handleGoHome}
        className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all \${
          selectedServerId === null 
            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,209,255,0.2)]' 
            : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
        }\`}
      >
        <span>🏠 Mensagens Diretas</span>
      </button>

      {/* Lista Horizontal de Servidores */}
      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => handleSelectServer(server.id)}
          onContextMenu={(e) => handleServerContextMenu(e, server)}
          className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 \${
            selectedServerId === server.id 
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,209,255,0.2)]' 
              : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
          }\`}
        >
          <span className="w-2 h-2 rounded-full bg-zinc-600 group-hover:bg-cyan-400" />
          <span>{server.name}</span>
        </button>
      ))}

      {/* Botão + Criar Servidor */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="p-2 rounded-xl bg-zinc-900/40 hover:bg-cyan-500/10 hover:text-cyan-400 border border-dashed border-zinc-700 hover:border-cyan-500/40 text-zinc-400 transition-all shrink-0"
        title="Criar Servidor"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>

    {/* Perfil do Usuário e Configurações à Direita */}
    <div className="flex items-center gap-3">
      {/* Widget de Perfil com Avatar e Status */}
      <div 
        onClick={() => setIsStatusDropdownOpen(true)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-zinc-700 transition-all cursor-pointer"
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800">
          <img src={profile?.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          <StatusBadge status={profile?.status || 'online'} />
        </div>
        <span className="text-xs font-semibold text-white">{profile?.display_name || 'Usuário'}</span>
        {profile?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-cyan-400" />}
      </div>

      {/* Botão de Configurações ⚙️ */}
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="p-2 rounded-xl bg-zinc-900/60 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  </header>

  {/* 2. CORPO PRINCIPAL (2 COLUNAS: CANAIS/DMS + CHAT/VOZ WIDESCREEN) */}
  <div className="flex flex-1 min-h-0 overflow-hidden">
    
    {/* Barra Lateral Única (Canais do Servidor ou Lista de DMs - 240px) */}
    <aside className="w-60 min-w-[240px] max-w-[240px] h-full bg-[#0d0d10] border-r border-white/5 flex flex-col justify-between p-3 shrink-0">
      {/* Conteúdo de Canais ou DMs/Grupos */}
      {/* Widget de Voz Conectada no rodapé */}
    </aside>

    {/* Área Principal de Chat / Chamada de Voz em Tela Ampla */}
    <main className="flex-1 min-w-0 h-full bg-[#050505] flex flex-col relative overflow-hidden">
      {/* Header do Canal / Chat */}
      {/* Feed de Mensagens ou Stage de Voz */}
      {/* Input de Mensagem */}
    </main>

  </div>

</div>
`}
      </pre>

      <h2 className="text-xl font-semibold mb-2">2. PRESERVAÇÃO DE FUNCIONALIDADES:</h2>
      <ul className="list-disc pl-6 space-y-1 mb-6 text-zinc-400">
        <li>Mantenha todas as chamadas WebRTC, Realtime, DMs, grupos, upload e áudio funcionando normalmente.</li>
        <li>Corrija o texto do breadcrumb para não duplicar # geral # geral.</li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">VALIDAÇÃO OBRIGATÓRIA:</h2>
      <ul className="list-disc pl-6 space-y-1 mb-6 text-zinc-400">
        <li>A barra vertical de ícones à esquerda DEVE SUMIR.</li>
        <li>No topo da tela, os servidores devem aparecer em cápsulas horizontais elegantes ao lado do botão Home.</li>
        <li>O chat e as chamadas de voz devem ocupar toda a largura da tela com visual widescreen ultra-limpo.</li>
      </ul>

      <p className="font-bold text-cyan-400">IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.</p>
    </div>
  )
});

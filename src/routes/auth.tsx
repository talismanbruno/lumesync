import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  component: () => (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-4xl mx-auto space-y-12">
        <section className="space-y-6">
          <h1 className="text-2xl font-bold tracking-tighter text-cyan-400">
            REDESIGN RADICAL: REMOVER TEXTO DE SPLASH E APLICAR LAYOUT UNIFICADO DE 2 PAINÉIS (ESTILO TELEGRAM / RAYCAST)
          </h1>
          
          <div className="space-y-8 text-zinc-400 leading-relaxed">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">1. REMOVER A TELA DE SPLASH/TEXTO CHATA (URGENTE):</h2>
              <p>Remova IMEDIATAMENTE o componente ou texto estático que exibe "DESIGN DE INTERFACE EXCLUSIVO: SISTEMA DE CHAMADA..." no carregamento.</p>
              <p>O carregamento deve ser instantâneo ou usar apenas um spinner discreto com o logo do Lume.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-white mb-4">2. ELIMINAR COLUNAS DUPLICADAS E APLICAR LAYOUT DE 2 PAINÉIS:</h2>
              <p>Remova completamente a barra vertical extra de ícones na extrema esquerda.</p>
              
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium text-zinc-200">Estrutura de 2 Painéis:</h3>
                
                <div className="pl-4 border-l border-zinc-800 space-y-6">
                  <div>
                    <h4 className="text-cyan-400 font-bold mb-2">Painel 1 (Esquerda - 320px fixo):</h4>
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                      <li>Topo: Logo Lume + Barra de busca rápida.</li>
                      <li>Abas Centrais (Filtro Rápido): Três botões em cápsula: [💬 Conversas] [🌐 Servidores] [👥 Amigos].</li>
                      <li>Se clicar em Conversas: Lista o Bot Lume, DMs e Grupos.</li>
                      <li>Se clicar em Servidores: Lista os Servidores criados e seus canais de texto/voz, com o botão + Criar Servidor.</li>
                      <li>Se clicar em Amigos: Lista amigos online, pendentes e adicionar amigo.</li>
                      <li>Rodapé: Avatar com status Ciano, nome e engrenagem de configurações ⚙️.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-cyan-400 font-bold mb-2">Painel 2 (Direita - Flex-1 Widescreen):</h4>
                    <p className="text-sm italic">Espaço amplo e imersivo para o Chat de Texto ou Chamada de Voz / Tela Compartilhada.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 space-y-4">
          <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-widest">Validação Obrigatória</h2>
          <ul className="space-y-3 text-sm text-zinc-300 list-disc pl-5">
            <li>A tela chata de texto no reload DEVE SUMIR. O site deve abrir direto.</li>
            <li>Não deve existir nenhuma coluna duplicada na esquerda.</li>
            <li>Alternar entre as abas Conversas, Servidores e Amigos no painel esquerdo deve atualizar a lista na hora com visual ultra-limpo.</li>
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

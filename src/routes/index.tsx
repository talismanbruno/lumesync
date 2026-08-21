import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/" as any)({
  component: Index,
});

function Index() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#050505] text-white p-8">
      <div className="max-w-4xl w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tighter text-[#00D1FF] glow-sm">
            FASE 5: SISTEMA COMPLETO DE MÍDIA NO CHAT (UPLOADS ATÉ 50MB, EMOJIS, GIFS E FIGURINHAS)
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed">
            Vamos implementar o envio de arquivos, fotos, vídeos, seletor de emojis e integração de GIFs no chat de canais e nas Mensagens Diretas (DMs).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00D1FF] text-black text-xs">1</span>
                CONFIGURAÇÃO DE STORAGE
              </h2>
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 font-mono text-xs text-zinc-500 overflow-x-auto">
                <pre>{`-- Criar bucket chat-attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de RLS
CREATE POLICY "chat_attachments_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'chat-attachments');
CREATE POLICY "chat_attachments_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');

-- Atualizar tabelas
ALTER TABLE public.messages ADD COLUMN file_url text;
ALTER TABLE public.direct_messages ADD COLUMN file_url text;`}</pre>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00D1FF] text-black text-xs">2</span>
                BARRA DE INPUT (MÍDIA)
              </h2>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2">📎 <span className="text-zinc-200">Botão de Anexo:</span> Seletor de arquivos (limite 50MB).</li>
                <li className="flex items-center gap-2">📋 <span className="text-zinc-200">Colar Print (Ctrl + V):</span> Upload automático ao colar.</li>
                <li className="flex items-center gap-2">😀 <span className="text-zinc-200">Emojis / Figurinhas:</span> Popup com busca e abas.</li>
                <li className="flex items-center gap-2">🎬 <span className="text-zinc-200">Botão de GIFs:</span> Buscador integrado.</li>
              </ul>
            </section>
          </div>

          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00D1FF] text-black text-xs">3</span>
                RENDERIZAÇÃO DE MÍDIA
              </h2>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-[#00D1FF]">🖼️</span>
                  <div>
                    <p className="text-zinc-200 font-medium">Imagens & Lightbox</p>
                    <p className="text-[10px]">max-h-80 rounded-xl border border-zinc-800. Clique para ampliar.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00D1FF]">🎥</span>
                  <div>
                    <p className="text-zinc-200 font-medium">Player de Vídeo</p>
                    <p className="text-[10px]">Player nativo com controles e cantos arredondados.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00D1FF]">📄</span>
                  <div>
                    <p className="text-zinc-200 font-medium">Arquivos (ZIP, PDF)</p>
                    <p className="text-[10px]">Card escuro com ícone, nome e botão de download.</p>
                  </div>
                </li>
              </ul>
            </section>

            <div className="p-4 rounded-xl bg-[#00D1FF]/5 border border-[#00D1FF]/20 space-y-2">
              <p className="text-[10px] font-bold text-[#00D1FF] uppercase tracking-widest">Validação Obrigatória</p>
              <p className="text-xs text-zinc-300 italic">Teste upload via clipe, Ctrl+V, seletor de emojis e busca de GIFs. Precisão máxima.</p>
            </div>
          </div>
        </div>
        
        <div className="pt-4 border-t border-white/5 flex justify-center">
          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.2em]">Executando Fase 5 — Lume System v1.0</p>
        </div>
      </div>
    </div>
  );
}

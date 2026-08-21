import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-[#00D1FF] border-b border-white/10 pb-2">
          SINCRONIZAÇÃO DE ADMIN E VERIFICAÇÃO DE CREDENCIAIS
        </h1>
        
        <p className="text-zinc-300">
          A base de dados foi limpa e a conta mestre foi recriada (admin@lume.com).
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wider text-sm">AJUSTES NECESSÁRIOS:</h2>
          <ul className="list-disc list-inside space-y-2 text-zinc-400 text-sm">
            <li>Certifique-se de que ao logar com <span className="text-zinc-200">admin@lume.com</span>, o app leia os campos <code className="bg-white/5 px-1 rounded">is_admin</code> e <code className="bg-white/5 px-1 rounded">is_verified</code> da tabela profiles.</li>
            <li>Exiba o selo de verificado (BadgeCheck em ciano) ao lado do nome do Admin em todas as telas (chat, barra lateral, DMs e card de perfil).</li>
            <li>Na conversa com o bot Lume, libere o campo de input para que contas com <code className="bg-white/5 px-1 rounded">is_admin === true</code> possam disparar atualizações globais via <code className="bg-white/5 px-1 rounded">broadcast_system_update</code>.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wider text-sm">VALIDAÇÃO:</h2>
          <ul className="list-disc list-inside space-y-2 text-zinc-400 text-sm">
            <li>Teste o login com <span className="text-zinc-200">admin@lume.com</span> e a senha definida.</li>
            <li>Confirme que a sessão inicia de primeira e entra direto no Dashboard com o perfil de Admin verificado.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

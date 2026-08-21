import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-8 text-zinc-400 font-mono text-sm whitespace-pre-wrap bg-[#050505] min-h-screen">
      {`PACOTE DE CORREÇÕES: MENU DE STATUS NO RODAPÉ, RENDERIZAÇÃO REAL DE GIFS/FOTOS E AJUSTES DE GRUPO/BOT

1. RESTAURAR SELETOR DE STATUS NO RODAPÉ (SidebarUserFooter.tsx):

Problema: O clique no rodapé está abrindo o Profile Card cortado atrás da sidebar em vez do menu de status.

Solução:

Ao clicar no avatar/nome do usuário no rodapé da barra lateral:

Abra o Menu Dropdown de Status (Disponível 🟢, Ausente 🟡, Não Perturbe 🔴, Invisível ⚪).

Obrigatório: O menu deve estar dentro de <DropdownMenuPortal> com z-50 abrindo para cima (side="top" e align="start"), flutuando livremente por cima da sidebar.

O ícone de engrenagem ⚙️ continua abrindo o SettingsModal (Configurações).

O nome no rodapé deve exibir o nome real: profile?.display_name || profile?.username || 'teamlume'.

2. CORRIGIR RENDERIZAÇÃO DE GIFS E IMAGENS NO CHAT (MessageItem.tsx / DMChatArea.tsx):

Causa do bug: As mensagens estão salvando apenas o nome do arquivo (ex: MJ-giphy.gif) no campo file_url, em vez da URL completa da imagem.

Ao Enviar GIF do GIPHY:

Salve no banco file_url: gif.images.original.url || gif.images.fixed_height.url (a URL completa com https://media.giphy.com/...).

Defina file_type: 'image/gif' e file_name: 'gif'.

Ao Enviar Imagem/Anexo:

Certifique-se de que file_url seja a URL pública completa do Supabase ou Base64 (data:image/...).

Na Renderização (MessageItem.tsx):

Renderize a tag <img> diretamente sem caixas escuras ao redor:

codeTsx

{message.file_url && (message.file_type?.startsWith('image') || message.file_url.includes('giphy.com') || message.file_url.startsWith('data:image')) && (
  <div className="mt-2 max-w-sm rounded-xl overflow-hidden bg-black/40 border border-zinc-800">
    <img 
      src={message.file_url} 
      alt="Mídia" 
      className="w-auto max-h-72 object-contain rounded-xl block" 
      loading="lazy"
    />
  </div>
)}

3. REMOVER BOTÃO "ENVIAR MENSAGEM" DO PERFIL DO BOT LUME (UserProfileCard.tsx):

Se o card de perfil aberto for do Bot Oficial (user.username === 'lume' ou user.id === '00000000-0000-0000-0000-000000000001'):

NÃO RENDERIZE o botão "Enviar Mensagem".

4. AJUSTAR LIMITE DE CRIAÇÃO DE GRUPO DE DMs (CreateGroupModal.tsx):

Permita criar o grupo com 1 ou mais amigos selecionados (selectedFriends.length >= 1).

VALIDAÇÃO OBRIGATÓRIA:

Clique no seu avatar no rodapé esquerdo: o menu com as opções de status (Disponível, Ausente, etc.) DEVE abrir flutuando para cima perfeitamente.

Abra o menu de GIFs e envie um GIF: ele DEVE aparecer animado e com imagem visível no chat (sem o botão quebrado MJ-giphy.gif).

Clique no perfil do Bot Lume: o botão "Enviar Mensagem" NÃO DEVE APARECER.

Crie um grupo de DM selecionando apenas 1 amigo: o grupo deve ser criado com sucesso.

IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.`}
    </div>
  )
}

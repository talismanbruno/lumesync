import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <div style={{ whiteSpace: 'pre-wrap', padding: '20px', backgroundColor: '#050505', color: 'white', minHeight: '100vh', fontFamily: 'monospace' }}>
      {`CORREÇÕES OBRIGATÓRIAS: IMAGENS NO CHAT, CRIAÇÃO DIRETA DE GRUPOS E STATUS NO RODAPÉ

1. CORRIGIR ENVIO E RENDERIZAÇÃO DE IMAGENS/GIFS NO CHAT (MessageInput.tsx e MessageItem.tsx):

Problema: As mensagens estão aparecendo como um botão quebrado com o texto "Mídia" porque o file_url está sendo enviado vazio ou undefined.

Ao Enviar GIF do GIPHY:

Certifique-se de extrair a URL direta: const gifUrl = gif.images?.original?.url || gif.images?.fixed_height?.url;

OBRIGATÓRIO: O file_url no insert da mensagem DEVE ser essa string gifUrl (começando with https://media.giphy.com/...).

Ao Enviar Imagem/Anexo do Computador:

Converta o arquivo selecionado para Base64 usando FileReader (ou suba para o Supabase Storage e pegue a publicUrl). O file_url DEVE ser uma URL válida (começando com https:// ou data:image/).

Na Renderização (MessageItem.tsx):

NUNCA renderize a tag <img> se file_url for nulo, vazio ou "undefined".

Se file_url for uma URL válida:

codeTsx

{message.file_url && message.file_url.startsWith('http') && (
  <div className="mt-2 max-w-sm rounded-xl overflow-hidden bg-black/40 border border-zinc-800">
    <img 
      src={message.file_url} 
      alt="Imagem anexada" 
      className="w-auto max-h-80 object-contain rounded-xl block" 
      loading="lazy" 
    />
  </div>
)}

2. CORRIGIR CRIAÇÃO DE GRUPO DE DMs (CreateGroupModal.tsx):

Substitua a lógica de criação de grupo por inserção direta à prova de falhas:

codeTypeScript

const handleCreateGroup = async () => {
  if (selectedFriendIds.length === 0) {
    toast.error("Selecione pelo menos 1 amigo para criar o grupo!");
    return;
  }
  setIsLoading(true);
  try {
    // 1. Cria o grupo
    const { data: newGroup, error: groupError } = await supabase
      .from('dm_groups')
      .insert({
        name: groupName.trim() || \`Grupo com \${selectedFriendIds.length + 1} membros\`,
        created_by: user.id
      })
      .select()
      .single();
      
    if (groupError) throw groupError;

    // 2. Adiciona o criador e os amigos selecionados
    const membersToInsert = [
      { group_id: newGroup.id, user_id: user.id },
      ...selectedFriendIds.map(friendId => ({ group_id: newGroup.id, user_id: friendId }))
    ];

    const { error: membersError } = await supabase
      .from('dm_group_members')
      .insert(membersToInsert);

    if (membersError) throw membersError;

    toast.success("Grupo criado com sucesso!");
    onClose();
    await fetchConversations();
    onSelectGroup(newGroup.id);
  } catch (err: any) {
    console.error("Erro ao criar grupo:", err);
    toast.error(err.message || "Erro ao criar grupo");
  } finally {
    setIsLoading(false);
  }
};

3. RESTAURAR O SELETOR DE STATUS NO RODAPÉ ESQUERDO (SidebarUserFooter.tsx):

Ao clicar no avatar ou no nome teamlume no rodapé da barra lateral:

NÃO ABRA O USERPROFILECARD.

Abra o Menu Dropdown de Status (Disponível 🟢, Ausente 🟡, Não Perturbe 🔴, Invisível ⚪).

Use <DropdownMenuPortal> com z-50 abrindo para cima (side="top"), para que o menu flutue livremente sem quebrar o layout da barra lateral.

VALIDAÇÃO OBRIGATÓRIA:

Envie um GIF do menu de GIFs: o GIF animado DEVE carregar e ficar visível na conversa (sem a caixa cinza com texto "Mídia").

Clique no + de Mensagens Diretas, selecione um amigo e clique em "Criar Grupo": o modal DEVE fechar e o grupo deve aparecer na lista de conversas.

Clique no seu nome no rodapé esquerdo: o menu com as opções de status (Disponível, Ausente, etc.) DEVE abrir.

IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.`}
    </div>
  )
})

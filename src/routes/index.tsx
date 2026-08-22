import React from 'react';

export default function Documentation() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#050505', color: '#fff', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
      AJUSTES DE UX/LAYOUT: ALINHAMENTO DO CHAT, PAINEL DE AMIGOS COMPLETO E HOME PADRÃO

As imagens e GIFs já estão funcionando. Vamos corrigir o alinhamento das mensagens, a interatividade da aba de Amigos e a Home inicial.

1. ALINHAMENTO DO CHAT (ELIMINAR BORDAS PRETAS CENTRAIS):

No componente de mensagens (ChatMessageList.tsx / DMChatArea.tsx):

Remova qualquer classe max-w-md mx-auto ou centralização forçada que esteja deixando o chat em uma coluna fina no meio.

Aplique largura total com padding lateral confortável:
&lt;div className="flex-1 w-full max-w-5xl px-8 py-4 overflow-y-auto space-y-4"&gt;

As mensagens e imagens devem ficar alinhadas à esquerda no formato clássico de chat.

2. PAINEL DE AMIGOS TOTALMENTE INTERATIVO (FriendsView.tsx):

Quando o usuário estiver na visualização de Amigos (activeTab === 'amigos'):

A área principal da direita DEVE renderizar a lista correspondente à aba selecionada:

Aba "Disponível": Título "Disponível — [X]" e lista dos amigos online com avatar, nome, status ciano e botões de Iniciar Conversa (MessageSquare) e Ligar (Phone).

Aba "Todos": Lista completa de amigos com menu para remover amizade.

Aba "Pendentes": Lista de solicitações recebidas com botões Aceitar [✓] e Recusar [✕], e enviadas com botão de cancelar.

Aba "Adicionar Amigo": Card destacado com o campo de texto para digitar o username e botão "Enviar Pedido de Amizade".

Proibido: NUNCA exiba o card "Bem-vindo ao Lume" vazio quando o usuário estiver navegando na aba de Amigos.

3. TELA DE HOME PADRÃO (AO FAZER LOGIN):

Ao logar sem nenhuma DM ou Servidor aberto:

Abra por padrão a visualização de Amigos -&gt; Disponível, para que o usuário veja imediatamente quem está online para conversar.

4. CORRIGIR NOMES E AVATARES NO FEED DE DMs:

No print das DMs, algumas mensagens antigas aparecem com o nome "Usuário" e iniciais "US".

Certifique-se de que a query de mensagens busque sempre o display_name, username e avatar_url atualizados da tabela profiles.

VALIDAÇÃO OBRIGATÓRIA:

Abra o chat: confirme que as mensagens e fotos ocupam a tela de forma harmoniosa, alinhadas à esquerda sem duas faixas pretas vazias nas laterais.

Clique em Amigos -&gt; alterne entre Disponível, Todos, Pendentes e Adicionar Amigo: cada aba deve exibir sua respectiva lista com botões funcionais na área principal.

Envie um pedido de amizade na aba "Adicionar Amigo" e confirme o toast de sucesso.

IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.
    </div>
  );
}

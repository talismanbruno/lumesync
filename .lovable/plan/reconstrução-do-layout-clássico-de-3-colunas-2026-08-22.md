# Reconstrução do Layout Clássico de 3 Colunas

Hoje existem duas camadas de interface concorrentes: o arquivo de layout `_authenticated.tsx` desenha sua própria barra de servidores (72px), sua própria coluna de 240px e um rodapé de perfil, e dentro dela o dashboard (`_authenticated.index.tsx`) desenha outra vez as mesmas colunas mais as abas horizontais `Conversas / Servidores / Amigos`. É daí que vêm as barras duplicadas e a rolagem horizontal cinza.

## O que será feito

### 1. Layout pai vira apenas moldura
`src/routes/_authenticated.tsx` mantém somente a verificação de sessão/onboarding e renderiza `<Outlet />` em tela cheia. Toda a UI de colunas, o rodapé de perfil duplicado, o modal de criar servidor e o menu de status saem dele (essas funções continuam existindo, só passam a viver no dashboard).

### 2. Dashboard reconstruído em 3 colunas
`src/routes/_authenticated.index.tsx` passa a usar exatamente a estrutura pedida:

- **Coluna 1 (72px fixo)**: botão Home (limpa servidor, DM e grupo e volta para Amigos), separador, lista de servidores com destaque ciano no ativo, botão direito para excluir servidor, e botão `+` para criar/entrar em servidor. Ao clicar num servidor, o `#geral` (primeiro canal de texto) é selecionado imediatamente.
- **Coluna 2 (240px fixo)**: com servidor selecionado mostra nome do servidor, botão de convite, "Canais de Texto" e "Canais de Voz". Sem servidor mostra o botão Amigos, cabeçalho "Mensagens Diretas" com `+` para criar grupo, o Lume Oficial fixo no topo, e a lista de DMs/grupos com badge de não lidas.
- **Rodapé fixo da Coluna 2**: avatar quadrado com `StatusBadge`, nome com selo verificado, status em texto, e engrenagem de configurações; o seletor de status abre por clique no bloco do perfil.
- **Coluna 3 (flex-1)**: sala de voz, chat de canal, chat de DM, chat de grupo ou, por padrão, a tela de Amigos. Nunca fica preta.

As abas horizontais `Conversas / Servidores / Amigos` e o estado `activeTab` são removidos; a navegação passa a ser `selectedServerId` + `activeChannelId` + `activeDMUserId` + `activeGroupId`.

### 3. Tela de Amigos
`FriendsView.tsx` ganha o cabeçalho com as quatro abas clicáveis dentro dela mesma: **Disponível** (amigos online/ausente/ocupado), **Todos**, **Pendentes** (apenas solicitações recebidas, com Aceitar/Recusar) e **Adicionar Amigo** (busca por username, botão "Enviar Pedido de Amizade" e toasts em português). Clicar num amigo abre a DM na Coluna 3.

### 4. Fim da barra de rolagem horizontal
A Coluna 2 e seu rodapé recebem `overflow-x-hidden`, os nomes recebem `truncate` e `min-w-0`, e a rolagem vertical usa uma barra invisível (`scrollbar-none`), eliminando a faixa cinza acima do perfil.

## Detalhes técnicos

- Novo utilitário `.scrollbar-none` em `src/styles.css` (largura 0 no webkit + `scrollbar-width: none`).
- Toda a lógica existente é preservada: Realtime de mensagens, presença/WebRTC (`useVoiceRoom`, `VoiceRoomUI`), upload de mídia, emojis/GIFs, badges de não lidas, bot oficial somente-leitura, criação/entrada/exclusão de servidor, criação de grupos de DM e `SettingsModal`.
- `UserAvatar` continua com fallback de iniciais e `aspect-square object-cover` para não espremer.
- Nenhuma mudança de banco de dados é necessária.

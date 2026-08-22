# Plano Técnico: Chamadas de Voz e Tela em DMs e Grupos

Este plano detalha a expansão do sistema WebRTC atual para suportar DMs (1:1) e Grupos, utilizando uma infraestrutura unificada.

## 1. Abstração do Gerenciamento de Salas
O `useVoiceRoom.ts` será refatorado para aceitar um `roomKey` único e determinístico, em vez de apenas um `channel_id` de servidor.

### Identidade da Sala (roomKey)
- **Servidores:** `server-channel-{channel_id}` (preservando compatibilidade).
- **DM Individual:** `dm-1to1-{min(userA_id, userB_id)}-{max(userA_id, userB_id)}`.
- **DM em Grupo:** `dm-group-{group_id}`.

Essa abordagem garante que todos os participantes de uma mesma conversa caiam na mesma sala sem colisões.

## 2. Modificações na Infraestrutura

### Banco de Dados (`voice_participants`)
A tabela será utilizada para rastrear quem está na chamada em tempo real:
- `channel_id`: Armazenará o `roomKey` determinístico (tipo texto/uuid conforme suporte).
- `user_id`: UUID do usuário.

### Hook `useVoiceRoom.ts`
- Alterar assinatura para receber o `roomKey` determinístico.
- Garantir que o `supabase.channel` utilize esse `roomKey`.
- Otimizar o cleanup para lidar com trocas rápidas entre DMs e Servidores.

## 3. Interface e Experiência do Usuário (UX)

### Cabeçalho do Chat
- Adicionar ícone de telefone (`Phone` / `Volume2`) no topo das DMs e Grupos.
- **Estado Dinâmico:** Se houver participantes na sala (via Presence), o botão mudará para "Entrar na chamada" com um indicador visual de atividade.

### Sistema de Convite (Sinalização)
- Ao iniciar uma chamada, um evento de `broadcast` via Supabase será disparado para os outros participantes da conversa.
- O destinatário verá um banner/toast persistente: "[Avatar] está te chamando... [Aceitar] [Recusar]".
- Ao aceitar, o componente `VoiceRoomUI` é ativado com o `roomKey` correspondente.

### Integração no Dashboard
- O `VoiceRoomUI` será renderizado no `COLUNA 3 (Canvas Principal)`, substituindo o chat enquanto a chamada estiver ativa em modo "Stage", ou como uma barra flutuante se o usuário quiser continuar lendo o chat.

## 4. Segurança e RLS
- As chamadas de DMs e Grupos respeitarão as permissões existentes: apenas amigos (DMs) ou membros do grupo (`dm_group_members`) poderão gerar/receber sinalização para aquele `roomKey`.

## Próximos Passos
Após aprovação, iniciaremos a refatoração do `useVoiceRoom` para aceitar a nova identidade de sala e a implementação dos botões de ação no cabeçalho do dashboard.

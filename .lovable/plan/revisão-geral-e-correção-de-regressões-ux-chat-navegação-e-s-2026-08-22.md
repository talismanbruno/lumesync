# Revisão Geral e Correção de Regressões (UX, Chat, Navegação e Servidores)

Resolva todos os 15 pontos listados abaixo rigorosamente sem remover nenhuma função existente.

## Pontos de Implementação

1.  **Fix de Login e Transição**:
    *   No `src/routes/auth.tsx`, implementar um estado de carregamento suave e garantir que o redirecionamento para `/` seja direto, sem flashes de tela.
2.  **Bot Oficial no Chat**:
    *   No `src/routes/_authenticated.index.tsx` (onde a lógica de mensagens reside), identificar o bot Lume (ID `00000000-0000-0000-0000-000000000001` ou username `lume`).
    *   Forçar o avatar oficial `https://i.ibb.co/99YTNvGS/image.png` e adicionar a tag `[OFICIAL]`.
3.  **Barra de Rolagem Customizada**:
    *   Em `src/styles.css`, adicionar classes para scrollbar ultra-fina/invisível.
    *   Aplicar no container de mensagens em `src/routes/_authenticated.index.tsx`.
4.  **Auto-selecionar #geral**:
    *   Na lógica de clique de servidor em `src/routes/_authenticated.index.tsx`, garantir que o primeiro canal de texto seja aberto automaticamente.
5.  **Botão de Deslogar nas Configurações**:
    *   Adicionar botão "Sair da Conta" no `src/components/ui/SettingsModal.tsx` (aba Minha Conta).
6.  **Remover Botão "X" Duplicado**:
    *   Remover o botão customizado de fechar no `src/components/ui/SettingsModal.tsx`, mantendo o do `Dialog`.
7.  **Limpar Texto de Status**:
    *   Em `src/components/ui/FriendsView.tsx`, remover o texto cru "Dnd"/"Idle" abaixo do nome, mantendo apenas a bolinha de status.
8.  **Fluxo de Adicionar Amigo**:
    *   Implementar validações completas (vazio, inexistente, já amigo, sucesso) com toasts no `src/components/ui/FriendsView.tsx`.
9.  **Simplificar Aba Pendentes**:
    *   Filtrar `Friendships` para mostrar apenas solicitações recebidas pendentes no `src/components/ui/FriendsView.tsx`.
10. **Restaurar Context Menu de Servidor**:
    *   Reimplementar `onContextMenu` na lista de servidores para permitir exclusão pelo dono.
11. **Restaurar Criação de Servidor**:
    *   Verificar e garantir que o botão `+` abre o modal de criação e usa a RPC correta.
12. **Correção de Mute na Call**:
    *   Corrigir o `toggleMic` no `src/hooks/useVoiceRoom.ts` para ser bidirecional (habilitar/desabilitar tracks).
13. **Destravar Criação de Grupos**:
    *   No `src/components/ui/CreateGroupModal.tsx`, permitir criação com 1+ amigos e abrir a conversa imediatamente.
14. **Desespremer Avatares**:
    *   Ajustar `src/components/ui/UserAvatar.tsx` para garantir `shrink-0 aspect-square rounded-full overflow-hidden` com imagem `object-cover`.
15. **Eliminar Delays na Navegação**:
    *   Utilizar estados locais reativos para trocas imediatas de canal/DM antes de disparar queries.

## Detalhes Técnicos

### Scrollbar CSS
```css
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
```

### Lógica do Bot
```tsx
const isBot = msg.user_id === '00000000-0000-0000-0000-000000000001' || msg.profile?.username === 'lume';
const avatar = isBot ? "https://i.ibb.co/99YTNvGS/image.png" : msg.profile?.avatar_url;
const name = isBot ? "Lume [OFICIAL]" : (msg.profile?.display_name || msg.profile?.username);
```

### Voice Hook Fix
```typescript
const toggleMic = () => {
  if (localStreamRef.current) {
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }
};
```

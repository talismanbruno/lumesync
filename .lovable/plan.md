# Plano de Implementação - Fase 4: Sala de Voz e Compartilhamento de Tela

Vamos implementar chamadas de voz de baixa latência e compartilhamento de tela usando WebRTC e sinalização via Supabase Realtime (Broadcast).

## Alterações de Backend (SQL)

- Nenhuma alteração de tabela necessária (utilizaremos Canais de Broadcast e Presence do Realtime).

## Alterações de Frontend

### 1. Sistema de Voz (WebRTC)
- Criar um hook `useVoiceRoom` ou componente `VoiceRoom` para gerenciar as conexões WebRTC.
- Implementar sinalização via canal `voice-room:${channelId}` do Supabase.
- Trocar `offer`, `answer` e `ice-candidate` entre os participantes.

### 2. Interface da Sala de Voz
- Renderizar uma grade (Grid) de participantes na área central quando um canal de voz estiver ativo.
- Adicionar detecção de volume (Web Audio API) para mostrar um glow ciano (#00D1FF) ao redor de quem está falando.
- Exibir participantes abaixo do canal na barra lateral.

### 3. Compartilhamento de Tela
- Implementar `navigator.mediaDevices.getDisplayMedia`.
- Adicionar botão de compartilhamento na barra de controles.
- Lógica de "Stage" para destacar a tela compartilhada enquanto minimiza os avatares dos outros participantes.

### 4. Barra de Controles de Voz
- Adicionar controles flutuantes no rodapé da sala:
    - Mutar/Desmutar microfone.
    - Ensurdecer (Deafen).
    - Compartilhar Tela.
    - Desconectar da chamada.

## Detalhes Técnicos
- Utilizar servidores STUN públicos do Google para NAT traversal.
- Sincronização de estado de áudio/vídeo via Supabase Presence.
- Gerenciamento de múltiplos fluxos de mídia (áudio local, áudio remoto, vídeo remoto).

---
*Este plano foca na implementação de 100% dos requisitos solicitados na Fase 4.*

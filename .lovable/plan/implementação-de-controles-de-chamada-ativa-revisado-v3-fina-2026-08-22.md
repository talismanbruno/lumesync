# Implementação de Controles de Chamada Ativa (Revisado v3 - Final)

Este plano detalha a implementação da interface de controle de chamadas ("Órbita Ativa" e "Conexão Orbital"), garantindo persistência, tipagem estrita e lógica de status WebRTC/Presence precisa.

## Persistência e Visibilidade
- O hook `useVoiceRoom` será instanciado no `DashboardComponent` (src/routes/_authenticated.index.tsx).
- O estado `showVoiceUI` controlará apenas a visibilidade do `VoiceRoomUI` (Stage).
- Minimizar (botão X) apenas oculta a interface; o encerramento ocorre apenas no `disconnect()`.

## Tipagem e Estados de Conexão
- **Tipos Estritos:** `LumeProfile` (id, username, avatar_url, etc.) e `ConnectionStatus`.
- **Mapeamento de Status (`ConnectionStatus`):**
    - `connecting`: Canal != 'SUBSCRIBED' OU `localStream` ausente OU track != 'live'.
    - `reconnecting`: Canal já esteve conectado mas está 'joining' OU peers em 'checking'/'disconnected' < 5s.
    - `connected`: Canal 'SUBSCRIBED' e track local ativa. (Solo call = connected).
    - `unstable`: Pelo menos um peer em 'disconnected'/'failed' > 5s.
    - `failed`: Erro fatal do canal, stream local irrecuperável ou TODOS os peers falharam.
- **Segurança:** Não exibe `connected` se o microfone falhou/stream local é nulo.

## Detecção de Fala (VAD)
- **Processamento:** Local via `AudioContext` e `AnalyserNode`.
- **Transmissão:** Apenas booleano `speaking` via broadcast com throttle.
- **Expiração:** Timout de segurança no receptor para evitar que participantes fiquem "presos" no estado de fala.
- **Mute:** Se `isMuted`, `speaking` é forçado para `false`.

## Supressão de Ruído e Configurações
- **Noise Suppression:** Verificação de suporte, aplicação de constraints e confirmação via `getSettings()`.
- **Interface:** Botão funcional que abre um popover de configurações de áudio real (seleção de dispositivos).

## Interfaces de Componentes
Exportação de handlers e estados sincronizados:
- `isMuted`, `isDeafened`, `isSharingScreen`, `isNoiseSuppressionEnabled`.
- `connectionStatus` (tipado).
- `onToggleMute`, `onToggleDeafen`, `onToggleScreenShare`, `onToggleNoiseSuppression`, `onOpenAudioSettings`, `onOpenStage`, `onDisconnect`.

## Acessibilidade
- `aria-label`, `aria-pressed`, suporte a teclado, `prefers-reduced-motion` e tooltips.

## Plano de Execução
1. Atualizar `useVoiceRoom.ts` com a nova lógica de VAD, Supressão de Ruído e Mapeamento de Status.
2. Criar `src/components/voice/ActiveCallBar.tsx` e `src/components/voice/OrbitalConnectionPanel.tsx`.
3. Injetar hook no `DashboardComponent` e adicionar popover de configurações de áudio.
4. Validar chamadas solo e em grupo, minimização e reabertura.

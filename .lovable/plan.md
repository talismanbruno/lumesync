# Implementação de Controles de Chamada Ativa (Revisado)

Este plano detalha a implementação da interface de controle de chamadas ("Órbita Ativa" e "Conexão Orbital"), garantindo persistência da conexão e integridade dos estados WebRTC.

## Persistência e Visibilidade
Para evitar que a chamada caia ao fechar a interface, o hook `useVoiceRoom` será mantido no componente pai (`DashboardComponent` em `_authenticated.index.tsx`).
- O estado `showVoiceUI` controlará apenas a visibilidade do `VoiceRoomUI` (Stage).
- Fechar o Stage (minimizar) não chamará `disconnect()`. A chamada só encerra ao clicar explicitamente no botão de desconectar.

## Fonte Única de Estado
Todos os componentes consumirão o estado retornado por uma única instância de `useVoiceRoom`:
- **Participantes:** `participants` sincronizados via Presence.
- **Mídia:** `isMuted`, `isDeafened`, `isSharingScreen`.
- **Status de Conexão:** Mapeamento em tempo real (veja abaixo).

## Mapeamento de Status de Conexão
Criaremos um estado derivado `connectionStatus` baseado em:
1. **Conectando:** Supabase Channel status é 'joining' ou `localStream` ainda não obtido.
2. **Conectado:** Channel status é 'SUBSCRIBED' e `localStream` ativo.
3. **Reconectando:** Eventos de 'system' indicando reconexão do socket.
4. **Conexão instável:** `iceConnectionState` de algum peer em 'disconnected' ou 'failed' por > 5s.
5. **Falha na conexão:** Channel erro fatal ou todos os peers desconectados.

## Detecção de Fala (Voz)
Implementaremos detecção real de áudio local usando `AudioContext` e `AnalyserNode` no stream do microfone.
- O nível de volume será enviado via `broadcast` Realtime (throttled) para atualizar o `isSpeaking` dos outros participantes.
- Se a latência for alta, o indicador será removido conforme solicitado.

## Supressão de Ruído
Adicionaremos um toggle que aplica `noiseSuppression: true` nas `MediaTrackConstraints` do microfone.
- Verificação via `navigator.mediaDevices.getSupportedConstraints()`.
- Tooltip de erro se o hardware/browser não suportar.

## Props dos Componentes

### `ActiveCallBar` (Topo do Chat)
```typescript
interface ActiveCallBarProps {
  roomName: string;
  participants: VoiceParticipant[];
  myProfile: any;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  connectionStatus: string;
  onOpenStage: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
}
```

### `OrbitalConnectionPanel` (Sidebar)
```typescript
interface OrbitalConnectionPanelProps {
  status: string;
  roomName: string;
  contextName: string;
  participantCount: number;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  isNoiseSuppressionEnabled: boolean;
  onOpenStage: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onToggleNoiseSuppression: () => void;
  onDisconnect: () => void;
}
```

## Plano de Execução
1. Modificar `useVoiceRoom.ts` para incluir detecção de voz real e status de conexão WebRTC.
2. Atualizar as definições de interface em `src/components/voice/`.
3. Injetar o hook no topo do `DashboardComponent`.
4. Renderizar condicionais para a Barra e o Painel.

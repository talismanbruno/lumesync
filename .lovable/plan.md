# Implementação de Controles de Chamada Ativa (Revisado v2)

Este plano detalha a implementação da interface de controle de chamadas ("Órbita Ativa" e "Conexão Orbital"), garantindo persistência da conexão e integridade dos estados WebRTC, seguindo os ajustes obrigatórios de tipos, lógica de status e detecção de fala.

## Persistência e Visibilidade
Para evitar que a chamada caia ao fechar a interface, o hook `useVoiceRoom` será mantido no componente pai (`DashboardComponent` em `src/routes/_authenticated.index.tsx`).
- O estado `showVoiceUI` controlará apenas a visibilidade do `VoiceRoomUI` (Stage).
- Minimizar o Stage (botão X) apenas esconde a UI; a desconexão real ocorre apenas no cleanup/leave explícito.

## Fonte Única de Estado e Tipagem
Todos os componentes consumirão o estado de uma única instância do hook.
- **Tipos Reais:** Substituição de `any` por `LumeProfile` e `ConnectionStatus`.
- **ConnectionStatus:** `connecting | connected | reconnecting | unstable | failed`.

## Lógica de Status de Conexão
- **Connected:** Canal subscrito, mesmo com 0 peers remotos (aguardando entrada).
- **Unstable:** Pelo menos um peer falhou ou desconectou por > 5s (timer limpo no cleanup).
- **Failed:** Erro fatal no canal ou todos os peers ativos em estado de falha (se peers > 0).
- Agregação de estados: Um peer falho em chamada de grupo não derruba os outros.

## Detecção de Fala (Voice Activity Detection - VAD)
- **Cálculo Local:** Uso de `AudioContext` e `AnalyserNode` apenas localmente.
- **Sinalização Eficiente:** Transmissão apenas do booleano `speaking: true/false` via broadcast.
- **Throttle:** Evento disparado apenas na transição de estado, com limite de frequência.
- **Silêncio:** Quando o usuário está mutado, `speaking` é forçado para `false`.
- **Cleanup:** Destruição completa de contextos de áudio e timers ao desconectar.

## Supressão de Ruído
- Verificação de suporte via `navigator.mediaDevices.getSupportedConstraints()`.
- Aplicação dinâmica de constraints na track ativa com verificação via `track.getSettings()`.
- Fallback visual caso a aplicação falhe.

## Acessibilidade e Mobile
- Implementação de `aria-label`, `aria-pressed`, suporte a foco por teclado e `prefers-reduced-motion`.
- Layouts compactos e responsivos para dispositivos móveis.

## Plano de Execução
1. Atualizar `useVoiceRoom.ts` com a nova lógica de status, VAD e supressão de ruído.
2. Refinar `ActiveCallBar.tsx` e `OrbitalConnectionPanel.tsx` com as props e interfaces finais.
3. Integrar no `DashboardComponent` elevando o estado do hook.
4. Validar fluxos de entrada/saída, minimização e sincronia de controles.
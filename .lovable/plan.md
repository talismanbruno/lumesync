# Implementação de Controles de Chamada Ativa (Órbita Ativa & Conexão Orbital)

Este plano descreve a implementação de dois componentes de controle para chamadas de voz ativas no LUME, integrando-os com o sistema WebRTC existente.

## User Review Required

> [!IMPORTANT]
> A sinalização de status de conexão (Conectando, Conectado, etc.) será baseada nos estados disponíveis no hook `useVoiceRoom.ts`.

## Proposed Changes

### 1. Novos Componentes UI
- `src/components/voice/ActiveCallBar.tsx`: Faixa horizontal compacta para o topo do chat.
- `src/components/voice/OrbitalConnectionPanel.tsx`: Painel lateral acima do perfil.

### 2. Integração no Dashboard
- Modificar `src/routes/_authenticated.index.tsx` para renderizar os novos componentes.
- A `ActiveCallBar` aparecerá no topo da coluna 3 (Canvas) quando houver uma chamada ativa e o usuário NÃO estiver com o Stage (VoiceRoomUI) aberto.
- O `OrbitalConnectionPanel` aparecerá na sidebar (coluna 2) sempre que houver uma chamada ativa local.

### 3. Melhorias no Hook de Voz
- Garantir que o estado de participantes e conexão seja exportado corretamente para uso nos componentes de UI.

## Technical Details

### Estilização
- Uso de `backdrop-blur-md` e bordas finas com `border-white/5`.
- Cores de acento LUME: `#00D1FF` (Cyan) para estados ativos.
- Animações `animate-in` para transições suaves de entrada/saída.

### Funcionalidades
- **Avatares:** Exibição de até 4 avatares com indicador +N.
- **Controles:** Mute, Ensurdecer (se suportado), Compartilhamento de Tela e Desconectar.
- **Indicador de Fala:** Integrar com o estado `isSpeaking`/`isTalking` já presente nos perfis dos participantes.

## Execution Plan
1. Criar `src/components/voice/ActiveCallBar.tsx`.
2. Criar `src/components/voice/OrbitalConnectionPanel.tsx`.
3. Atualizar `src/routes/_authenticated.index.tsx` para gerenciar a visibilidade e os controles.
4. Validar comportamento em tempo real.
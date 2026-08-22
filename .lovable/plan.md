# Plano de Correção: Regressão na Presença e Áudio das Salas de Voz

Esta tarefa foca exclusivamente na correção da regressão identificada no sistema de salas de voz, onde participantes não se descobrem e a conexão WebRTC falha.

## Causa Raiz Provável
1. **Inconsistência de Tópicos**: Possível divergência no nome do canal Realtime entre usuários.
2. **Ciclo de Vida do Realtime**: `track()` sendo chamado antes do status `SUBSCRIBED` ou cleanup prematuro.
3. **Estado de Presença**: Normalização incorreta dos dados de presença impedindo a renderização de outros participantes.
4. **Sinalização WebRTC**: Falha na troca de `offer`/`answer` devido a filtros de ID incorretos ou falta de um iniciador determinístico robusto.

## Ações Técnicas

### 1. Estabilização do Hook `useVoiceRoom.ts`
- **Tópico Determinístico**: Garantir que `voice-room-${channelId}` seja o único identificador, removendo qualquer ruído de sessão.
- **Ordem de Inscrição**: Mover a chamada `track()` para dentro do callback de status `SUBSCRIBED`.
- **Normalização de Presença**: Refatorar o listener de `sync` para extrair corretamente os metadados (`userId`, `username`, `avatarUrl`) e remover duplicatas de forma agressiva.
- **Sinalização WebRTC**: 
  - Validar que o `targetId` nas mensagens de broadcast corresponde ao ID do usuário local.
  - Implementar lógica de "iniciador" baseada em comparação de IDs (ex: o usuário com ID léxico menor inicia) para evitar colisões de oferta.
- **Cleanup Robusto**: Garantir que `untrack` e `removeChannel` só ocorram no desmonte real ou troca de canal.

### 2. Integração no Dashboard (`src/routes/_authenticated.index.tsx`)
- Sincronizar o contador da barra lateral com o estado de `participants` retornado pelo hook, eliminando a consulta paralela à tabela `voice_participants` que pode estar causando lag visual.

## Validação (Headless Playwright)
- Simular dois usuários entrando no mesmo canal.
- Verificar via logs do console (temporários) que ambos recebem o evento `sync` com 2 participantes.
- Confirmar que as mensagens de sinalização (`offer`/`answer`) são trocadas com sucesso.
- Validar que o contador na sidebar reflete "2" para ambos.

## Restrições
- Nenhuma alteração de layout ou estilos.
- Foco absoluto na lógica de comunicação.

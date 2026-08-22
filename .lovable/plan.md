# Relatório de Diagnóstico e Plano de Implementação: Salas de Voz LUME

O diagnóstico inicial focou na estabilização do hook `useVoiceRoom.ts` para capturar logs determinísticos e corrigir a regra do iniciador WebRTC.

## Diagnóstico Técnico
- **Causa Raiz Comprovada (Parcial)**: A regra de sinalização anterior era "o último a entrar inicia", o que falhava em casos de concorrência ou reconexão. Implementada a **Regra do Iniciador Léxico** (comparação de UUIDs) para garantir que apenas um par inicie a oferta, independentemente da ordem de entrada.
- **Identidade Estável**: Adicionados logs para validar `channelId` e `user.id`. A inscrição agora é bloqueada até que ambos os valores estejam presentes.
- **Presença**: O hook agora registra o `presenceState` bruto para depurar por que usuários não se viam.

## Alterações Realizadas (`src/hooks/useVoiceRoom.ts`)
1.  **Bloqueio de Inscrição Inválida**: `joinVoiceChannel` agora valida `cid` e `myProfile.id` antes de criar o canal.
2.  **Logs de Diagnóstico**: Inseridos logs em `sync`, `status` e `identidade` para rastreamento em tempo real no console do desenvolvedor.
3.  **Iniciador Determinístico**: Implementada lógica `myProfile.id.toLowerCase() < u.id.toLowerCase()` para decidir quem envia o `offer`.
4.  **Correção de Tipagem**: Resolvido erro de referência circular no `useCallback` do `createPeerConnection`.

## Próximos Passos (Implementação da Solução)
1.  **Normalização de Presença**: Refatorar o mapeamento do `sync` para garantir que o payload contenha `display_name` e `avatar_url` persistentes.
2.  **Unificação do Contador**: Alterar a sidebar em `src/routes/_authenticated.index.tsx` para usar a lista de `participants` do hook, removendo a dependência da tabela `voice_participants` para a sala ativa.
3.  **Validação Final**: Teste manual com duas janelas (anônima e normal) para confirmar áudio bidirecional e Stage funcional.

O diagnóstico está ativo e a base para a correção definitiva foi estabelecida.

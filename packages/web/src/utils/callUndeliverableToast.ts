/**
 * Builds a user-facing toast message from a `dm_call_undeliverable` event.
 *
 * Copy is phase-aware:
 * - `start`: call-start delivery; terminal means the ring was destroyed, non-terminal
 *   means the call continues for other reachable recipients.
 * - `accept`: the acceptor's B→host relay failed; terminal means their optimistic
 *   active-call state was rolled back.
 * - `reject`: the rejector's relay to the host failed; state was already cleared
 *   locally, so non-terminal info toast only.
 * - `end`: the ender's relay to the host failed; state was already cleared locally.
 * - `host_unreachable`: the call was terminated by the sentinel worker because the
 *   host peer became permanently unreachable. Always terminal. A single failure entry
 *   is expected; multiple fall back to a generic line.
 *
 * Extracted from `useWebSocket.ts` so it can be unit-tested without pulling in
 * the full WS handler graph (livekit / audio deps).
 */
export function buildCallUndeliverableToast(
  failures: Array<{ reason: string; peerOrigin?: string; peerLabel?: string }>,
  terminal: boolean,
  phase: 'start' | 'accept' | 'reject' | 'end' | 'host_unreachable' = 'start',
): string {
  const primary = failures[0];
  const labelFor = (f: { peerLabel?: string; peerOrigin?: string }) =>
    f.peerLabel ?? f.peerOrigin?.replace(/^https?:\/\//, '') ?? 'a instância remota';

  if (phase === 'accept' && terminal) {
    const label = primary ? labelFor(primary) : 'a instância principal';
    return `Não foi possível confirmar com ${label} — a chamada foi encerrada.`;
  }

  if (phase === 'reject') {
    const labels = failures.map(labelFor).join(', ') || 'a instância principal';
    return `Não foi possível avisar ${labels} que você recusou. A chamada pode continuar aparecendo por alguns segundos.`;
  }

  if (phase === 'end') {
    const labels = failures.map(labelFor).join(', ') || 'a instância principal';
    return `Não foi possível avisar ${labels} que você saiu. A chamada pode continuar aparecendo por até 60 segundos.`;
  }

  // host_unreachable: call terminated because the host peer became unreachable.
  // Terminal is always true in this phase. A single failure entry is expected;
  // zero or multiple fall back to a generic line.
  if (phase === 'host_unreachable') {
    const [f] = failures;
    if (!f || failures.length !== 1) {
      return 'Chamada encerrada — a instância principal ficou indisponível.';
    }
    const label = f.peerLabel || f.peerOrigin?.replace(/^https?:\/\//, '') || 'a instância principal';
    if (f.reason === 'peer_rejected') {
      return `Chamada encerrada — esta instância não está mais conectada a ${label}.`;
    }
    return `Chamada encerrada — ${label} ficou indisponível.`;
  }

  // phase === 'start' (default + legacy)
  if (!terminal) {
    const labels = failures.map(labelFor).join(', ');
    return `Alguns participantes não puderam ser alcançados: ${labels}.`;
  }
  if (failures.length > 1) {
    const labels = failures.map(labelFor).join(', ');
    return `Não foi possível alcançar ${failures.length} instâncias: ${labels}.`;
  }
  if (!primary) return 'Não foi possível iniciar a chamada.';

  const label = labelFor(primary);
  switch (primary.reason) {
    case 'peer_rejected':
      return `Não foi possível alcançar ${label} — a conexão entre instâncias precisa de aprovação.`;
    case 'peer_awaiting_approval':
      return `Aguardando a aprovação do administrador de ${label}. As chamadas funcionarão depois disso.`;
    case 'peer_transient_failure':
      return `Não foi possível alcançar ${label}. Tente novamente em instantes.`;
    case 'livekit_unavailable':
      return 'A voz não está configurada nesta instância.';
    case 'no_recipient':
      return `${label} não encontrou ninguém disponível para receber a chamada.`;
    default:
      return `Não foi possível ligar para ${label}.`;
  }
}

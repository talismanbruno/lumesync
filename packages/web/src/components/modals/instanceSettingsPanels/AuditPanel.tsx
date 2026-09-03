import { useCallback, useEffect, useState } from 'react';
import type { AdminAuditLog } from '@backspace/shared';
import { api } from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';

const ACTION_LABELS: Record<string, string> = {
  'space.join_override': 'Entrou em servidor',
  'space.preview': 'Visualizou prévia do servidor',
  'space.transfer_owner': 'Trocou dono do servidor',
  'user.promote_admin': 'Promoveu a admin',
  'user.demote_admin': 'Removeu admin',
  'user.grant_beta_badge': 'Concedeu selo beta',
  'user.remove_beta_badge': 'Removeu selo beta',
  'user.reset_password': 'Redefiniu senha',
  'user.suspend': 'Suspendeu conta',
  'user.unsuspend': 'Reativou conta',
  'user.force_disconnect': 'Encerrou sessões',
  'user.delete': 'Excluiu conta',
};

export function AuditPanel() {
  const [events, setEvents] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const addToast = useUIStore((state) => state.addToast);
  const load = useCallback(async () => {
    setLoading(true);
    try { setEvents((await api.admin.auditLog(120)).events); }
    catch { addToast('Não foi possível carregar o histórico administrativo.', 'warning'); }
    finally { setLoading(false); }
  }, [addToast]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-base font-bold text-txt-primary">Histórico administrativo</h3><p className="mt-1 text-xs text-txt-tertiary">Registro das ações sensíveis realizadas pelos administradores.</p></div>
        <button onClick={() => void load()} className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-txt-secondary hover:text-txt-primary">Atualizar</button>
      </div>
      {loading && events.length === 0 && <div className="py-12 text-center text-sm text-txt-tertiary">Carregando histórico…</div>}
      {!loading && events.length === 0 && <div className="rounded-xl border border-border-subtle py-12 text-center text-sm text-txt-tertiary">Nenhuma ação registrada ainda.</div>}
      <div className="space-y-2">
        {events.map((event) => (
          <article key={event.id} className="rounded-xl border border-border-subtle bg-surface-secondary p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-xs text-txt-primary">{ACTION_LABELS[event.action] ?? event.action}</b><time className="text-[10px] text-txt-tertiary">{new Date(event.createdAt).toLocaleString('pt-BR')}</time></div>
            <div className="mt-1 text-[11px] text-txt-secondary">@{event.adminUsername ?? 'admin removido'} → {event.targetLabel || event.targetId}</div>
            {event.details && <div className="mt-1 text-[10px] text-txt-tertiary">{Object.entries(event.details).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</div>}
          </article>
        ))}
      </div>
    </div>
  );
}

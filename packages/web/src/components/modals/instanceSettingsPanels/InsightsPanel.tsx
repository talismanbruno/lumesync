import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminInsights, BugReportStatus } from '@backspace/shared';
import { api } from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';

const CATEGORY_LABELS: Record<string, string> = {
  call: 'Chamada', audio: 'Áudio', screen_share: 'Compartilhamento',
  messages: 'Mensagens', interface: 'Interface', other: 'Outro',
};

export function InsightsPanel() {
  const [data, setData] = useState<AdminInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useUIStore((state) => state.addToast);
  const regionNames = useMemo(() => {
    try { return new Intl.DisplayNames(['pt-BR'], { type: 'region' }); } catch { return null; }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.admin.insights()); }
    catch { addToast('Não foi possível carregar as métricas.', 'warning'); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { void load(); }, [load]);

  const updateReport = async (id: string, status: BugReportStatus) => {
    try {
      await api.admin.updateBugReport(id, status);
      setData((current) => current ? {
        ...current,
        bugReports: current.bugReports.map((report) => report.id === id
          ? { ...report, status, resolvedAt: status === 'resolved' ? Date.now() : null }
          : report),
        totals: { ...current.totals, openBugReports: current.bugReports.filter((report) => report.id !== id && report.status !== 'resolved').length + (status === 'resolved' ? 0 : 1) },
      } : current);
    } catch { addToast('Não foi possível atualizar o relato.', 'warning'); }
  };

  if (loading && !data) return <div className="py-16 text-center text-sm text-txt-tertiary">Carregando visão geral…</div>;
  if (!data) return <button onClick={load} className="text-sm text-accent-primary">Tentar novamente</button>;

  const cards = [
    ['Contas', data.totals.users, `+${data.totals.usersLast7Days} em 7 dias`],
    ['Online agora', data.totals.onlineUsers, 'presença atual'],
    ['Servidores', data.totals.spaces, 'criados nesta instância'],
    ['Mensagens', data.totals.messages, 'canais e conversas'],
    ['Reconexões', data.totals.voiceReconnectsLast24Hours, `${data.totals.voiceRecoveriesLast24Hours} recuperadas / 24h`],
    ['Quedas de call', data.totals.voiceDropsLast24Hours, 'últimas 24 horas'],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-txt-primary">Pulso do Lume</h3>
          <p className="mt-1 text-xs text-txt-tertiary">Uso, estabilidade das chamadas e feedback da comunidade.</p>
        </div>
        <button onClick={load} className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-txt-secondary hover:text-txt-primary">Atualizar</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value, detail]) => (
          <div key={label} className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-tertiary">{label}</div>
            <div className="mt-1 text-2xl font-bold text-txt-primary">{Number(value).toLocaleString('pt-BR')}</div>
            <div className="mt-1 text-[11px] text-txt-tertiary">{detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
          <h4 className="text-sm font-bold text-txt-primary">Regiões aproximadas</h4>
          <p className="mb-3 mt-1 text-[11px] text-txt-tertiary">Preenchido pela configuração regional do aparelho, sem armazenar IP.</p>
          {data.registrationsByRegion.length ? data.registrationsByRegion.map((item) => (
            <div key={item.label} className="flex justify-between border-t border-border-subtle/60 py-2 text-xs">
              <span className="text-txt-secondary">{regionNames?.of(item.label) ?? item.label}</span><b className="text-txt-primary">{item.count}</b>
            </div>
          )) : <div className="py-5 text-center text-xs text-txt-tertiary">As regiões aparecem quando as contas atuais abrirem esta versão.</div>}
        </section>
        <section className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
          <h4 className="text-sm font-bold text-txt-primary">Contas mais recentes</h4>
          <div className="mt-2 max-h-64 overflow-y-auto">
            {data.recentRegistrations.map((user) => (
              <div key={user.id} className="flex items-center justify-between border-t border-border-subtle/60 py-2">
                <div className="min-w-0"><div className="truncate text-xs font-semibold text-txt-primary">{user.displayName || user.username}</div><div className="text-[11px] text-txt-tertiary">@{user.username}</div></div>
                <div className="text-right text-[11px] text-txt-tertiary"><div>{user.countryCode ? regionNames?.of(user.countryCode) ?? user.countryCode : 'Região pendente'}</div><div>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between"><div><h4 className="text-sm font-bold text-txt-primary">Relatos de bugs</h4><p className="mt-1 text-[11px] text-txt-tertiary">{data.totals.openBugReports} aguardando conclusão</p></div></div>
        <div className="space-y-2">
          {data.bugReports.length === 0 && <div className="rounded-xl border border-border-subtle py-8 text-center text-xs text-txt-tertiary">Nenhum relato enviado ainda.</div>}
          {data.bugReports.map((report) => (
            <article key={report.id} className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="rounded-full bg-accent-primary/10 px-2 py-1 text-[10px] font-semibold text-accent-primary">{CATEGORY_LABELS[report.category]}</span><span className="text-[11px] text-txt-tertiary">@{report.username ?? 'conta removida'} · {new Date(report.createdAt).toLocaleString('pt-BR')}</span></div>
                <select value={report.status} onChange={(event) => void updateReport(report.id, event.target.value as BugReportStatus)} className="rounded-lg border border-border-subtle bg-surface-input px-2 py-1 text-[11px] text-txt-secondary">
                  <option value="open">Aberto</option><option value="reviewing">Em análise</option><option value="resolved">Resolvido</option>
                </select>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-txt-secondary">{report.description}</p>
              {report.diagnostics && <div className="mt-3 text-[10px] text-txt-tertiary">Diagnóstico: {Object.entries(report.diagnostics).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</div>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

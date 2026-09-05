import { useCallback, useEffect, useState } from 'react';
import type { AdminSystemHealth } from '@backspace/shared';
import { api } from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0]!;
  for (let index = 1; index < units.length && value >= 1024; index++) {
    value /= 1024;
    unit = units[index]!;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export function HealthPanel() {
  const [data, setData] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useUIStore((state) => state.addToast);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setData(await api.admin.systemHealth()); }
    catch { if (!quiet) addToast('Não foi possível consultar a saúde do Lume.', 'warning'); }
    finally { if (!quiet) setLoading(false); }
  }, [addToast]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading && !data) return <div className="py-16 text-center text-sm text-txt-tertiary">Consultando saúde do Lume…</div>;
  if (!data) return <button onClick={() => void load()} className="text-sm text-accent-primary">Tentar novamente</button>;

  const statusStyle = data.status === 'healthy'
    ? 'border-status-online/30 bg-status-online/10 text-status-online'
    : data.status === 'warning'
      ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
      : 'border-accent-rose/30 bg-accent-rose/10 text-accent-rose';
  const cards = [
    ['Usuários online', data.realtime.onlineUsers, `${data.realtime.connections} conexões abertas`],
    ['Calls ativas', data.realtime.voiceRooms, `${data.realtime.voiceParticipants} participantes`],
    ['Memória', `${data.memory.heapUsagePercent}%`, `${formatBytes(data.memory.heapUsedBytes)} de ${formatBytes(data.memory.heapLimitBytes)}`],
    ['Banco', data.database.status === 'ok' ? 'OK' : 'Erro', `${data.database.latencyMs} ms`],
    ['Disco', `${data.storage.diskUsagePercent}%`, `${formatBytes(data.storage.diskFreeBytes)} livres de ${formatBytes(data.storage.diskTotalBytes)}`],
    ['Uptime', formatUptime(data.uptimeSeconds), 'processo atual'],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-base font-bold text-txt-primary">Saúde operacional</h3><p className="mt-1 text-xs text-txt-tertiary">Atualização automática a cada 15 segundos.</p></div>
        <div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle}`}>{data.status === 'healthy' ? 'Saudável' : data.status === 'warning' ? 'Atenção' : 'Crítico'}</span><button onClick={() => void load()} className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-txt-secondary hover:text-txt-primary">Atualizar</button></div>
      </div>

      {data.alerts.length > 0 && <div className="space-y-2">{data.alerts.map((alert) => <div key={alert.code} className={`rounded-xl border p-3 text-xs ${alert.level === 'critical' ? 'border-accent-rose/30 bg-accent-rose/10 text-accent-rose' : 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'}`}>{alert.message}</div>)}</div>}
      {data.alerts.length === 0 && <div className="rounded-xl border border-status-online/20 bg-status-online/[0.06] p-3 text-xs text-status-online">Nenhum alerta ativo.</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value, detail]) => <div key={label} className="rounded-xl border border-border-subtle bg-surface-secondary p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-txt-tertiary">{label}</div><div className="mt-1 text-xl font-bold text-txt-primary">{value}</div><div className="mt-1 text-[10px] text-txt-tertiary">{detail}</div></div>)}
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface-secondary p-4">
        <h4 className="text-sm font-bold text-txt-primary">Calls nas últimas 24 horas</h4>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center"><div><b className="text-lg text-txt-primary">{data.last24Hours.voiceReconnects}</b><div className="text-[10px] text-txt-tertiary">reconexões</div></div><div><b className="text-lg text-status-online">{data.last24Hours.voiceRecoveries}</b><div className="text-[10px] text-txt-tertiary">recuperadas</div></div><div><b className="text-lg text-accent-rose">{data.last24Hours.voiceDrops}</b><div className="text-[10px] text-txt-tertiary">quedas</div></div></div>
      </section>

      <div className="text-right text-[9px] text-txt-tertiary">Consultado em {new Date(data.generatedAt).toLocaleTimeString('pt-BR')}</div>
    </div>
  );
}

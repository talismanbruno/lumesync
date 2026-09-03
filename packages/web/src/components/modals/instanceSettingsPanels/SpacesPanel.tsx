import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminSpacePreview, AdminSpaceSummary } from '@backspace/shared';
import { api } from '../../../api/client';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useUIStore } from '../../../stores/uiStore';

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Público',
  private: 'Privado',
  request: 'Por aprovação',
};

export function SpacesPanel() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<AdminSpaceSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminSpacePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const addToast = useUIStore((state) => state.addToast);
  const isMobile = useUIStore((state) => state.isMobile);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.admin.listSpaces();
      setSpaces(result.spaces);
    } catch {
      addToast('Não foi possível carregar os servidores.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return spaces;
    return spaces.filter((space) => [space.name, space.ownerUsername, space.ownerDisplayName, space.description]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalized)));
  }, [query, spaces]);

  const openSpace = async (space: AdminSpaceSummary) => {
    setJoiningId(space.id);
    try {
      if (!space.joined) {
        await api.admin.joinSpace(space.id);
        await useSpaceStore.getState().loadSpaces();
        setSpaces((current) => current.map((item) => item.id === space.id
          ? { ...item, joined: true, memberCount: item.memberCount + 1 }
          : item));
        addToast(`Você entrou em ${space.name} como admin.`, 'success');
      }
      useSpaceStore.getState().setCurrentSpace(space.id);
      if (isMobile) useUIStore.getState().setMobileTab('spaces');
      else useUIStore.getState().closeModal();
      navigate(`/channels/${space.id}`);
    } catch {
      addToast('Não foi possível entrar neste servidor.', 'warning');
    } finally {
      setJoiningId(null);
    }
  };

  const copyId = async (space: AdminSpaceSummary) => {
    await navigator.clipboard.writeText(space.id);
    addToast('ID do servidor copiado.', 'success');
  };

  const copyInvite = async (space: AdminSpaceSummary) => {
    setActionId(space.id);
    try {
      const { inviteCode } = await api.spaces.invite(space.id);
      await navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`);
      addToast('Link de convite copiado.', 'success');
    } catch {
      addToast('Este servidor não aceita convite direto.', 'warning');
    } finally { setActionId(null); }
  };

  const transferOwner = async (space: AdminSpaceSummary) => {
    const username = window.prompt(`Novo dono de ${space.name} (usuário que já participa do servidor):`);
    if (!username?.trim()) return;
    setActionId(space.id);
    try {
      const result = await api.admin.transferSpaceOwner(space.id, username.trim());
      setSpaces((current) => current.map((item) => item.id === space.id ? {
        ...item,
        ownerId: result.ownerId,
        ownerUsername: result.ownerUsername,
        ownerDisplayName: result.ownerDisplayName,
      } : item));
      addToast(`Dono de ${space.name} alterado.`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Não foi possível trocar o dono.', 'warning');
    } finally { setActionId(null); }
  };

  const showPreview = async (space: AdminSpaceSummary, channelId?: string) => {
    setPreviewLoading(true);
    try {
      setPreview(await api.admin.previewSpace(space.id, channelId));
    } catch {
      addToast('Não foi possível carregar a prévia do servidor.', 'warning');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (preview) {
    const categories = new Map(preview.categories.map((category) => [category.id, category.name]));
    const selected = preview.channels.find((channel) => channel.id === preview.selectedChannelId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setPreview(null)} className="rounded-lg border border-border-subtle px-3 py-2 text-xs text-txt-secondary hover:text-txt-primary">← Voltar</button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h3 className="truncate text-base font-bold text-txt-primary">Prévia · {preview.space.name}</h3><span className="rounded-full bg-accent-amber/10 px-2 py-0.5 text-[9px] font-semibold text-accent-amber">Somente leitura</span></div>
            <p className="text-[11px] text-txt-tertiary">Você não entrou no servidor e não aparece como membro.</p>
          </div>
          <button onClick={() => void openSpace(preview.space)} disabled={joiningId !== null} className="rounded-lg bg-accent-primary px-3 py-2 text-xs font-semibold text-surface-base disabled:opacity-50">{preview.space.joined ? 'Abrir' : 'Entrar'}</button>
        </div>

        <div className="grid min-h-[480px] overflow-hidden rounded-xl border border-border-subtle bg-surface-secondary md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="max-h-[62vh] overflow-y-auto border-b border-border-subtle bg-black/10 p-3 md:border-b-0 md:border-r">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-txt-tertiary">Canais · {preview.channels.length}</div>
            <div className="space-y-1">
              {preview.channels.map((channel) => (
                <button
                  key={channel.id}
                  disabled={channel.type !== 'text' || previewLoading}
                  onClick={() => void showPreview(preview.space, channel.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors disabled:cursor-default ${channel.id === preview.selectedChannelId ? 'bg-accent-primary/15 text-accent-primary' : channel.type === 'text' ? 'text-txt-secondary hover:bg-white/[0.05] hover:text-txt-primary' : 'text-txt-tertiary'}`}
                >
                  <div className="truncate">{channel.type === 'voice' ? '◖' : '#'} {channel.name}</div>
                  {channel.categoryId && <div className="mt-0.5 truncate text-[9px] text-txt-tertiary">{categories.get(channel.categoryId) ?? 'Sem categoria'}</div>}
                </button>
              ))}
            </div>
            <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-wider text-txt-tertiary">Membros · {preview.space.memberCount}</div>
            <div className="space-y-1">
              {preview.members.map((member) => <div key={member.id} className="truncate px-2 text-[11px] text-txt-secondary"><span className={member.status === 'offline' ? 'text-txt-tertiary' : 'text-status-online'}>●</span> {member.displayName || member.username}</div>)}
            </div>
          </aside>

          <section className="flex min-w-0 flex-col">
            <div className="border-b border-border-subtle px-4 py-3">
              <div className="text-sm font-semibold text-txt-primary">{selected ? `# ${selected.name}` : 'Sem canal de texto'}</div>
              {selected?.topic && <div className="mt-0.5 truncate text-[10px] text-txt-tertiary">{selected.topic}</div>}
            </div>
            <div className="max-h-[56vh] flex-1 space-y-1 overflow-y-auto p-3">
              {previewLoading && <div className="py-8 text-center text-xs text-txt-tertiary">Carregando mensagens…</div>}
              {!previewLoading && preview.messages.length === 0 && <div className="py-12 text-center text-xs text-txt-tertiary">Nenhuma mensagem recente neste canal.</div>}
              {!previewLoading && preview.messages.map((message) => (
                <article key={message.id} className="rounded-lg px-2 py-2 hover:bg-white/[0.025]">
                  <div className="flex flex-wrap items-baseline gap-2"><b className="text-xs text-txt-primary">{message.author.displayName || message.author.username}</b><span className="text-[9px] text-txt-tertiary">@{message.author.username} · {new Date(message.createdAt).toLocaleString('pt-BR')}{message.editedAt ? ' · editada' : ''}</span></div>
                  {message.content && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-txt-secondary">{message.content}</p>}
                  {message.attachments.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{message.attachments.map((attachment) => <a key={attachment.id} href={api.uploads.url(attachment.filename)} target="_blank" rel="noreferrer" className="rounded-md border border-border-subtle bg-black/10 px-2 py-1 text-[10px] text-accent-primary hover:underline">📎 {attachment.originalName}</a>)}</div>}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-txt-primary">Todos os servidores</h3>
          <p className="mt-1 text-xs text-txt-tertiary">Visão administrativa de toda a instância, inclusive servidores privados.</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-txt-secondary hover:text-txt-primary">Atualizar</button>
      </div>

      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.4a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z" />
        </svg>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar servidor ou dono" className="w-full rounded-xl border border-border-subtle bg-surface-input py-2.5 pl-10 pr-3 text-sm text-txt-primary outline-none placeholder:text-txt-tertiary focus:border-accent-primary" />
      </div>

      <div className="flex items-center justify-between text-[11px] text-txt-tertiary">
        <span>{filtered.length} de {spaces.length} servidores</span>
        <span>Acesso do dono da instância</span>
      </div>

      {loading && spaces.length === 0 && <div className="py-14 text-center text-sm text-txt-tertiary">Carregando servidores…</div>}
      {!loading && filtered.length === 0 && <div className="rounded-xl border border-border-subtle py-12 text-center text-sm text-txt-tertiary">Nenhum servidor encontrado.</div>}

      <div className="space-y-2">
        {filtered.map((space) => {
          const iconUrl = space.icon ? (space.icon.startsWith('http') ? space.icon : api.uploads.url(space.icon)) : null;
          return (
            <article key={space.id} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-secondary p-3">
              {iconUrl ? (
                <img src={iconUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: space.avatarColor || '#16b8d4' }}>
                  {space.name.trim().slice(0, 2).toUpperCase() || 'LS'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h4 className="truncate text-sm font-semibold text-txt-primary">{space.name}</h4>
                  <span className="shrink-0 rounded-full bg-accent-primary/10 px-2 py-0.5 text-[9px] font-semibold text-accent-primary">{VISIBILITY_LABELS[space.visibility] ?? space.visibility}</span>
                </div>
                <p className="truncate text-[11px] text-txt-tertiary">Dono: {space.ownerDisplayName || `@${space.ownerUsername}`} · {space.memberCount} membros · {space.channelCount} canais</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button onClick={() => void copyId(space)} className="text-[10px] text-txt-tertiary hover:text-txt-primary">Copiar ID</button>
                  {space.visibility !== 'request' && <button disabled={actionId !== null} onClick={() => void copyInvite(space)} className="text-[10px] text-txt-tertiary hover:text-txt-primary disabled:opacity-40">Copiar convite</button>}
                  <button disabled={actionId !== null} onClick={() => void transferOwner(space)} className="text-[10px] text-accent-amber hover:opacity-80 disabled:opacity-40">Trocar dono</button>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button disabled={previewLoading} onClick={() => void showPreview(space)} className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-txt-secondary hover:text-txt-primary disabled:opacity-50">{previewLoading ? 'Carregando…' : 'Prévia'}</button>
                <button disabled={joiningId !== null} onClick={() => void openSpace(space)} className="rounded-lg bg-accent-primary px-3 py-2 text-xs font-semibold text-surface-base transition-opacity hover:opacity-90 disabled:opacity-50">
                  {joiningId === space.id ? 'Entrando…' : space.joined ? 'Abrir' : 'Entrar'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

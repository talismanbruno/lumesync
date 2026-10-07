import { useCallback, useState } from 'react';
import type { MouseEvent } from 'react';
import { useContextMenuStore, type ContextMenuItem } from '../stores/contextMenuStore';
import { useSpaceStore, getChannelOrigin } from '../stores/spaceStore';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useUserBlockStore, contactIsBlocked } from '../stores/userBlockStore';
import { useDmPreferencesStore, dmPreferenceKey } from '../stores/dmPreferencesStore';
import { useUIStore } from '../stores/uiStore';
import { useVoiceStore } from '../stores/voiceStore';
import { canonicalUserMatch, isSelf, parseFederatedUsername } from '../utils/identity';
import { getCanonicalUserView } from '../utils/userViewLookup';
import { dmAccountKey, startDmCall } from '../utils/dmActions';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

function MenuIcon({ name }: { name: 'pin' | 'call' | 'friend' | 'block' | 'mute' | 'leave' }) {
  const paths = {
    pin: 'M8 3h8l-1 6 4 4v2H5v-2l4-4-1-6ZM12 15v6',
    call: 'M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z',
    friend: 'M15 21H3v-2a6 6 0 0 1 12 0v2M18 8h6M21 5v6',
    block: 'M5.6 5.6l12.8 12.8',
    mute: 'M4 4l16 16M9 5a4 4 0 0 1 7 3v4l3 5H8M5 9v3l-2 5h2M10 21h4',
    leave: 'M9 4H4v16h5M10 12h11M17 8l4 4-4 4',
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'friend' && <circle cx="9" cy="7" r="3" />}
    {name === 'block' && <circle cx="12" cy="12" r="9" />}
    <path d={paths[name]} />
  </svg>;
}

export function useDmContextMenu(onSelect: (id: string) => void, onLeave: (id: string) => void) {
  const [removal, setRemoval] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const handler = useCallback((event: MouseEvent, dmId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const dm = useSpaceStore.getState().dmChannels.find(channel => channel.id === dmId);
    if (!dm) return;
    const me = useAuthStore.getState().user;
    const rawPartner = dm.members.find(member => !isSelf(member, me));
    const partner = rawPartner ? getCanonicalUserView(rawPartner) : null;
    const account = dmAccountKey();
    const key = dmPreferenceKey(dm);
    const prefs = useDmPreferencesStore.getState().accounts[account];
    const blocked = contactIsBlocked(account, partner);
    const friends = useSocialStore.getState().friends;
    const friend = partner ? friends.find(value => canonicalUserMatch(value, partner)) : undefined;
    const request = partner ? useSocialStore.getState().requests.find(value => value.status === 'pending' && value.user && canonicalUserMatch(value.user, partner)) : undefined;
    const run = async (action: () => void | Promise<unknown>, success?: string) => {
      try { await action(); if (success) useUIStore.getState().addToast(success, 'success'); }
      catch (error) { useUIStore.getState().addToast(error instanceof Error ? error.message : 'Não foi possível concluir a ação.', 'warning'); }
    };
    const voice = useVoiceStore.getState();
    const items: ContextMenuItem[] = [
      { key: 'pin', type: 'action', label: prefs?.pinned.includes(key) ? 'Desafixar' : 'Fixar', icon: <MenuIcon name="pin" />, onClick: () => useDmPreferencesStore.getState().toggle(account, 'pinned', key) },
      { key: 'call', type: 'action', label: 'Iniciar chamada', icon: <MenuIcon name="call" />, disabled: blocked || !!partner?.isDeleted || !!voice.activeDmCall || !!voice.outgoingCall || !!voice.incomingCall, onClick: () => { void run(() => { startDmCall(dmId); onSelect(dmId); }); } },
    ];
    if (!dm.ownerId && partner && !partner.isDeleted) {
      items.push({ key: 'social-divider', type: 'separator' });
      if (friend) items.push({ key: 'unfriend', type: 'action', label: 'Desfazer amizade', icon: <MenuIcon name="friend" />, onClick: () => setRemoval({ id: friend.id, name: partner.displayName || partner.username }) });
      else items.push({ key: 'friend', type: 'action', label: request ? 'Pedido de amizade pendente' : 'Adicionar amigo', icon: <MenuIcon name="friend" />, disabled: blocked || !!request, onClick: () => {
        const { baseName, domain } = parseFederatedUsername(partner.username);
        const origin = getChannelOrigin(dmId);
        const home = partner.homeInstance || domain || (origin ? new URL(origin).host : '');
        const username = home && home !== window.location.host ? `${baseName}@${home.replace(/^https?:\/\//, '')}` : baseName;
        void run(() => useSocialStore.getState().sendFriendRequest(username), 'Pedido de amizade enviado.');
      } });
      items.push({ key: 'block', type: 'action', label: blocked ? 'Desbloquear' : 'Bloquear', icon: <MenuIcon name="block" />, danger: !blocked, onClick: () => { void run(() => useUserBlockStore.getState().setBlocked(account, getChannelOrigin(dmId), rawPartner!, !blocked), blocked ? 'Contato desbloqueado.' : 'Contato bloqueado.'); } });
    }
    items.push({ key: 'mute-divider', type: 'separator' }, { key: 'mute', type: 'action', label: prefs?.muted.includes(key) ? 'Ativar notificações' : 'Silenciar', icon: <MenuIcon name="mute" />, onClick: () => useDmPreferencesStore.getState().toggle(account, 'muted', key) });
    if (dm.ownerId) items.push({ key: 'leave-divider', type: 'separator' }, { key: 'leave-group', type: 'action', label: 'Sair do grupo', danger: true, icon: <MenuIcon name="leave" />, onClick: () => onLeave(dmId) });
    useContextMenuStore.getState().open({ x: event.clientX, y: event.clientY }, items);
  }, [onSelect, onLeave]);

  const confirmation = <ConfirmDialog isOpen={!!removal} onClose={() => { if (!removing) setRemoval(null); }} title="Desfazer amizade" description={`Desfazer sua amizade com ${removal?.name || 'este contato'}?`} confirmLabel="Desfazer amizade" variant="danger" loading={removing} onConfirm={async () => {
    if (!removal || removing) return;
    setRemoving(true);
    try { await useSocialStore.getState().removeFriend(removal.id); setRemoval(null); }
    catch (error) { useUIStore.getState().addToast(error instanceof Error ? error.message : 'Não foi possível desfazer a amizade.', 'warning'); }
    finally { setRemoving(false); }
  }} />;
  return { handleDmContextMenu: handler, dmMenuConfirmation: confirmation };
}

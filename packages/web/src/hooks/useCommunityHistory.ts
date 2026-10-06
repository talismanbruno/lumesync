import { useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSpaceStore } from '../stores/spaceStore';
import { useUIStore } from '../stores/uiStore';
import { PermissionBits, hasPermissionBit } from '../utils/permissions';

export function useCommunityHistory(spaceId?: string) {
  const channels = useSpaceStore(state => state.channels);
  const channelPermissions = useSpaceStore(state => state.channelPermissions);
  const spacePermissions = useSpaceStore(state => state.spacePermissions);
  const origins = useSpaceStore(state => state.channelOriginMap);
  const preload = useChatStore(state => state.preloadSpaceHistory);

  useEffect(() => {
    if (!spaceId || spaceId === '@me') return;
    const ids = channels.filter(channel => channel.spaceId === spaceId && origins.has(channel.id)
      && hasPermissionBit(channelPermissions.get(channel.id) ?? spacePermissions.get(spaceId),
        PermissionBits.VIEW_CHANNEL | PermissionBits.READ_MESSAGE_HISTORY))
      .map(channel => channel.id);
    if (!ids.length) return;
    const current = useChatStore.getState().currentChannelId;
    if (current && ids.includes(current)) {
      ids.splice(ids.indexOf(current), 1);
      ids.unshift(current);
    }
    const controller = new AbortController();
    void preload(ids, controller.signal).then(complete => {
      if (!complete && !controller.signal.aborted) {
        useUIStore.getState().addToast('Parte do histórico não pôde ser carregada. Reabra a comunidade para tentar novamente.', 'warning');
      }
    });
    return () => {
      controller.abort();
      useChatStore.setState({ historyChannels: new Set() });
    };
  }, [spaceId, channels, channelPermissions, spacePermissions, origins, preload]);
}

import { t as uiText } from '../../i18n';
import { VolumeControl } from '../ui/VolumeControl';
import React from 'react';
import type { User } from '@backspace/shared';
import type { ContextMenuItem } from '../../stores/contextMenuStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore, getChannelOrigin, getMyUserIdForOrigin } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useComposerStore } from '../../stores/composerStore';
import { getCanonicalUserView } from '../../utils/userViewLookup';
import { isSelf } from '../../utils/identity';
import { getActiveRoom, setCameraSubscription } from '../../hooks/useLiveKit';
import { handleMuteAction, handleDeafenAction } from '../../utils/voiceActions';
import { wsSend } from '../../hooks/useWebSocket';
import { hasPermissionBit, PermissionBits } from '../../utils/permissions';

/**
 * Build moderation context menu items for a voice user.
 * Called imperatively at right-click time (not during render).
 */
export function buildVoiceModMenuItems(targetUserId: string, channelId: string): ContextMenuItem[] {
  const { spacePermissions, channels, channelToSpaceMap } = useSpaceStore.getState();

  // Derive spaceId from the voice channel, NOT from UI navigation state.
  // On mobile, the user can navigate away from the space while still in voice.
  const derivedSpaceId = channelToSpaceMap.get(channelId);
  const myPerms = derivedSpaceId ? spacePermissions.get(derivedSpaceId) : undefined;
  const canMuteMembers = hasPermissionBit(myPerms, PermissionBits.MUTE_MEMBERS);
  const canDeafenMembers = hasPermissionBit(myPerms, PermissionBits.DEAFEN_MEMBERS);
  const canMoveMembers = hasPermissionBit(myPerms, PermissionBits.MOVE_MEMBERS);
  const canDisconnectMembers = hasPermissionBit(myPerms, PermissionBits.DISCONNECT_MEMBERS);

  if (!canMuteMembers && !canDeafenMembers && !canMoveMembers && !canDisconnectMembers) return [];

  const voiceOrigin = getChannelOrigin(channelId);
  const spaceId = derivedSpaceId;
  const otherVoiceChannels = channels.filter(c => c.type === 'voice' && c.id !== channelId && channelToSpaceMap.get(c.id) === spaceId);

  const items: ContextMenuItem[] = [];

  if (canMuteMembers) {
    items.push({
      key: 'space-mute',
      type: 'checkbox',
      label: "Silenciar voz no servidor",
      subscribe: useVoiceStore.subscribe,
      getChecked: () => useVoiceStore.getState().spaceMutedUserIds.has(`${spaceId}:${targetUserId}`),
      onChange: checked => wsSend({ type: 'voice_space_mute', userId: targetUserId, muted: checked }, voiceOrigin),
    });
  }

  if (canDeafenMembers) {
    items.push({
      key: 'space-deafen',
      type: 'checkbox',
      label: "Desativar áudio no servidor",
      subscribe: useVoiceStore.subscribe,
      getChecked: () => useVoiceStore.getState().spaceDeafenedUserIds.has(`${spaceId}:${targetUserId}`),
      onChange: checked => wsSend({ type: 'voice_space_deafen', userId: targetUserId, deafened: checked }, voiceOrigin),
    });
  }

  if (canDisconnectMembers) {
    items.push({ key: 'mod-sep', type: 'separator' });
    items.push({
      key: 'disconnect',
      type: 'action',
      label: "Desconectar da chamada",
      danger: true,
      icon: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor', className: 'flex-shrink-0' },
        React.createElement('path', { d: 'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 010-1.36C3.36 8.68 7.42 7 12 7s8.64 1.68 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z' }),
      ),
      onClick: () => wsSend({ type: 'voice_disconnect', userId: targetUserId }, voiceOrigin),
    });
  }

  if (canMoveMembers && otherVoiceChannels.length > 0) {
    items.push({ key: 'move-sep', type: 'separator' });
    items.push({
      key: 'move-to',
      type: 'submenu',
      label: "Mover para",
      icon: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor', className: 'flex-shrink-0' },
        React.createElement('path', { d: 'M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4h-6zM10 4H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3L10 4z' }),
      ),
      children: otherVoiceChannels.map(ch => ({
        key: ch.id,
        type: 'action' as const,
        label: ch.name,
        icon: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor', className: 'flex-shrink-0 text-txt-tertiary' },
          React.createElement('path', { d: 'M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C16.48 9.4 17 10.67 17 12S16.48 14.6 15.54 15.54L14.12 14.12C14.69 13.55 15 12.79 15 12S14.69 10.45 14.12 9.88L15.54 8.46Z' }),
        ),
        onClick: () => wsSend({ type: 'voice_move', userId: targetUserId, targetChannelId: ch.id }, voiceOrigin),
      })),
    });
  }

  return items;
}

/** One menu for participant tiles and voice-channel rows, including self and DM calls. */
export function buildVoiceParticipantMenuItems(
  userId: string,
  channelId: string | null,
  position: { x: number; y: number },
  knownUser?: User | null,
  local?: boolean,
): ContextMenuItem[] {
  const spaces = useSpaceStore.getState();
  const voice = useVoiceStore.getState();
  const participant = voice.participants.find(p => p.userId === userId);
  const candidate = knownUser
    ?? spaces.members.find(m => m.userId === userId)?.user
    ?? spaces.dmChannels.find(dm => dm.id === channelId)?.members.find(member => member.id === userId)
    ?? participant?.cachedUser;
  const user = candidate ? getCanonicalUserView(candidate) : null;
  const self = local ?? (
    userId === (channelId ? getMyUserIdForOrigin(getChannelOrigin(channelId)) : useAuthStore.getState().user?.id)
    || (user ? isSelf(user, useAuthStore.getState().user) : false)
  );
  const items: ContextMenuItem[] = [{
    key: 'participant-heading', type: 'custom', render: () => (
      <div className="px-3 py-2 border-b border-accent-mint/15 mb-1">
        <div className="text-[13px] font-semibold text-accent-mint truncate max-w-[230px]">
          {user?.displayName ?? user?.username ?? participant?.username ?? userId}
        </div>
        <div className="text-[11px] text-txt-tertiary">{self ? "Você na chamada" : "Participante da chamada"}</div>
      </div>
    ),
  }, {
    key: 'profile', type: 'action', label: "Ver perfil",
    onClick: () => {
      if (user) useUIStore.getState().openUserProfile(user, { top: position.y, left: position.x + 12 });
      else useUIStore.getState().openModal('userProfile', { userId });
    },
  }];

  const chatChannelId = useChatStore.getState().currentChannelId;
  const spaceId = channelId ? spaces.channelToSpaceMap.get(channelId) : undefined;
  const canMention = !self && chatChannelId && (
    chatChannelId === channelId || (spaceId && spaces.channelToSpaceMap.get(chatChannelId) === spaceId)
  );
  if (canMention) items.push({
    key: 'mention', type: 'action', label: "Mencionar",
    onClick: () => {
      const composer = useComposerStore.getState();
      const draft = composer.get(chatChannelId).draftText;
      composer.setDraft(chatChannelId, `${draft}${draft && !/\s$/.test(draft) ? ' ' : ''}<@${userId}> `);
      if (spaces.voiceChannelIds.has(chatChannelId)) useUIStore.setState({ voiceChatOpen: true });
    },
  });

  items.push({ key: 'audio-sep', type: 'separator' });
  if (self) {
    const enforced = () => {
      const current = useVoiceStore.getState();
      const key = `${spaceId}:${userId}`;
      return {
        muted: current.spaceMutedUserIds.has(key) || current.permissionMutedUserIds.has(key),
        deafened: current.spaceDeafenedUserIds.has(key),
      };
    };
    items.push({
      key: 'self-mute', type: 'checkbox', label: "Silenciar meu microfone",
      subscribe: useVoiceStore.subscribe,
      getChecked: () => useVoiceStore.getState().isMuted || useVoiceStore.getState().isDeafened || enforced().muted || enforced().deafened,
      onChange: checked => {
        const restrictions = enforced();
        if (restrictions.muted || restrictions.deafened) return;
        if (checked !== (useVoiceStore.getState().isMuted || useVoiceStore.getState().isDeafened)) handleMuteAction(false, false);
      },
    }, {
      key: 'self-deafen', type: 'checkbox', label: "Desativar meu áudio",
      subscribe: useVoiceStore.subscribe,
      getChecked: () => useVoiceStore.getState().isDeafened || enforced().deafened,
      onChange: checked => { if (checked !== useVoiceStore.getState().isDeafened) handleDeafenAction(enforced().deafened); },
    }, {
      key: 'edit-profile', type: 'action', label: "Editar meu perfil",
      onClick: () => useUIStore.getState().openModal('userSettings', { tab: 'account' }),
    });
  } else {
    items.push({
      key: 'mute-user', type: 'checkbox', label: "Silenciar para mim",
      subscribe: useVoiceStore.subscribe,
      getChecked: () => useVoiceStore.getState().participantMutes.get(userId) ?? false,
      onChange: checked => useVoiceStore.getState().setParticipantMute(userId, checked),
    }, {
      key: 'volume', type: 'custom', render: () => <VolumeSliderItem userId={userId} />,
    });
    if (participant?.isCameraOn) items.push({
      key: 'camera-toggle', type: 'checkbox', label: "Mostrar câmera",
      subscribe: useVoiceStore.subscribe,
      getChecked: () => !useVoiceStore.getState().unwatchedCameras.has(userId),
      onChange: checked => {
        if (checked) useVoiceStore.getState().rewatchCamera(userId);
        else useVoiceStore.getState().unwatchCamera(userId);
        setCameraSubscription(getActiveRoom(), participant.identity, checked);
      },
    });
    if (channelId) {
      const modItems = buildVoiceModMenuItems(userId, channelId);
      if (modItems.length) items.push({ key: 'moderation-sep', type: 'separator' }, ...modItems);
    }
  }
  items.push({ key: 'id-sep', type: 'separator' }, {
    key: 'copy-id', type: 'action', label: "Copiar ID do usuário",
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(userId);
        useUIStore.getState().addToast("ID copiado", 'success');
      } catch {
        useUIStore.getState().addToast("Não foi possível copiar o ID", 'warning');
      }
    },
  });
  return items;
}

// ── Shared custom menu item components ────────────────────────────────────

/**
 * Volume slider for a voice participant, used as a `custom` context menu item.
 * Must be a component (not a plain function) because it subscribes to store state.
 */
export function VolumeSliderItem({ userId }: { userId: string }) {
  const volume = useVoiceStore((s) => s.participantVolumes.get(userId) ?? 100);
  const setParticipantVolume = useVoiceStore((s) => s.setParticipantVolume);

  return (
    <div className="p-3">
      <VolumeControl label={uiText("Volume da pessoa")} value={volume} onChange={value => setParticipantVolume(userId, value)} />
    </div>
  );
}

import { useAuthStore } from '../stores/authStore';
import { useSpaceStore, getChannelOrigin } from '../stores/spaceStore';
import { useVoiceStore } from '../stores/voiceStore';
import { contactIsBlocked } from '../stores/userBlockStore';
import { useDmPreferencesStore, dmPreferenceKey } from '../stores/dmPreferencesStore';
import { isSelf } from './identity';
import { wsSend } from '../hooks/useWebSocket';

export function dmAccountKey() {
  const user = useAuthStore.getState().user;
  return user ? `${window.location.host}:${user.id}` : '';
}
export function dmAlertsSilenced(channelId: string | null | undefined): boolean {
  if (!channelId) return false;
  const dm = useSpaceStore.getState().dmChannels.find(channel => channel.id === channelId);
  if (!dm) return false;
  const muted = useDmPreferencesStore.getState().accounts[dmAccountKey()]?.muted || [];
  const partner = !dm.ownerId ? dm.members.find(member => !isSelf(member, useAuthStore.getState().user)) : null;
  return muted.includes(dmPreferenceKey(dm)) || contactIsBlocked(dmAccountKey(), partner);
}
export function startDmCall(dmId: string) {
  const dm = useSpaceStore.getState().dmChannels.find(channel => channel.id === dmId);
  const partner = dm?.members.find(member => !isSelf(member, useAuthStore.getState().user));
  if (!dm || (!dm.ownerId && (!partner || partner.isDeleted))) throw new Error('Essa conversa não está disponível para chamadas.');
  if (!dm.ownerId && contactIsBlocked(dmAccountKey(), partner)) throw new Error('Desbloqueie esse contato para iniciar uma chamada.');
  const voice = useVoiceStore.getState();
  if (voice.activeDmCall || voice.outgoingCall || voice.incomingCall) throw new Error('Você já tem uma chamada em andamento.');
  voice.setOutgoingCall({ dmChannelId: dmId });
  wsSend({ type: 'dm_call_start', dmChannelId: dmId }, getChannelOrigin(dmId));
}

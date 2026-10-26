import { SpotifyListeningStatus } from '../ui/SpotifyListeningStatus';
import { ProfileSocialLinks } from '../ui/ProfileSocialLinks';
import { useEffect, useRef, useState } from 'react';
import type { User, UserStatus } from '@backspace/shared';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useActivityStore } from '../../stores/activityStore';
import { copyText } from '../../utils/clipboard';
import { getPresenceLabel } from '../../utils/presenceLabels';
import { getAvatarGradient, adjustColor, mutedGradient } from '../../utils/gradients';
import { getProfileThemeStyle } from '../../utils/profileTheme';
import { resolveAvatarSource } from '../../utils/safeUrls';
import { Avatar } from '../ui/Avatar';
import { ProfileBanner } from '../ui/FlagCanvas';
import { ProfileName } from '../ui/ProfileName';
import { UserBadges } from '../ui/UserBadges';
import { ProfileCosmetics, ProfileFrameSpace } from '../ui/ProfileCosmetics';
import { ActivityCard } from '../ui/ActivityCard';

const PRESENCES: ReadonlyArray<readonly [UserStatus, string, string]> = [
  ['online', 'Disponível', 'Aberto para conversar'],
  ['working', 'Trabalhando no Lume', 'Melhorando o Lume'],
  ['idle', 'Ausente', 'Por perto'],
  ['dnd', 'Não perturbe', 'Silenciar alertas'],
  ['offline', 'Invisível', 'Aparecer offline'],
];

export function SelfProfileMenu({ user, onClose, onEdit }: { user: User; onClose: () => void; onEdit: () => void }) {
  const updateProfile = useAuthStore(state => state.updateProfile);
  const activities = useActivityStore(state => state.myActivities);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(user.customStatus ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); closeRef.current();
    };
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('keydown', escape, true);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  const gradient = getAvatarGradient(user.homeUserId ?? user.id, user.displayName || user.username, user.avatarColor);
  const fallback = user.accentColor ? mutedGradient(user.accentColor, adjustColor(user.accentColor, -40)) : mutedGradient(gradient.from, gradient.to);
  const banner = resolveAvatarSource(user.banner);
  const status = user.preferredStatus ?? user.status;
  const viewProfile = () => { onClose(); useUIStore.getState().openModal('userProfile', { userId: user.id, user, origin: '' }); };
  const save = async (patch: { status?: UserStatus; customStatus?: string }) => {
    setSaving(true); setError(null);
    try { await updateProfile(patch); setPresenceOpen(false); setStatusOpen(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar seu perfil.'); }
    finally { setSaving(false); }
  };
  const copyId = async () => {
    const copied = await copyText(user.homeUserId || user.id);
    useUIStore.getState().addToast(copied ? 'ID copiado' : 'Não foi possível copiar o ID', copied ? 'success' : 'warning');
  };

  return <div ref={root} tabIndex={-1} role="dialog" aria-label="Meu perfil e presença" className="lume-self-profile-menu">
    <ProfileFrameSpace customization={user.customization}>
      <section className="lume-self-profile-card" aria-label="Prévia do meu perfil" style={getProfileThemeStyle(user)}>
        <ProfileBanner className="lume-self-profile-banner" customization={user.customization} src={banner} fallback={fallback} />
        <div className="lume-self-profile-body">
          <div className="lume-self-profile-avatar-row">
            <button type="button" aria-label="Ver perfil completo" onClick={viewProfile}>
              <Avatar src={user.avatar} name={user.displayName || user.username} size={72} userId={user.id} avatarColor={user.avatarColor} customization={user.customization} status={user.status} statusLabel={status === 'offline' ? 'Invisível' : undefined} />
            </button>
            <button type="button" className="lume-self-status-bubble" onClick={() => { setDraftStatus(user.customStatus ?? ''); setStatusOpen(value => !value); }} aria-expanded={statusOpen}>{user.customStatus || '+ Adicionar status'}</button>
          </div>
          <div className="lume-self-profile-name"><ProfileName user={user}>{user.displayName || user.username}</ProfileName></div>
          <SpotifyListeningStatus user={user} />
          <div className="lume-self-profile-handle"><span>@{user.username}</span><UserBadges user={user} size={17} /></div>
          <ProfileSocialLinks user={user} />
          {user.bio && <p className="lume-self-profile-bio">{user.bio}</p>}
          {!!activities?.length && <div className="lume-self-profile-activity"><ActivityCard activities={activities} /></div>}
        </div>
        <ProfileCosmetics customization={user.customization} />
      </section>
    </ProfileFrameSpace>

    <div className="lume-self-profile-actions">
      <button type="button" onClick={onEdit}><span aria-hidden="true">✎</span>Editar perfil<span className="lume-self-action-arrow" aria-hidden="true">↗</span></button>
      <button type="button" aria-label={`Seu status: ${status === 'offline' ? 'Invisível' : getPresenceLabel(status)}`} aria-expanded={presenceOpen} onClick={() => setPresenceOpen(value => !value)}><span className={`lume-presence-dot lume-presence-${status}`} />{status === 'offline' ? 'Invisível' : getPresenceLabel(status)}<span className="lume-self-action-arrow" aria-hidden="true">{presenceOpen ? '⌃' : '›'}</span></button>
      {presenceOpen && <div className="lume-self-presences" role="group" aria-label="Escolher presença">{PRESENCES.filter(([value]) => value !== 'working' || user.isAdmin).map(([value, label, detail]) => <button type="button" key={value} aria-pressed={status === value} disabled={saving} onClick={() => void save({ status: value })}><span className={`lume-presence-dot lume-presence-${value}`} /><span><strong>{label}</strong><small>{detail}</small></span>{status === value && <span className="lume-self-action-arrow" aria-hidden="true">✓</span>}</button>)}</div>}
      <button type="button" aria-expanded={statusOpen} onClick={() => { setDraftStatus(user.customStatus ?? ''); setStatusOpen(value => !value); }}><span aria-hidden="true">◌</span>{user.customStatus ? 'Editar status personalizado' : 'Adicionar status personalizado'}</button>
      {statusOpen && <form className="lume-self-custom-status" onSubmit={event => { event.preventDefault(); void save({ customStatus: draftStatus.trim() }); }}><label>Seu status<input autoFocus aria-label="Status personalizado" maxLength={128} value={draftStatus} onChange={event => setDraftStatus(event.target.value)} placeholder="O que está acontecendo?" /></label><div><button type="button" disabled={saving} onClick={() => void save({ customStatus: '' })}>Limpar</button><button className="lume-customization-primary" disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar'}</button></div></form>}
      {error && <p role="alert" className="lume-customization-error">{error}</p>}
    </div>
    <div className="lume-self-profile-secondary"><button type="button" onClick={viewProfile}>Ver perfil completo<span aria-hidden="true">↗</span></button><button type="button" onClick={() => void copyId()}>Copiar ID do usuário<span aria-hidden="true">⧉</span></button></div>
  </div>;
}

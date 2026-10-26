import { ConnectedInstances } from '../ConnectedInstances';
import { useEffect, useState } from 'react';
import { PROFILE_LINK_PLATFORMS, normalizeProfileSocialLinks } from '@backspace/shared';
import type { ProfileSocialLink, ProfileLinkPlatform, SpotifyConnectionStatus } from '@backspace/shared';
import { useAuthStore } from '../../../stores/authStore';
import { api } from '../../../api/client';
import { isElectron } from '../../../platform/platform';
import { ProfileSocialLinks } from '../../ui/ProfileSocialLinks';
import { BrandIcon } from '../../ui/BrandIcon';

export function ConnectionsPanel() {
  const user = useAuthStore(state => state.user);
  const [links, setLinks] = useState<ProfileSocialLink[]>(() => user?.socialLinks ?? []);
  const [platform, setPlatform] = useState<ProfileLinkPlatform>('x');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [spotify, setSpotify] = useState<SpotifyConnectionStatus | null>(null);
  const [spotifyError, setSpotifyError] = useState('');
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const loadSpotify = () => api.spotify.status().then(setSpotify).catch(() => setSpotifyError('Não foi possível verificar a conexão. Tente novamente.'));
  useEffect(() => { void loadSpotify(); const listener = () => { void loadSpotify(); }; window.addEventListener('focus', listener); return () => window.removeEventListener('focus', listener); }, []);
  useEffect(() => { setLinks(user?.socialLinks ?? []); }, [user?.socialLinks]);
  const save = async (next: ProfileSocialLink[]) => {
    setBusy(true); setError(''); setMessage('');
    try { await useAuthStore.getState().updateProfile({ socialLinks: next }); setLinks(next); setMessage('Redes sociais atualizadas.'); return true; }
    catch { setError('Não foi possível salvar. Tente novamente.'); return false; }
    finally { setBusy(false); }
  };
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = normalizeProfileSocialLinks([...links.filter(link => link.platform !== platform), { platform, value }]);
    if (!next) { setError('Confira o endereço do seu perfil nessa rede.'); return; }
    if (await save(next)) setValue('');
  };
  const selected = PROFILE_LINK_PLATFORMS.find(item => item.id === platform)!;
  const spotifyAction = async (action: () => Promise<unknown>) => {
    setSpotifyBusy(true); setSpotifyError('');
    try { await action(); await loadSpotify(); }
    catch { setSpotifyError('Não foi possível atualizar a conexão com o Spotify. Tente novamente.'); }
    finally { setSpotifyBusy(false); }
  };
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary mb-6">Conexões</h2>
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 space-y-4">
        <div><h3 className="font-semibold text-txt-primary">Suas redes, no seu perfil</h3><p className="text-sm text-txt-tertiary mt-1">Adicione os perfis que você quer compartilhar com outras pessoas no Lume.</p></div>
        <form onSubmit={add} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="text-xs text-txt-secondary sm:w-40"><span className="inline-flex items-center gap-1.5"><BrandIcon platform={platform} size={14} />Rede social</span><select value={platform} onChange={event => { setPlatform(event.target.value as ProfileLinkPlatform); setValue(''); setError(''); }} className="mt-1 block w-full rounded-lg bg-surface-base border border-white/10 p-2 text-sm text-txt-primary">{PROFILE_LINK_PLATFORMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="flex-1 min-w-0 text-xs text-txt-secondary">{platform === 'epicgames' ? 'Nome de exibição' : 'Link ou usuário'}<input value={value} onChange={event => setValue(event.target.value)} placeholder={selected.placeholder} maxLength={512} autoComplete="off" className="mt-1 block w-full rounded-lg bg-surface-base border border-white/10 p-2 text-sm text-txt-primary" /></label>
          </div>
          {platform === 'epicgames' && <p className="text-xs text-txt-tertiary">Seu nome na Epic aparece no perfil para as pessoas encontrarem você.</p>}
          <button type="submit" disabled={busy || !value.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold bg-accent-primary text-black disabled:opacity-40">{busy ? 'Salvando…' : links.some(link => link.platform === platform) ? 'Atualizar rede' : 'Adicionar rede'}</button>
        </form>
        {links.length > 0 && <div className="space-y-2">{links.map(link => <div key={link.platform} className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 min-w-0 text-sm text-txt-secondary"><BrandIcon platform={link.platform} className="text-txt-primary" /><span className="truncate"><strong>{PROFILE_LINK_PLATFORMS.find(item => item.id === link.platform)!.label}</strong> · {link.value}</span></span><button type="button" disabled={busy} onClick={() => void save(links.filter(item => item.platform !== link.platform))} aria-label={'Remover ' + PROFILE_LINK_PLATFORMS.find(item => item.id === link.platform)!.label} className="text-xs text-txt-tertiary hover:text-red-300 p-2">Remover</button></div>)}</div>}
        <ProfileSocialLinks user={{ socialLinks: links }} />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      </section>
      <section className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.035] p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-txt-primary">O que você está ouvindo</h3><span className="inline-flex items-center gap-2 text-xs text-emerald-300"><BrandIcon platform="spotify" />Spotify</span></div>
        <p className="text-sm text-txt-tertiary">Mostre a música atual abaixo do seu nome nos perfis, contatos e conversas. Ela não aparece nas listas nem nas telas de chamada.</p>
        {!spotify && !spotifyError && <p role="status" className="text-xs text-txt-tertiary">Verificando conexão…</p>}
        {spotify && !spotify.available && <p className="text-xs text-txt-tertiary">A conexão automática com o Spotify ainda não está disponível. Você já pode adicionar o link do seu perfil acima.</p>}
        {spotify?.connected ? <>
          <label className="flex items-center gap-2 text-sm text-txt-secondary"><input type="checkbox" checked={spotify.showListening} disabled={spotifyBusy} onChange={event => void spotifyAction(() => api.spotify.setListening(event.target.checked))} />Exibir a música que estou ouvindo</label>
          <p className="text-xs text-txt-tertiary">Também respeita sua opção de exibir atividades e o modo invisível. Ao pausar a música, ela sai do perfil em alguns segundos.</p>
          <button type="button" disabled={spotifyBusy} onClick={() => void spotifyAction(() => api.spotify.disconnect())} className="text-sm text-red-300 hover:underline">Desconectar Spotify</button>
        </> : <button type="button" disabled={!spotify?.available || spotifyBusy} onClick={() => void spotifyAction(async () => { const { url } = await api.spotify.start(); if (isElectron()) window.open(url, '_blank', 'noopener,noreferrer'); else window.location.assign(url); })} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Conectar Spotify</button>}
        {spotifyError && <div role="alert" className="text-sm text-red-300">{spotifyError}<button type="button" onClick={() => { setSpotifyError(''); void loadSpotify(); }} className="ml-2 underline">Tentar novamente</button></div>}
      </section>
      <ConnectedInstances />
    </div>
  );
}

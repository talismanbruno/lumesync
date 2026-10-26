import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

const storageKey = 'lume.spotify.pending';
function pendingAuthorization(): { code: string; state: string; createdAt: number } | null {
  const params = new URLSearchParams(window.location.search);
  try {
    if (params.has('error')) { sessionStorage.removeItem(storageKey); return null; }
    const code = params.get('code'), state = params.get('state');
    if (code && state && code.length <= 2048 && /^[\w-]{43}$/.test(state) && params.getAll('code').length === 1 && params.getAll('state').length === 1) {
      const value = { code, state, createdAt: Date.now() };
      sessionStorage.setItem(storageKey, JSON.stringify(value));
      window.history.replaceState(window.history.state, '', window.location.pathname);
      return value;
    }
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (saved && typeof saved.code === 'string' && typeof saved.state === 'string' && Number.isFinite(saved.createdAt) && Date.now() - saved.createdAt < 10 * 60_000) return saved;
    sessionStorage.removeItem(storageKey);
  } catch { /* Storage may be unavailable: restart the connection in settings. */ }
  return null;
}
export function SpotifyCallbackPage() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const [pending] = useState(pendingAuthorization);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  if (!token && pending) return <Navigate to="/login?redirect=%2Fconnections%2Fspotify%2Fcallback" replace />;
  const complete = async () => {
    if (!pending || busy) return;
    setBusy(true); setError('');
    try { await api.spotify.complete(pending.code, pending.state); sessionStorage.removeItem(storageKey); setDone(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível conectar o Spotify.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-surface-base flex items-center justify-center p-6"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 space-y-5">
    <span className="text-xs font-semibold tracking-widest text-emerald-300">LUME + SPOTIFY</span>
    <h1 className="text-2xl font-bold text-txt-primary">{done ? 'Spotify conectado.' : 'Sua música, no seu perfil.'}</h1>
    <p className="text-sm leading-6 text-txt-secondary">{done ? 'Você já pode voltar ao Lume. A música aparece enquanto você ouve, com suas atividades visíveis. Para ocultar ou desconectar, abra Configurações → Conexões.' : pending ? 'Conclua a conexão' + (user ? ' para @' + user.username : '') + '. Use a mesma conta Lume que iniciou a autorização. Você pode desconectar a qualquer momento.' : 'A autorização foi cancelada ou expirou. Volte às conexões do Lume e tente novamente.'}</p>
    {!done && pending && <button type="button" disabled={busy} onClick={() => void complete()} className="w-full rounded-xl bg-emerald-400 p-3 font-semibold text-black disabled:opacity-50">{busy ? 'Conectando…' : 'Concluir conexão'}</button>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <Link className="block text-center text-sm text-txt-tertiary hover:text-txt-primary" to="/channels/@me">Voltar ao Lume</Link>
  </section></main>;
}

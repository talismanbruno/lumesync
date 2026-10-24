import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api, HttpError, RateLimitError } from '../../api/client';
import { DesktopDownloadLink } from './DesktopDownloadLink';
import { PasswordField } from './authFields';
import { appPath } from '../../utils/appRoutes';
import { DesktopBrowserLogin } from './DesktopBrowserLogin';
import { isElectron } from '../../platform/platform';

export function LoginPage() {
  const location = useLocation();
  const action = location.pathname === '/reset-password' ? 'reset' : location.pathname === '/verify-email' ? 'verify' : 'login';
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mailAvailable, setMailAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const [manualLogin, setManualLogin] = useState(false);
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const isAction = action !== 'login';
  const browserLogin = isElectron() && !manualLogin && !isAction && !recovering;

  useEffect(() => {
    if (!recovering) return;
    let active = true;
    api.auth.emailStatus().then(result => { if (active) setMailAvailable(result.available); }).catch(() => { if (active) setMailAvailable(false); });
    return () => { active = false; };
  }, [recovering]);
  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setTimeout(() => setRetryAfter(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [retryAfter]);
  // Keep the token in memory only; remove it from the address bar/history early.
  useEffect(() => {
    if (isAction && location.hash) window.history.replaceState(window.history.state, '', appPath(location.pathname) + location.search);
  }, [isAction, location.hash, location.pathname, location.search]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (action === 'reset' && (password.length < 8 || password.length > 1024)) { setError('Use uma senha com pelo menos 8 caracteres.'); return; }
    if (action === 'reset' && password !== confirmation) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true);
    try {
      if (action === 'verify') { await api.auth.verifyEmail(token); setDone(true); }
      else if (action === 'reset') { await api.auth.resetPassword(token, password); setDone(true); setPassword(''); setConfirmation(''); }
      else if (recovering) { await api.auth.forgotPassword(email.trim()); setDone(true); }
      else {
        await login(username.trim(), password);
        navigate(redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/channels/@me');
      }
    } catch (err) {
      if (err instanceof RateLimitError) setRetryAfter(err.retryAfter);
      else if (err instanceof HttpError && err.status === 401 && action === 'login' && !recovering) setError('Usuário ou senha incorretos. Confira os dados ou use “Esqueci minha senha”.');
      else if (err instanceof HttpError && err.status >= 500) setError('Não foi possível conectar ao Lume. Tente novamente em instantes.');
      else setError(err instanceof Error ? err.message : 'Não foi possível continuar. Tente novamente.');
    } finally { setBusy(false); }
  }

  const title = done ? (action === 'verify' ? 'E-mail confirmado' : action === 'reset' ? 'Senha atualizada' : 'Confira seu e-mail')
    : action === 'verify' ? 'Confirme seu e-mail' : action === 'reset' ? 'Crie uma nova senha' : recovering ? 'Esqueceu sua senha?' : 'Entre no Lume';
  const description = done ? (action === 'verify' ? 'Seu endereço já pode ser usado para recuperar sua conta.' : action === 'reset' ? 'Entre com sua nova senha. As sessões anteriores foram encerradas.' : 'Se este endereço estiver confirmado em uma conta, você receberá um link. Confira também a pasta de spam.')
    : action === 'verify' ? 'Confirme que este endereço é seu para proteger o acesso à sua conta.' : action === 'reset' ? 'Escolha uma senha que você ainda não usa em outros aplicativos.' : recovering ? 'Informe o e-mail de recuperação que você confirmou na sua conta.' : browserLogin ? 'Continue com a conta que você já usa no navegador.' : 'Use o usuário e a senha que você escolheu ao criar sua conta.';
  const noToken = isAction && !/^[a-f0-9]{64}$/.test(token);

  return <div className="h-full overflow-y-auto bg-surface-base">
    <main className="lume-auth-shell min-h-full flex items-center justify-center relative px-4 py-8">
      <div className="lume-auth-layout w-full max-w-[1040px] relative grid lg:grid-cols-[1.1fr_0.9fr] items-stretch">
        <section className="lume-auth-intro hidden lg:flex flex-col justify-between p-12 min-h-[610px]">
          <img src="/icons/logo-wordmark.png" alt="Lume" className="h-10 w-auto self-start object-contain" />
          <div><h2 className="text-[48px] leading-[1.06] font-bold tracking-[-0.045em] text-white">Suas conversas<br />merecem <span className="text-accent-primary">algo novo.</span></h2>
            <p className="mt-6 max-w-[360px] text-[15px] leading-7 text-txt-tertiary">A interface que você já conhece, com algo a mais. Voz, mensagens e personalização gratuita.</p></div>
          <p className="text-xs text-txt-tertiary">No navegador ou no aplicativo. Do seu jeito.</p>
        </section>
        <section className="lume-auth-card w-full bg-surface-elevated/90 border border-white/[0.06] rounded-2xl p-6 sm:p-9 shadow-elevation-high relative">
          <img src="/icons/logo-wordmark.png" alt="Lume" className="h-9 w-auto mx-auto mb-7 object-contain lg:hidden" />
          <header className="mb-7"><h1 className="text-[28px] font-bold tracking-tight text-txt-primary">{title}</h1><p className="text-sm leading-6 text-txt-tertiary mt-2">{description}</p></header>
          {done ? <div className="space-y-5"><div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 p-4 text-sm text-txt-secondary">{action === 'login' ? 'O link vale por 15 minutos e funciona uma única vez.' : 'Tudo certo. Você já pode continuar.'}</div>
            <Link to="/login" className="block text-center rounded-xl bg-accent-primary px-4 py-3 font-semibold text-black" onClick={() => { setDone(false); setRecovering(false); }}>Voltar para entrar</Link></div>
          : browserLogin ? <DesktopBrowserLogin redirect={redirect} onUsePassword={() => setManualLogin(true)} />
          : <form onSubmit={handleSubmit} className="space-y-5">
            {error && <p role="alert" className="p-3 rounded-lg bg-accent-rose/10 text-txt-danger text-sm">{error}</p>}
            {retryAfter > 0 && <p role="status" className="text-sm text-accent-amber">Muitas tentativas. Tente de novo em {retryAfter}s.</p>}
            {noToken ? <p role="alert" className="text-sm text-txt-secondary">Este link está incompleto. Solicite um novo link de recuperação ou confirmação.</p> : <>
              {!isAction && !recovering && <div><label htmlFor="login-username" className="block mb-2 text-sm font-semibold text-txt-secondary">Usuário</label>
                <input id="login-username" name="username" className="input-standard w-full py-3 text-base" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Seu nome de usuário" required autoFocus /></div>}
              {recovering && !isAction && <div><label htmlFor="recovery-email" className="block text-sm font-semibold text-txt-secondary mb-2">E-mail de recuperação</label><input id="recovery-email" className="input-standard w-full py-3 text-base" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="voce@exemplo.com" required autoFocus />
                {mailAvailable === false && <p role="status" className="mt-3 text-xs leading-5 text-accent-amber">O envio de e-mails ainda não está disponível. Tente novamente mais tarde.</p>}</div>}
              {(action === 'reset' || (!isAction && !recovering)) && <PasswordField id="login-password" label={action === 'reset' ? 'Nova senha' : 'Senha'} value={password} onChange={setPassword} creating={action === 'reset'} />}
              {action === 'reset' && <PasswordField id="confirm-password" label="Repita a nova senha" value={confirmation} onChange={setConfirmation} creating confirmation />}
              <button type="submit" disabled={busy || retryAfter > 0 || (recovering && mailAvailable === false)} className="w-full rounded-xl py-3 bg-accent-primary hover:bg-accent-primary/85 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{busy ? (action === 'login' && !recovering ? 'Entrando…' : 'Aguarde…') : action === 'verify' ? 'Confirmar meu e-mail' : action === 'reset' ? 'Salvar nova senha' : recovering ? 'Enviar link de recuperação' : 'Entrar'}</button>
            </>}
            {isAction ? <Link className="block text-sm text-accent-primary" to="/login">Voltar para entrar</Link> : <>
              {isElectron() && manualLogin && !recovering && <button type="button" className="block text-sm text-accent-primary hover:underline" onClick={() => setManualLogin(false)}>Continuar pelo navegador</button>}
              <button type="button" className="text-sm text-accent-primary hover:underline" onClick={() => { setRecovering(!recovering); setError(''); setDone(false); setPassword(''); }}>{recovering ? 'Voltar para entrar' : 'Esqueci minha senha'}</button>
              <p className="text-sm text-txt-tertiary">Ainda não tem uma conta? <Link to={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-accent-primary hover:underline">Criar conta</Link></p>
            </>}
          </form>}
          {!isAction && <DesktopDownloadLink />}
        </section>
      </div>
    </main>
  </div>;
}

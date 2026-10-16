import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { PasswordField } from '../../auth/authFields';

type EmailState = Awaited<ReturnType<typeof api.auth.recoveryEmail>>;
export function RecoveryEmailPanel() {
  const [state, setState] = useState<EmailState | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    api.auth.recoveryEmail().then(data => { if (active) { setState(data); setEmail(data.pendingEmail ?? data.email ?? ''); } }).catch(() => { if (active) setError('Não foi possível carregar o e-mail de recuperação.'); });
    return () => { active = false; };
  }, []);
  return <section className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-4">
    <div><h3 className="text-sm font-semibold text-txt-primary">E-mail de recuperação</h3><p className="mt-1 text-xs leading-5 text-txt-secondary">Recupere o acesso se esquecer sua senha. Seu endereço é privado e só funciona depois da confirmação.</p></div>
    {state?.email && <p className="text-xs text-accent-primary break-all">Confirmado: {state.email}</p>}
    {state?.pendingEmail && <p className="text-xs text-accent-amber break-all">Aguardando confirmação: {state.pendingEmail}</p>}
    {state && !state.available && <p className="text-xs text-txt-tertiary">Você pode salvar o endereço agora. O envio da confirmação ainda não está disponível.</p>}
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setError(''); setMessage('');
      try {
        const result = await api.auth.setRecoveryEmail({ email, password });
        setPassword('');
        setState(await api.auth.recoveryEmail());
        setMessage(result.sent ? 'Confirmação enviada. Confira sua caixa de entrada e o spam.' : state?.available ? 'Endereço salvo. Se acabou de pedir uma confirmação, aguarde um minuto antes de reenviar.' : 'Endereço salvo. Envie a confirmação quando o envio de e-mails estiver disponível.');
      } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o e-mail.'); }
      finally { setBusy(false); }
    }}>
      <div><label htmlFor="account-recovery-email" className="block text-sm text-txt-secondary mb-2">Endereço de e-mail</label><input id="account-recovery-email" type="email" maxLength={254} required autoComplete="email" className="input-standard w-full" value={email} onChange={event => setEmail(event.target.value)} /></div>
      <PasswordField id="recovery-current-password" label="Senha atual" value={password} onChange={setPassword} />
      <button disabled={busy || !state} className="px-4 py-2 rounded-lg bg-accent-primary text-black font-semibold text-sm disabled:opacity-50">{busy ? 'Salvando…' : state?.available ? 'Salvar e enviar confirmação' : 'Salvar endereço'}</button>
    </form>
    {error && <p role="alert" className="text-xs text-txt-danger">{error}</p>}{message && <p role="status" className="text-xs leading-5 text-accent-primary">{message}</p>}
  </section>;
}

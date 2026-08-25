import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api, RateLimitError } from '../../api/client';
import type { InstanceInfoResponse } from '@backspace/shared';
import { SourceCodeLink } from '../ui/SourceCodeLink';
import { DesktopDownloadLink } from './DesktopDownloadLink';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  // AGPL § 13: anonymous users must be able to reach the source of the running
  // version. Fetched from the unauthenticated public info endpoint.
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfoResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.instance.info()
      .then((info) => { if (!cancelled) setInstanceInfo(info); })
      .catch(() => { /* Non-critical — link is simply omitted if unreachable. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Informe seu usuário');
      return;
    }
    if (!password) {
      setError('Informe sua senha');
      return;
    }

    try {
      await login(username.trim(), password);
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        navigate(redirect);
      } else {
        navigate('/channels/@me');
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRetryAfter(err.retryAfter);
        setError('');
      } else {
        setError(err instanceof Error ? err.message : 'Não foi possível entrar');
      }
    }
  };

  const isDisabled = isLoading || retryAfter > 0;

  return (
    <div className="lume-auth-shell min-h-full flex items-center justify-center bg-surface-base relative overflow-hidden px-4 py-8">
      <div className="lume-auth-orbit lume-auth-orbit-a" />
      <div className="lume-auth-orbit lume-auth-orbit-b" />
      <div className="lume-auth-layout w-full max-w-[1040px] relative z-10 grid lg:grid-cols-[1.15fr_0.85fr] items-stretch">
        <section className="lume-auth-intro hidden lg:flex flex-col justify-between p-12 min-h-[600px]">
          <img src="/icons/logo-wordmark.png" alt="Lume" className="h-10 w-auto self-start object-contain" />
          <div>
            <span className="lume-auth-kicker">COMUNICAÇÃO EM ÓRBITA</span>
            <h2 className="mt-5 text-[44px] leading-[1.04] font-bold tracking-[-0.045em] text-white">
              Sua galera,<br /><span className="text-accent-primary">no mesmo ritmo.</span>
            </h2>
            <p className="mt-5 max-w-[430px] text-[15px] leading-7 text-txt-tertiary">
              Converse, compartilhe e entre em chamada num espaço leve, direto e feito para pertencer a vocês.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-txt-tertiary">
            <span className="lume-live-dot" />
            <span>Lume Orbital está online</span>
          </div>
        </section>

      <div className="lume-auth-card w-full max-w-[440px] lg:max-w-none bg-surface-elevated/90 border border-white/[0.06] rounded-2xl p-8 shadow-elevation-high relative backdrop-blur-xl">
        <div className="text-center mb-6">
          <img src="/icons/logo-wordmark.png" alt="Lume" className="h-10 w-auto mx-auto mb-6 object-contain lg:hidden" />
          <h1 className="text-2xl font-bold text-txt-primary">Bem-vindo de volta</h1>
          <p className="text-txt-tertiary mt-1">Sua galera está te esperando.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {retryAfter > 0 && (
            <div className="mb-4 p-3 bg-accent-amber/10 border border-accent-amber/30 rounded text-sm">
              <p className="font-medium text-accent-amber">Muitas tentativas de acesso</p>
              <p className="text-txt-secondary mt-0.5">Tente novamente em {retryAfter}s</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-accent-rose/10 border border-accent-rose/30 rounded text-txt-danger text-sm">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-xs font-bold text-txt-secondary uppercase mb-2">
              Usuário <span className="text-txt-danger">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-standard w-full py-2.5"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-txt-secondary uppercase mb-2">
              Senha <span className="text-txt-danger">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-standard w-full py-2.5"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            className="w-full py-2.5 bg-accent-primary hover:bg-accent-primary/80 text-white font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retryAfter > 0
              ? `Tente novamente em ${retryAfter}s`
              : isLoading
                ? 'Entrando...'
                : 'Entrar'}
          </button>

          <p className="mt-3 text-sm text-txt-tertiary">
            Ainda não tem uma conta?{' '}
            <Link to={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-accent-primary hover:underline">
              Criar conta
            </Link>
          </p>
          <DesktopDownloadLink />
        </form>

        {instanceInfo && (
          <div className="mt-6 pt-4 border-t border-white/[0.04] flex justify-center">
            <SourceCodeLink sourceCodeUrl={instanceInfo.sourceCodeUrl} version={instanceInfo.version} commit={instanceInfo.commit} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

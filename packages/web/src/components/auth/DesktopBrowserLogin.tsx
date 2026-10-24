import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { isElectron } from '../../platform/platform';
import { useAuthStore } from '../../stores/authStore';
import { createDesktopLoginAttempt, desktopApprovalUrl, desktopCallbackCode, type DesktopLoginAttempt } from '../../utils/desktopLogin';

export function DesktopBrowserLogin({ redirect, onUsePassword }: { redirect?: string | null; onUsePassword?: () => void }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'idle' | 'opening' | 'waiting' | 'exchanging'>('idle');
  const [error, setError] = useState('');
  const pending = useRef<DesktopLoginAttempt | null>(null);
  const generation = useRef(0);
  const start = useCallback(async () => {
    const current = ++generation.current;
    setPhase('opening'); setError('');
    try {
      const attempt = pending.current && pending.current.expiresAt > Date.now()
        ? pending.current : await createDesktopLoginAttempt();
      if (generation.current !== current) return;
      pending.current = attempt;
      window.open(desktopApprovalUrl(attempt), '_blank', 'noopener,noreferrer');
      setPhase('waiting');
    } catch {
      if (generation.current !== current) return;
      setPhase('idle'); setError('Não foi possível abrir a entrada pelo navegador. Tente novamente ou use sua senha.');
    }
  }, []);

  useEffect(() => {
    if (!isElectron()) return;
    const off = window.backspace!.onDeepLink(async url => {
      const attempt = pending.current;
      if (!attempt) return;
      const code = desktopCallbackCode(url, attempt);
      if (!code) return;
      const current = generation.current;
      pending.current = null;
      setPhase('exchanging'); setError('');
      try {
        const response = await api.auth.exchangeDesktop(code, attempt.verifier);
        if (generation.current !== current || useAuthStore.getState().token) return;
        useAuthStore.getState().initSession(response.token, response.user);
        navigate(redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/channels/@me', { replace: true });
      } catch {
        if (generation.current !== current) return;
        setPhase('idle'); setError('A autorização expirou ou não pôde ser concluída. Abra o navegador novamente.');
      }
    });
    return () => { off(); generation.current++; pending.current = null; };
  }, [navigate, redirect]);

  useEffect(() => {
    if (!isElectron()) return;
    // Only once per app window, never on each logout or form navigation.
    // Deferring also avoids duplicate external windows under React StrictMode.
    const timer = setTimeout(() => {
      if (sessionStorage.getItem('lume_browser_login_attempted')) return;
      sessionStorage.setItem('lume_browser_login_attempted', '1');
      void start();
    }, 150);
    return () => clearTimeout(timer);
  }, [start]);

  useEffect(() => {
    if (phase !== 'waiting' || !pending.current) return;
    const timer = setTimeout(() => {
      generation.current++; pending.current = null; setPhase('idle');
      setError('O pedido expirou. Clique para tentar novamente.');
    }, Math.max(0, pending.current.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [phase]);

  if (!isElectron()) return null;
  return <div className="mb-6 rounded-xl border border-accent-primary/25 bg-accent-primary/5 p-4 space-y-3">
    <p className="text-sm font-semibold text-txt-primary">Já está no Lume pelo navegador?</p>
    <p className="text-xs leading-5 text-txt-secondary">Continue com a conta que já está aberta, sem digitar a senha de novo.</p>
    <button type="button" onClick={() => void start()} disabled={phase === 'opening' || phase === 'exchanging'} className="w-full rounded-lg bg-accent-primary px-4 py-3 font-semibold text-black disabled:opacity-50">
      {phase === 'opening' ? 'Abrindo navegador…' : phase === 'exchanging' ? 'Entrando no aplicativo…' : phase === 'waiting' ? 'Abrir navegador novamente' : 'Continuar pelo navegador'}
    </button>
    {phase === 'waiting' && <p role="status" className="text-xs leading-5 text-txt-secondary">Estamos verificando sua sessão no navegador padrão. Se for solicitado, permita abrir o Lume. O aplicativo entra em seguida.</p>}
    {error && <p role="alert" className="text-xs leading-5 text-txt-danger">{error}</p>}
    <button type="button" className="text-xs text-txt-secondary underline" onClick={() => {
      generation.current++; pending.current = null; setPhase('idle'); setError('');
      onUsePassword?.();
    }}>Entrar com usuário e senha</button>
  </div>;
}

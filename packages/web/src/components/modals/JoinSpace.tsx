import { t as uiText } from '../../i18n';
import React, { useState, useEffect } from 'react';
import { useSpaceStore, NotConnectedError } from '../../stores/spaceStore';
import { useInstanceStore, DifferentPasswordError } from '../../stores/instanceStore';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { parseInviteInput } from '../../utils/inviteParser';

type JoinPhase = 'input' | 'connect' | 'fallback';

export function JoinSpaceForm({ onClose: closeModal, onBusyChange }: { onClose: () => void; onBusyChange: (busy: boolean) => void }) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<JoinPhase>('input');
  const [parsedCode, setParsedCode] = useState('');
  const [parsedOrigin, setParsedOrigin] = useState('');
  const [password, setPassword] = useState('');
  const [fallbackUsername, setFallbackUsername] = useState('');
  const [fallbackPassword, setFallbackPassword] = useState('');

  const joinByCode = useSpaceStore((s) => s.joinByCode);
  const connectToRemote = useInstanceStore((s) => s.connectToRemote);
  const loginToRemote = useInstanceStore((s) => s.loginToRemote);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    onBusyChange(isLoading);
    return () => onBusyChange(false);
  }, [isLoading, onBusyChange]);

  const joinAndNavigate = async (code: string, origin?: string) => {
    const space = await joinByCode(code, origin || undefined);
    closeModal();
    navigate(`/channels/${space.id}`);
  };

  // Phase 1: Submit invite code/URL
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let parsed: { code: string; origin?: string };
    try {
      parsed = parseInviteInput(inviteCode);
    } catch (err) {
      setError((err as Error).message);
      return;
    }

    setParsedCode(parsed.code);
    setParsedOrigin(parsed.origin || '');

    setIsLoading(true);
    try {
      await joinAndNavigate(parsed.code, parsed.origin);
    } catch (err) {
      if (err instanceof NotConnectedError) {
        setPhase('connect');
        setError('');
      } else {
        setError(err instanceof Error ? err.message : uiText("Failed to join space"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 2: Connect to remote instance with password, then join
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await connectToRemote(parsedOrigin, password, user?.displayName || undefined);
      await joinAndNavigate(parsedCode, parsedOrigin);
    } catch (err) {
      if (err instanceof DifferentPasswordError) {
        setPhase('fallback');
        setFallbackUsername(err.remoteUsername);
        setFallbackPassword('');
        setError('');
      } else {
        setError((err as Error).message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 3: Fallback login with different credentials, then join
  const handleFallbackLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await loginToRemote(parsedOrigin, fallbackUsername, fallbackPassword);
      await joinAndNavigate(parsedCode, parsedOrigin);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  let hostDisplay = '';
  try {
    if (parsedOrigin) hostDisplay = new URL(parsedOrigin).host;
  } catch { /* ignore */ }

  return (
    <>
      {/* Error display (shared across all phases) */}
      {error && (
        <div className="mb-3 p-2 bg-accent-rose/10 border border-accent-rose/30 rounded text-txt-danger text-sm">
          {error}
        </div>
      )}

      {phase === 'input' && (
        <div>
          <p className="text-txt-secondary text-sm mb-4">Cole o link do convite ou digite o código para entrar no servidor.</p>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="space-invite-code" className="block text-xs font-semibold text-txt-secondary mb-2">Link ou código do convite</label>
              <input
                id="space-invite-code"
                autoFocus
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="input-standard w-full"
                placeholder={uiText("e.g. abc123 or https://instance.com/join/abc123")}
              />
            </div>
            <div className="sticky bottom-0 z-10 pointer-events-none">
              <div className="flex justify-center pt-3 pb-1">
                <div className="glass-bubble rounded-full px-3 py-2 flex items-center gap-3 pointer-events-auto">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3 py-1 text-sm text-txt-tertiary hover:text-txt-secondary transition-colors"
                  >
                    {uiText("Cancel")}</button>
                  <button
                    type="submit"
                    disabled={isLoading || !inviteCode.trim()}
                    className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Entrando...' : 'Entrar no servidor'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Phase: connect — password prompt to connect to remote instance */}
      {phase === 'connect' && (
        <form onSubmit={handleConnect}>
          <input type="text" autoComplete="username" value={user?.username || ''} readOnly tabIndex={-1} className="sr-only" />
          <p className="text-txt-secondary text-sm mb-4">
            {uiText("Connect to ")}<span className="text-txt-primary font-medium">{hostDisplay}</span> {uiText(" to join this space.")}</p>
          <div className="mb-4 space-y-2">
            <div>
              <label className="block text-xs text-txt-tertiary mb-1">
                {uiText("Enter your password to connect")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={uiText("Your account password")}
                className="input-standard w-full"
                disabled={isLoading}
                autoFocus
                autoComplete="current-password"
              />
              <div className="text-xs text-txt-tertiary mt-1">
                {uiText("Your password is verified locally, then used to create or access your account on the remote instance.")}</div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 pointer-events-none">
            <div className="flex justify-center pt-3 pb-1">
              <div className="glass-bubble rounded-full px-3 py-2 flex items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => { setPhase('input'); setPassword(''); setError(''); }}
                  className="px-3 py-1 text-sm text-txt-tertiary hover:text-txt-secondary transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {uiText("Back")}</button>
                <div className="w-px h-5 bg-white/10" />
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1 text-sm text-txt-tertiary hover:text-txt-secondary transition-colors"
                >
                  {uiText("Cancel")}</button>
                <button
                  type="submit"
                  disabled={isLoading || !password}
                  className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-50"
                >
                  {isLoading ? uiText("Connecting...") : uiText("Connect & Join")}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Phase: fallback — different password on remote instance */}
      {phase === 'fallback' && (
        <form onSubmit={handleFallbackLogin}>
          <div className="mb-3 p-2 bg-accent-amber/10 border border-accent-amber/30 rounded text-xs text-accent-amber">
            {uiText("An account already exists on ")}{hostDisplay} {uiText(" with a different password. Enter the credentials you used on that instance.")}</div>
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-xs text-txt-tertiary mb-1">{uiText("Username")}</label>
              <input
                type="text"
                value={fallbackUsername}
                onChange={(e) => setFallbackUsername(e.target.value)}
                placeholder={uiText("Your username on this instance")}
                className="input-standard w-full"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs text-txt-tertiary mb-1">{uiText("Password for this instance")}</label>
              <input
                type="password"
                value={fallbackPassword}
                onChange={(e) => setFallbackPassword(e.target.value)}
                placeholder={uiText("Password on the remote instance")}
                className="input-standard w-full"
                disabled={isLoading}
                autoFocus
                autoComplete="current-password"
              />
            </div>
          </div>
          <div className="sticky bottom-0 z-10 pointer-events-none">
            <div className="flex justify-center pt-3 pb-1">
              <div className="glass-bubble rounded-full px-3 py-2 flex items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => { setPhase('connect'); setFallbackPassword(''); setError(''); }}
                  className="px-3 py-1 text-sm text-txt-tertiary hover:text-txt-secondary transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {uiText("Back")}</button>
                <div className="w-px h-5 bg-white/10" />
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1 text-sm text-txt-tertiary hover:text-txt-secondary transition-colors"
                >
                  {uiText("Cancel")}</button>
                <button
                  type="submit"
                  disabled={isLoading || !fallbackUsername || !fallbackPassword}
                  className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-50"
                >
                  {isLoading ? uiText("Logging in...") : uiText("Login & Join")}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

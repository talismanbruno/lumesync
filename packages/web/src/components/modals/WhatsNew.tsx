import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { usePortalContainer } from '../../hooks/usePortalContainer';
import { canonicalUserKey } from '../../utils/identity';
import { ReleaseHighlights } from './ReleaseHighlights';
import '../../styles/release-highlights.css';

export const WHATS_NEW_RELEASE = '2026-10-lume-personalizacao-completa';
const dismissedInSession = new Set<string>();

export function WhatsNew() {
  const user = useAuthStore((state) => state.user);
  const hasAuthenticatedSession = useAuthStore((state) => state.hasAuthenticatedSession);
  const activeModal = useUIStore((state) => state.activeModal);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const portal = usePortalContainer();
  const dialog = useRef<HTMLDivElement>(null);
  const key = user ? `lume:whats-new:${canonicalUserKey(user)}:${WHATS_NEW_RELEASE}` : null;
  const isOpen = activeModal === 'whatsNew' && !!user;

  useEffect(() => {
    if (!hasAuthenticatedSession || !key || activeModal || dismissedInSession.has(key)) return;
    try { if (localStorage.getItem(key) === 'seen') return; } catch { /* Session fallback below. */ }
    openModal('whatsNew');
  }, [hasAuthenticatedSession, key, activeModal, openModal]);

  const markSeen = useCallback(() => {
    if (key) {
      dismissedInSession.add(key);
      try { localStorage.setItem(key, 'seen'); } catch { /* Keep the dismissal for this session. */ }
    }
  }, [key]);
  const dismiss = useCallback(() => { markSeen(); closeModal(); }, [markSeen, closeModal]);
  const explore = () => { markSeen(); openModal('userSettings', { tab: 'profile' }); };

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
      if (event.key !== 'Tab') return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0]!, last = controls[controls.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [isOpen, dismiss]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/75" onClick={dismiss} aria-hidden="true" />
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="O que há de novo" tabIndex={-1} className="lume-whats-new relative glass-modal outline-none">
        <header className="lume-release-header">
          <div className="lume-release-eyebrow"><img src="/icons/logo.png" alt="" />O QUE HÁ DE NOVO · OUTUBRO 2026</div>
          <button type="button" aria-label="Fechar novidades" onClick={dismiss} className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/60 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
          <h1>Seu perfil ganhou <em>muito mais de você.</em></h1>
          <p>Do avatar ao cartão completo. Conheça a nova personalização do Lume.</p>
        </header>
        <ReleaseHighlights />
        <footer className="lume-release-footer"><span>Reveja as novidades no fim das configurações.</span><div><button type="button" className="lume-release-later" onClick={dismiss}>Agora não</button><button type="button" className="lume-release-explore" onClick={explore}>Explorar personalização</button></div></footer>
      </div>
    </div>, portal,
  );
}

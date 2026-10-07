import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { usePortalContainer } from '../../hooks/usePortalContainer';
import { canonicalUserKey } from '../../utils/identity';
import { getNameStyle } from '../../utils/nameAppearance';

export const WHATS_NEW_RELEASE = '2026-10-lume-personalidade';
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

  const dismiss = useCallback(() => {
    if (key) {
      dismissedInSession.add(key);
      try { localStorage.setItem(key, 'seen'); } catch { /* Keep the dismissal for this session. */ }
    }
    closeModal();
  }, [key, closeModal]);

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
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="lume-whats-new-title" tabIndex={-1}
        className="lume-whats-new relative w-full max-w-[680px] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[24px] glass-modal outline-none">
        <button type="button" aria-label="Fechar novidades" onClick={dismiss}
          className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/60 hover:text-white focus-visible:outline focus-visible:outline-cyan-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <header className="relative overflow-hidden border-b border-cyan-300/10 px-6 pb-7 pt-8 sm:px-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-cyan-300/10 bg-cyan-400/[0.035]" />
          <div className="relative mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-cyan-300/20 bg-cyan-400/[0.06]">
              <img src="/icons/logo.png" alt="" width="29" height="29" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">Lume · Outubro 2026</span>
          </div>
          <h1 id="lume-whats-new-title" className="relative text-[29px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">O que há de novo</h1>
          <p className="relative mt-2 max-w-[420px] text-[14px] leading-relaxed text-txt-secondary">Mais personalidade. Mais movimento. Mais do seu jeito.</p>
        </header>
        <div className="space-y-3 px-6 py-6 sm:px-9">
          <section className="rounded-[16px] border border-cyan-300/15 bg-cyan-400/[0.035] p-5">
            <div aria-hidden="true" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[18px] font-bold">
              <span className="text-white">Seu nome</span><span className="text-cyan-300">Seu nome</span><span className="text-violet-300">Seu nome</span><span style={getNameStyle({ nameColor: 'gold' })}>Seu nome</span>
            </div>
            <h2 className="text-[15px] font-semibold text-white">Uma cor para chamar de sua</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-txt-secondary">Escolha a cor do seu nome em Editar perfil. Ela acompanha você nas mensagens, chamadas e listas. Administradores também têm um dourado luminoso.</p>
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feature mark="01" title="Um perfil com mais vida">Seu perfil pode ter avatar e banner em GIF. Escolha uma arte em movimento e deixe sua identidade aparecer.</Feature>
            <Feature mark="02" title="Seu status fica com você">Escolheu Ausente, Não perturbe ou Invisível? O Lume lembra, mesmo depois de sair e entrar novamente.</Feature>
            <Feature mark="03" title="Tudo mais à mão">Clique com o botão direito em uma conversa ou participante da chamada para acessar perfil e ações rápidas. Fixe conversas, silencie e ajuste o áudio sem sair do lugar.</Feature>
            <Feature mark="04" title="O Lume ganhou movimento">Novas animações nos ícones, um feixe de luz no Início e transições mais suaves. Pequenos detalhes que dão vida ao app.</Feature>
          </div>
          <section className="flex gap-3 rounded-[14px] border border-white/[0.06] px-4 py-3">
            <span aria-hidden="true" className="pt-0.5 text-cyan-300">＋</span>
            <div><h2 className="text-[13px] font-semibold text-white">Criar ou entrar, no mesmo lugar</h2><p className="mt-1 text-[12px] leading-relaxed text-txt-secondary">Um único botão para criar uma comunidade ou entrar usando um link ou código de convite.</p></div>
          </section>
        </div>
        <footer className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-6 py-5 sm:px-9">
          <span className="text-[11px] text-txt-tertiary">Reveja as novidades nas configurações.</span>
          <button type="button" onClick={dismiss} className="shrink-0 rounded-xl bg-cyan-300 px-5 py-2.5 text-[13px] font-bold text-[#052329] transition-colors hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Bora usar</button>
        </footer>
      </div>
    </div>, portal,
  );
}

function Feature({ mark, title, children }: { mark: string; title: string; children: string }) {
  return <section className="rounded-[16px] border border-white/[0.06] bg-white/[0.015] p-4"><span aria-hidden="true" className="text-[10px] font-bold tracking-wider text-cyan-200/50">{mark}</span><h2 className="mt-2 text-[14px] font-semibold text-white">{title}</h2><p className="mt-1.5 text-[12px] leading-relaxed text-txt-secondary">{children}</p></section>;
}

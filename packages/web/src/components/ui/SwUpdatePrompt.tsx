import { t as uiText } from '../../i18n';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useVoiceStore } from '../../stores/voiceStore';
import { useTransferStore } from '../../stores/transferStore';
import { useEffect, useRef } from 'react';

function DesktopWorkerCleanup() {
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    let disposed = false;
    void navigator.serviceWorker.getRegistrations().then(registrations => {
      if (disposed) return;
      return Promise.all(registrations.filter(registration => {
        const worker = registration.active ?? registration.waiting ?? registration.installing;
        if (!worker) return false;
        const url = new URL(worker.scriptURL);
        return url.origin === location.origin && /^\/(?:app\/)?sw\.js$/.test(url.pathname);
      }).map(registration => registration.unregister()));
    }).catch(() => {});
    return () => { disposed = true; };
  }, []);
  return null;
}

export function SwAutoUpdate() {
  return window.backspace ? <DesktopWorkerCleanup /> : <BrowserUpdatePrompt />;
}

function BrowserUpdatePrompt() {
  const registered = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => { void registered.current?.update().catch(() => {}); }, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registered.current = registration ?? null;
    },
  });

  const voiceActive = useVoiceStore(state => Boolean(state.currentVoiceChannelId || state.activeDmCall || state.outgoingCall));
  const uploadActive = useTransferStore(state => [...state.transfers.values()].some(
    transfer => transfer.type === 'upload' && (transfer.state === 'queued' || transfer.state === 'active'),
  ));

  if (!needRefresh) return null;

  const busy = voiceActive || uploadActive;
  return (
    <div className="fixed bottom-6 left-6 z-[300] glass-pill rounded-xl px-4 py-3 flex items-center gap-3 max-w-[360px]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-txt-primary">{uiText("Atualização pronta")}</p>
        <p className="text-xs text-txt-secondary">
          {busy ? uiText("Finalize a chamada ou o envio antes de atualizar.") : uiText("Salve qualquer mensagem em edição antes de atualizar.")}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(uiText("Atualizar agora? Mensagens ainda não enviadas podem ser perdidas."))) {
            void updateServiceWorker(true);
          }
        }}
        className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary text-white disabled:opacity-50"
      >
        {uiText("Atualizar")}</button>
    </div>
  );
}

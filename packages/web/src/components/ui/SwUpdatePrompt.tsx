import { useRegisterSW } from 'virtual:pwa-register/react';
import { useVoiceStore } from '../../stores/voiceStore';
import { useTransferStore } from '../../stores/transferStore';

export function SwAutoUpdate() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update();
      }, 60_000);
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
        <p className="text-sm font-medium text-txt-primary">Atualização pronta</p>
        <p className="text-xs text-txt-secondary">
          {busy ? 'Finalize a chamada ou o envio antes de atualizar.' : 'Salve qualquer mensagem em edição antes de atualizar.'}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm('Atualizar agora? Mensagens ainda não enviadas podem ser perdidas.')) {
            void updateServiceWorker(true);
          }
        }}
        className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary text-white disabled:opacity-50"
      >
        Atualizar
      </button>
    </div>
  );
}

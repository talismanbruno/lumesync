import { t as uiText } from '../../i18n';
import { useState } from 'react';
import { useDesktopUpdateState } from '../../hooks/useDesktopUpdateState';
import { useVoiceStore } from '../../stores/voiceStore';

export function UpdateToast({ anchored = false }: { anchored?: boolean }) {
  const { updateState, updateVersion, updateProgress, lastUpdateError, checkForUpdates } = useDesktopUpdateState();
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return sessionStorage.getItem('lume-dismissed-update'); } catch { return null; }
  });
  const voiceActive = useVoiceStore(state => !!(state.currentVoiceChannelId || state.activeDmCall || state.outgoingCall));
  const ready = updateState === 'downloaded';
  const downloading = updateState === 'downloading';
  const failed = updateState === 'error';
  if (!window.backspace || !updateVersion || (!ready && !downloading && !failed) || dismissed === updateVersion) return null;
  const percent = Math.round(updateProgress?.percent ?? 0);
  const placement = anchored ? 'absolute bottom-full left-0 right-0 mb-2' : 'fixed bottom-6 left-6 right-6';
  return (
    <div className={placement + ' z-[300] animate-slide-up'}>
      <div className="glass-pill rounded-xl p-3 max-w-[340px] border border-accent-primary/30">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0" role="status" aria-live="polite">
            <p className="text-sm font-medium text-txt-primary">{uiText(failed ? 'Falha na atualização' : 'Atualização disponível')}</p>
            <p className="text-xs text-txt-secondary mt-1 break-words">
              {failed ? lastUpdateError?.message ?? uiText('Não foi possível baixar a atualização.')
                : ready ? uiText('A versão {0} está pronta para ser instalada.', [updateVersion])
                : uiText('Baixando a versão {0}… {1}%', [updateVersion, percent])}
            </p>
          </div>
          <button type="button" onClick={() => {
            setDismissed(updateVersion);
            try { sessionStorage.setItem('lume-dismissed-update', updateVersion); } catch { /* Storage is optional. */ }
          }} aria-label={uiText('Dismiss')}
            className="p-1 rounded text-txt-tertiary hover:text-txt-primary">×</button>
        </div>
        {downloading && <progress className="w-full h-1 mt-2 accent-purple-500" aria-label="Download da atualização" value={percent} max={100} />}
        {ready && <>
          {voiceActive && <p className="text-xs text-txt-secondary mt-2">{uiText('Finalize a chamada para reiniciar com segurança')}</p>}
          <button type="button" onClick={() => window.backspace?.installUpdate()} disabled={voiceActive}
            className="mt-2 w-full px-2 py-1.5 text-xs font-semibold rounded-lg bg-accent-primary text-white hover:bg-accent-primary/80 disabled:opacity-50">
            {uiText(voiceActive ? 'Em chamada' : 'Atualizar e reiniciar')}
          </button>
        </>}
        {failed && <button type="button" onClick={checkForUpdates} className="mt-2 text-xs text-accent-primary">{uiText('Tentar novamente')}</button>}
      </div>
    </div>
  );
}

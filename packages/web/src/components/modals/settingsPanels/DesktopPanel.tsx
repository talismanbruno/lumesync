import { t as uiText } from '../../../i18n';
import { useState, useEffect } from 'react';
import { Toggle } from '../../ui/Toggle';
import { getMacDownloads } from '../../../config/desktopDownloads';
import { useDesktopUpdateState } from '../../../hooks/useDesktopUpdateState';
import { useVoiceStore } from '../../../stores/voiceStore';

function AutoLaunchSettings() {
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [startMinimized, setStartMinimized] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.backspace?.getAutoLaunchSettings().then((settings) => {
      setOpenAtLogin(settings.openAtLogin);
      setStartMinimized(settings.startMinimized);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleOpenAtLoginChange = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await window.backspace!.setAutoLaunchSettings({ openAtLogin: enabled });
      setOpenAtLogin(result.openAtLogin);
      setStartMinimized(result.startMinimized);
    } catch (err) {
      console.error('[autoLaunch] setAutoLaunchSettings(openAtLogin) failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleStartMinimizedChange = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await window.backspace!.setAutoLaunchSettings({ startMinimized: enabled });
      setOpenAtLogin(result.openAtLogin);
      setStartMinimized(result.startMinimized);
    } catch (err) {
      console.error('[autoLaunch] setAutoLaunchSettings(startMinimized) failed:', err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <>
      <div className="flex items-center justify-between py-1">
        <div className="flex-1 mr-4">
          <div className="text-sm text-txt-primary">{uiText("Start at boot")}</div>
          <div className="text-xs text-txt-tertiary mt-0.5">
            {uiText("Abrir o Lume automaticamente ao entrar no sistema")}</div>
        </div>
        <Toggle enabled={openAtLogin} onChange={handleOpenAtLoginChange} disabled={busy} />
      </div>
      <div className="flex items-center justify-between py-1">
        <div className="flex-1 mr-4">
          <div className={`text-sm ${openAtLogin ? 'text-txt-primary' : 'text-txt-tertiary'}`}>{uiText("Start minimized")}</div>
          <div className="text-xs text-txt-tertiary mt-0.5">
            {uiText("Start hidden in the system tray instead of showing the window")}</div>
        </div>
        <Toggle enabled={startMinimized} onChange={handleStartMinimizedChange} disabled={busy || !openAtLogin} />
      </div>
    </>
  );
}

function UpdateSettings() {
  const [version, setVersion] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [checkExpired, setCheckExpired] = useState(false);
  const [runtime, setRuntime] = useState<{ platform: string; arch: string; translated: boolean; updatesSupported?: boolean } | null>(null);
  const { updateState, updateVersion, updateProgress, lastUpdateError, lastCheckResult, checkForUpdates } = useDesktopUpdateState(requested);
  const voiceActive = useVoiceStore(state => !!(state.currentVoiceChannelId || state.activeDmCall || state.outgoingCall));
  const supported = runtime?.updatesSupported ?? window.backspace?.platform === 'win32';

  useEffect(() => {
    void window.backspace?.getVersion?.().then(setVersion).catch(() => {});
    void window.backspace?.getRuntimeInfo?.().then(setRuntime).catch(() => {});
  }, []);

  useEffect(() => {
    if (!requested) return;
    if (updateState === 'downloading' || updateState === 'downloaded' || updateState === 'error' || lastCheckResult === 'up-to-date') {
      setRequested(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setRequested(false);
      setCheckExpired(true);
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [requested, updateState, lastCheckResult]);

  const checking = updateState === 'checking' || requested;
  const downloading = updateState === 'downloading';
  const ready = updateState === 'downloaded';
  const status = checkExpired ? uiText("A verificação demorou mais que o esperado.")
    : ready ? uiText("Versão {0} baixada", [updateVersion])
    : downloading ? uiText("Baixando a versão {0}… {1}%", [updateVersion, Math.round(updateProgress?.percent ?? 0)])
    : checking ? uiText("Checking...")
    : updateState === 'error' ? lastUpdateError?.message ?? uiText("Não foi possível verificar ou baixar a atualização.")
    : lastCheckResult === 'up-to-date' ? uiText("Você está usando a versão mais recente")
    : uiText("Check for new versions of the desktop app");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="flex-1 min-w-36">
        <div className="text-sm text-txt-primary">
          {version ? uiText("Versão {0}", [version]) : uiText("Lume Desktop")}
        </div>
        <div className="text-xs text-txt-tertiary mt-0.5" role="status">
          {ready && voiceActive ? uiText("Finalize a chamada para reiniciar com segurança") : status}
          {downloading && <progress className="block w-full h-1 mt-2 accent-purple-500" aria-label="Download da atualização nas configurações" value={updateProgress?.percent ?? 0} max={100} />}
        </div>
        {runtime?.platform === 'darwin' && <p className="text-xs text-txt-secondary mt-2">{runtime.translated ? 'Versão Intel via Rosetta. Seu Mac pode usar a versão nativa.' : runtime.arch === 'arm64' ? 'Apple Silicon · versão nativa' : 'Mac Intel · versão nativa'}</p>}
        {runtime?.translated && <a href={getMacDownloads()[0]!.url} className="inline-block text-xs text-accent-primary mt-2">Baixar versão Apple Silicon →</a>}
      </div>
      {supported ? (
        <button
          type="button"
          onClick={() => {
            if (ready) { window.backspace?.installUpdate(); return; }
            setCheckExpired(false);
            setRequested(true);
            checkForUpdates();
          }}
          disabled={checking || downloading || (ready && voiceActive)}
          className="px-3 py-1.5 text-sm text-txt-secondary hover:text-txt-primary bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
        >
          {ready ? uiText("Atualizar e reiniciar") : downloading ? uiText("Baixando atualização…") : checking ? uiText("Checking...") : uiText("Verificar atualizações")}
        </button>
      ) : (
        <a href="https://github.com/talismanbruno/lumesync/releases" target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm text-txt-secondary hover:text-txt-primary bg-white/[0.04] rounded-lg">
          {uiText("Ver versões disponíveis")}
        </a>
      )}
    </div>
  );
}

export function DesktopPanel() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary mb-6">{uiText("Desktop")}</h2>

      <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5 space-y-3">
        <AutoLaunchSettings />
        <UpdateSettings />

        <div className="border-t border-white/[0.04]" />

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-txt-primary font-medium">{window.location.origin}</div>
            <div className="text-xs text-txt-tertiary mt-0.5">{uiText("Currently connected instance")}</div>
          </div>
          <button
            onClick={() => window.backspace?.clearInstanceUrl()}
            className="px-3 py-1.5 text-sm text-txt-secondary hover:text-txt-primary bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            {uiText("Change Instance")}</button>
        </div>
      </div>
    </div>
  );
}

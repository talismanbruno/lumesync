import { t as uiText } from '../../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import type { AudioDevicesPermState } from '../../hooks/useAudioDevices';
import { OrbitalIcon } from '../ui/OrbitalIcon';
import { VolumeControl } from '../ui/VolumeControl';

interface AudioDevicePanelProps {
  kind: 'input' | 'output';
  deviceId: string;
  deviceLabel: string;
  devices: MediaDeviceInfo[];
  deviceLabels: Map<string, string>;
  permission: AudioDevicesPermState;
  requestPermission: () => Promise<void>;
  onSelectDevice: (id: string) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  level?: number;
  onClose: () => void;
  onSettings: () => void;
}

export function AudioDevicePanel({ kind, deviceId, deviceLabel, devices, deviceLabels, permission, requestPermission, onSelectDevice, volume, onVolumeChange, level, onClose, onSettings }: AudioDevicePanelProps) {
  const id = useId();
  const isInput = kind === 'input';
  const title = isInput ? 'Microfone' : 'Som da chamada';
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const triggerRef = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const deviceButtonRef = useRef<HTMLButtonElement>(null);
  const close = () => { onClose(); triggerRef.current?.focus(); };

  useEffect(() => { deviceButtonRef.current?.focus(); }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { onClose(); triggerRef.current?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);

  const allowDevices = async () => {
    setRequesting(true);
    setPermissionError(false);
    try { await requestPermission(); } catch { setPermissionError(true); } finally { setRequesting(false); }
  };

  return (
    <section className="lume-audio-popover absolute bottom-full left-2 right-2 mb-2 z-[160]" aria-labelledby={`${id}-title`}>
      <div className="flex items-center gap-2.5 p-3 border-b border-border-soft">
        <span className="lume-audio-mark"><OrbitalIcon name={isInput ? 'mic' : 'audio'} size={19} /></span>
        <div className="flex-1 min-w-0"><h3 id={`${id}-title`} className="text-[13px] font-semibold text-txt-primary">{title}</h3><p className="text-[10px] text-txt-tertiary">{isInput ? uiText("Sua voz na conversa") : uiText("O que você ouve")}</p></div>
        <button type="button" onClick={close} className="lume-audio-close" aria-label={uiText("Fechar opções de {0}", [title.toLowerCase()])}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="p-3 space-y-3">
        <button ref={deviceButtonRef} type="button" className="lume-audio-device" onClick={() => setDevicesOpen(open => !open)} aria-expanded={devicesOpen} aria-controls={`${id}-devices`}>
          <span className="min-w-0 text-left"><span className="block text-[9px] font-semibold text-txt-tertiary mb-1">{isInput ? uiText("Dispositivo de entrada") : uiText("Dispositivo de saída")}</span><span className="block truncate text-[12px] text-txt-primary">{deviceLabel}</span></span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-txt-tertiary transition-transform ${devicesOpen ? 'rotate-180' : ''}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {devicesOpen && (
          <div id={`${id}-devices`} className="lume-audio-device-list">
            {permission === 'granted' ? (
              <fieldset><legend className="sr-only">{isInput ? uiText("Escolher microfone") : uiText("Escolher saída de áudio")}</legend>
                {[{ deviceId: 'default', label: uiText("Padrão do sistema") }, ...devices.filter(device => device.deviceId !== 'default').map(device => ({ deviceId: device.deviceId, label: deviceLabels.get(device.deviceId) || device.label || device.deviceId }))].map(device => (
                  <label className={`lume-audio-device-option ${deviceId === device.deviceId ? 'is-selected' : ''}`} key={device.deviceId}>
                    <input type="radio" className="sr-only" name={`${id}-device`} value={device.deviceId} checked={deviceId === device.deviceId} onChange={() => { onSelectDevice(device.deviceId); setDevicesOpen(false); deviceButtonRef.current?.focus(); }} />
                    <span className="truncate">{device.label}</span><span className="lume-audio-device-dot" aria-hidden="true" />
                  </label>
                ))}
                {devices.length === 0 && <p className="px-2 py-1.5 text-[10px] text-txt-tertiary">{uiText("Nenhum dispositivo adicional encontrado.")}</p>}
              </fieldset>
            ) : (
              <div className="p-2 text-[11px] text-txt-secondary"><p>{permissionError || permission === 'denied' ? uiText("Acesso ao microfone bloqueado. Libere a permissão nas configurações do sistema ou navegador.") : uiText("Permita o acesso ao microfone para listar os dispositivos de áudio.")}</p>
                <button type="button" onClick={() => void allowDevices()} disabled={requesting} className="mt-2 rounded-lg bg-accent-primary/10 px-2.5 py-1.5 font-semibold text-accent-primary disabled:opacity-50">{requesting ? uiText("Aguardando…") : uiText("Permitir acesso")}</button>
              </div>
            )}
          </div>
        )}
        <VolumeControl label={isInput ? uiText("Volume do microfone") : uiText("Volume da chamada")} value={volume} onChange={onVolumeChange} level={isInput ? level : undefined} />
      </div>
      <button type="button" onClick={onSettings} className="lume-audio-settings w-full flex items-center gap-2 px-3 py-2.5 border-t border-border-soft text-[11px] font-medium text-txt-secondary">
        <OrbitalIcon name="tune" size={15} /><span className="flex-1 text-left">{uiText("Configurações de voz")}</span><span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}

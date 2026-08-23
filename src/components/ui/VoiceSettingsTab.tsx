import * as React from 'react';
import { Mic, RefreshCw, Speaker, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAudioPreferences,
  setAudioPreferences,
  type AudioPreferences
} from '@/lib/audioPreferences';

function PreferenceToggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-6 rounded-xl border border-white/5 bg-black/20 p-4 cursor-pointer hover:border-cyan-400/20 transition-colors">
      <span>
        <span className="block text-sm font-semibold text-zinc-100">{label}</span>
        <span className="block mt-1 text-xs text-zinc-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-400 shrink-0"
      />
    </label>
  );
}

export function VoiceSettingsTab() {
  const [preferences, setPreferences] = React.useState<AudioPreferences>(() => getAudioPreferences());
  const [inputs, setInputs] = React.useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = React.useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = React.useState(false);

  const save = (changes: Partial<AudioPreferences>) => {
    const next = setAudioPreferences(changes);
    setPreferences(next);
  };

  const loadDevices = React.useCallback(async (requestAccess = false) => {
    setLoadingDevices(true);
    let permissionStream: MediaStream | null = null;
    try {
      if (requestAccess) permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputs(devices.filter(device => device.kind === 'audioinput'));
      setOutputs(devices.filter(device => device.kind === 'audiooutput'));
    } catch {
      toast.error('Permita o acesso ao microfone para listar os dispositivos.');
    } finally {
      permissionStream?.getTracks().forEach(track => track.stop());
      setLoadingDevices(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDevices(false);
    const handleDeviceChange = () => void loadDevices(false);
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
  }, [loadDevices]);

  const enableDesktopNotifications = async (enabled: boolean) => {
    if (!enabled) {
      save({ desktopNotifications: false });
      return;
    }
    if (!('Notification' in window)) {
      toast.error('Este navegador não oferece notificações do sistema.');
      return;
    }
    const permission = await Notification.requestPermission();
    save({ desktopNotifications: permission === 'granted' });
    if (permission !== 'granted') toast.warning('A permissão de notificações não foi concedida.');
  };

  const testSound = () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(620, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
    oscillator.onended = () => void context.close();
  };

  return (
    <div className="max-w-2xl space-y-7 animate-in fade-in slide-in-from-right-3 duration-200">
      <div>
        <h2 className="text-2xl font-bold text-white">Voz, áudio e avisos</h2>
        <p className="mt-1 text-sm text-zinc-400">Escolha seus dispositivos e o comportamento das chamadas.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Dispositivos</h3>
          <button onClick={() => void loadDevices(true)} className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300">
            <RefreshCw size={13} className={loadingDevices ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300"><Mic size={15} /> Microfone</span>
          <select value={preferences.inputDeviceId} onChange={event => save({ inputDeviceId: event.target.value })} className="w-full rounded-xl border border-zinc-800 bg-[#09090b] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50">
            <option value="default">Padrão do sistema</option>
            {inputs.filter(device => device.deviceId !== 'default').map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfone ${index + 1}`}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300"><Speaker size={15} /> Saída de áudio</span>
          <select value={preferences.outputDeviceId} onChange={event => save({ outputDeviceId: event.target.value })} className="w-full rounded-xl border border-zinc-800 bg-[#09090b] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50">
            <option value="default">Padrão do sistema</option>
            {outputs.filter(device => device.deviceId !== 'default').map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Saída ${index + 1}`}</option>)}
          </select>
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tratamento do microfone</h3>
        <PreferenceToggle label="Supressão de ruído" description="Reduz ruído constante usando o processamento disponível no navegador." checked={preferences.noiseSuppression} onChange={checked => save({ noiseSuppression: checked })} />
        <PreferenceToggle label="Cancelamento de eco" description="Evita que o som da chamada volte pelo microfone." checked={preferences.echoCancellation} onChange={checked => save({ echoCancellation: checked })} />
        <PreferenceToggle label="Ganho automático" description="Equilibra automaticamente o volume da sua voz." checked={preferences.autoGainControl} onChange={checked => save({ autoGainControl: checked })} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Notificações</h3>
        <PreferenceToggle label="Sons de chamada" description="Toca avisos curtos para chamadas e eventos importantes." checked={preferences.callSounds} onChange={checked => save({ callSounds: checked })} />
        <PreferenceToggle label="Notificações do sistema" description="Avisa sobre chamadas quando o Lume estiver em segundo plano." checked={preferences.desktopNotifications} onChange={checked => void enableDesktopNotifications(checked)} />
        <button onClick={testSound} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400/30 hover:text-white transition-colors">
          <Volume2 size={14} /> Testar som
        </button>
      </section>
    </div>
  );
}


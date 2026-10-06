import { t as uiText } from '../../../i18n';
import { VolumeControl } from '../../ui/VolumeControl';
import { useVoiceStore } from '../../../stores/voiceStore';
import { Toggle } from '../../ui/Toggle';
import { VideoSection } from './VideoSection';
import { AudioInputSection } from './AudioInputSection';
import { AudioOutputSection } from './AudioOutputSection';

export function VoicePanel() {
  const echoCancellation = useVoiceStore((s) => s.echoCancellation);
  const autoGainControl = useVoiceStore((s) => s.autoGainControl);
  const rnnoiseEnabled = useVoiceStore((s) => s.rnnoiseEnabled);
  const setEchoCancellation = useVoiceStore((s) => s.setEchoCancellation);
  const setAutoGainControl = useVoiceStore((s) => s.setAutoGainControl);
  const setRnnoiseEnabled = useVoiceStore((s) => s.setRnnoiseEnabled);
  const soundEffectVolume = useVoiceStore((s) => s.soundEffectVolume);
  const setSoundEffectVolume = useVoiceStore((s) => s.setSoundEffectVolume);
  const messageSoundAllChannels = useVoiceStore((s) => s.messageSoundAllChannels);
  const setMessageSoundAllChannels = useVoiceStore((s) => s.setMessageSoundAllChannels);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary mb-6">{uiText("Voice & Video")}</h2>

      <AudioInputSection />
      <AudioOutputSection />

      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {uiText("Volume")}</div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5">
          <div className="py-1">
            <VolumeControl label={uiText("Volume dos efeitos sonoros")} value={soundEffectVolume} onChange={setSoundEffectVolume} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-txt-primary">{uiText("Play sound for every message")}</div>
              <div className="text-xs text-txt-tertiary">
                {uiText("Off (default): only DMs and messages that mention you. On: every channel.")}</div>
            </div>
            <Toggle enabled={messageSoundAllChannels} onChange={setMessageSoundAllChannels} />
          </div>
        </div>
      </div>

      <VideoSection />

      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {uiText("Voice Processing")}</div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-txt-primary">{uiText("AI Noise Suppression")}</div>
              <div className="text-xs text-txt-tertiary">{uiText("ML-based noise removal (RNNoise) — filters keyboard, fans, and background noise")}</div>
            </div>
            <Toggle enabled={rnnoiseEnabled} onChange={setRnnoiseEnabled} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-txt-primary">{uiText("Echo Cancellation")}</div>
              <div className="text-xs text-txt-tertiary">{uiText("Cancels echo from your speakers feeding back into the mic. Always on for voice channels and calls.")}</div>
            </div>
            <Toggle enabled={echoCancellation} onChange={setEchoCancellation} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-txt-primary">{uiText("Auto Gain Control")}</div>
              <div className="text-xs text-txt-tertiary">{uiText("Auto-adjusts mic volume — can cause voice ducking during streams")}</div>
            </div>
            <Toggle enabled={autoGainControl} onChange={setAutoGainControl} />
          </div>
        </div>
      </div>
    </div>
  );
}

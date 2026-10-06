import { t as uiText } from '../../i18n';
import { useId, type CSSProperties, type ReactNode } from 'react';

interface VolumeControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon?: ReactNode;
  level?: number;
}

/** One control for microphone gain, playback, participants and sound effects. */
export function VolumeControl({ label, value, onChange, icon, level }: VolumeControlProps) {
  const id = useId();
  const volume = Math.min(200, Math.max(0, value));
  const fill = { '--lume-volume-fill': `${volume / 2}%` } as CSSProperties;
  return (
    <div className="lume-volume-control">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-txt-tertiary shrink-0" aria-hidden="true">{icon}</span>}
        <label htmlFor={id} className="flex-1 text-[12px] font-semibold text-txt-primary">{label}</label>
        <output htmlFor={id} className={`lume-volume-value ${volume > 100 ? 'is-boosted' : ''}`}>{volume}%</output>
        <button type="button" onClick={() => onChange(100)} disabled={volume === 100}
          className="lume-volume-reset" title={uiText("Restaurar {0} para 100%", [label.toLowerCase()])} aria-label={uiText("Restaurar {0} para 100%", [label.toLowerCase()])}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10a8 8 0 1 1 .6 6M4 4v6h6" />
          </svg>
        </button>
      </div>
      <div className="relative">
        <input id={id} type="range" min={0} max={200} step={1} value={volume} onChange={event => onChange(Number(event.target.value))}
          aria-valuetext={`${volume}%`} className="lume-volume-slider w-full" style={fill} />
        <span className="lume-volume-reference" aria-hidden="true" />
      </div>
      <div className="flex justify-between text-[9px] text-txt-tertiary tabular-nums" aria-hidden="true"><span>0%</span><span>100%</span><span>200%</span></div>
      {level !== undefined && (
        <div className="lume-mic-level mt-3" role="meter" aria-label={uiText("Nível do microfone")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, Math.max(0, level)) * 100)}>
          {Array.from({ length: 24 }, (_, index) => <span key={index} className={index < Math.round(Math.min(1, Math.max(0, level)) * 24) ? 'is-active' : ''} aria-hidden="true" />)}
        </div>
      )}
    </div>
  );
}

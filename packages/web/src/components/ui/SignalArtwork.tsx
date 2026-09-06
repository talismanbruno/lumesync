import React from 'react';

/** A geometric conversation motif; purely decorative, with no animation or network assets. */
export function SignalArtwork({ variant = 'conversation' }: { variant?: 'conversation' | 'voice' }) {
  return (
    <div className={`lume-signal-art lume-signal-${variant}`} aria-hidden="true">
      <span className="lume-signal-grid" />
      <span className="lume-signal-card lume-signal-card-back"><i /><i /><i /></span>
      <span className="lume-signal-card lume-signal-card-front">
        {variant === 'voice' ? <span className="lume-signal-wave"><i /><i /><i /><i /><i /></span> : <span className="lume-signal-type">oi<span>.</span></span>}
      </span>
      <span className="lume-signal-caption">{variant === 'voice' ? 'MENOS DISTÂNCIA. MAIS VOZ.' : 'TODO MUNDO TEM ASSUNTO.'}</span>
    </div>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { isProfileFlagCountry, type ProfileCustomization, type ProfileFlagCountry } from '@backspace/shared';
import { attachFlagSurface } from '../../utils/flagRenderer';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export function FlagCanvas({ code, className = '', style }: { code?: string | null; className?: string; style?: CSSProperties }) {
  return isProfileFlagCountry(code) ? <FlagSurface key={code} code={code} className={className} style={style} /> : null;
}
function FlagSurface({ code, className, style }: { code: ProfileFlagCountry; className: string; style?: CSSProperties }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canvas.current) return;
    return attachFlagSurface(canvas.current, code, !reduced, () => setFailed(true));
  }, [code, reduced]);
  return failed
    ? <img className={className} style={style} src={`/previews/flags/${code}.svg`} alt="" aria-hidden="true" />
    : <canvas ref={canvas} className={className} style={style} aria-hidden="true" />;
}

export function ProfileBanner({ customization, src, fallback, className = '', style, children }: {
  customization?: ProfileCustomization | null; src?: string | null; fallback: string; className?: string; style?: CSSProperties; children?: ReactNode;
}) {
  return <div className={className} style={{ position: 'relative', ...(src ? { backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: fallback }), ...style }}>
    {customization?.bannerFlag && <FlagCanvas code={customization.bannerFlag} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit', pointerEvents: 'none' }} />}
    {children}
  </div>;
}

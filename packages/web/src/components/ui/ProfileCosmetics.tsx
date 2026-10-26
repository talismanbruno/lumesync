import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { CosmeticLayer, ProfileCustomization } from '@backspace/shared';
import { useCosmeticItem } from '../../stores/customizationStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { FlagCanvas } from './FlagCanvas';

/** Reserve the frame's painted overflow in normal layout so nearby labels remain readable. */
export function ProfileFrameSpace({ customization, children }: { customization?: ProfileCustomization | null; children: ReactNode }) {
  const frame = useCosmeticItem(customization?.profileFrameId);
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    if (!root.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) setWidth(entries[0].borderBoxSize?.[0]?.inlineSize || root.current?.getBoundingClientRect().width || entries[0].contentRect.width);
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const horizontal = frame?.overflowHorizontal || 0;
  const scale = width / ((frame?.frameWidth || 1200) + 2 * horizontal);
  const style: CSSProperties = frame ? {
    paddingTop: (frame.overflowTop || 0) * scale + 10,
    paddingBottom: (frame.overflowBottom || 0) * scale + 10,
    paddingInline: horizontal * scale + 2,
  } : {};
  return <div ref={root} className="lume-profile-frame-space" style={style}>{children}</div>;
}

function EffectLayer({ layer }: { layer: CosmeticLayer }) {
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const after = (duration: number, callback: () => void) => { const timer = setTimeout(() => { timers.delete(timer); if (!cancelled) callback(); }, duration); timers.add(timer); };
    const play = () => {
      setCycle(value => value + 1); setVisible(true);
      after(Math.max(1, layer.duration), () => { setVisible(false); if (layer.loop) after(Math.max(0, layer.loopDelay), play); });
    };
    after(Math.max(0, layer.start), play);
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [layer]);
  const sources = layer.randomizedSources?.length ? layer.randomizedSources : [layer.src];
  return visible ? <img key={cycle} src={sources[(cycle - 1) % sources.length]} alt="" aria-hidden="true" className="lume-profile-effect-layer" style={{ zIndex: layer.zIndex }} /> : null;
}

export function ProfileCosmetics({ customization, effects = true, replayKey = 0 }: { customization?: ProfileCustomization | null; effects?: boolean; replayKey?: number }) {
  const reducedMotion = useReducedMotion();
  const effect = useCosmeticItem(effects ? customization?.profileEffectId : undefined);
  const frame = useCosmeticItem(customization?.profileFrameId);
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    if (!root.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => { if (entries[0]) setWidth(entries[0].contentRect.width); });
    observer.observe(root.current); return () => observer.disconnect();
  }, []);
  const scale = width / (frame?.frameWidth || 1200);
  return <div ref={root} className="lume-profile-cosmetics" aria-hidden="true">
    {frame?.frameLayers?.map(layer => {
      const horizontal = (frame.overflowHorizontal || 0) * scale;
      const style: CSSProperties = { left: -horizontal, width: `calc(100% + ${horizontal * 2}px)`, zIndex: layer.order === 'front' ? 4 : 0 };
      if (layer.responsive && layer.type === 'rail') {
        const top = (frame.overflowTop || 0) * scale;
        const bottom = (frame.overflowBottom || 0) * scale;
        style.top = -top;
        style.height = `calc(100% + ${top + bottom}px)`;
      } else if (layer.anchor === 'top') style.top = -(frame.overflowTop || 0) * scale;
      else if (layer.anchor === 'bottom') style.bottom = -(frame.overflowBottom || 0) * scale;
      else { style.top = 0; style.height = '100%'; }
      return <img key={layer.id} src={layer.src} alt="" className={`lume-profile-frame-layer lume-profile-frame-${layer.type}`} style={style} />;
    })}
    {effects && !reducedMotion && effect?.layers?.map((layer, index) => <EffectLayer key={`${effect.id}-${index}-${replayKey}`} layer={layer} />)}
  </div>;
}

export function Nameplate({ id, flag, className = '' }: { id?: string | null; flag?: string | null; className?: string }) {
  const reducedMotion = useReducedMotion();
  if (flag) return <FlagCanvas code={flag} className={`lume-nameplate ${className}`} />;
  if (!id || !/^\d{1,24}$/.test(id)) return null;
  const src = `/api/customization/items/${id}/${reducedMotion ? 'static' : 'animated'}`;
  return <img key={src} src={src} alt="" aria-hidden="true" className={`lume-nameplate ${className}`} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />;
}

import { useEffect, useRef } from 'react';

/** Animate the glyph from its current pose, including a gentle interrupted return. */
export function useIconMotion(name: string) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!['plus', 'tune', 'hangup'].includes(name)) return;
    const svg = ref.current;
    const button = svg?.closest('button');
    const glyph = svg?.querySelector<SVGGElement>(`.lume-motion-${name}`);
    if (!button || !glyph || typeof glyph.animate !== 'function' || typeof window.matchMedia !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: Animation | undefined;
    let engaged = false;
    const clear = () => { animation?.cancel(); animation = undefined; engaged = false; };
    const play = () => {
      if (engaged || reduced.matches || button.disabled) return;
      engaged = true;
      const current = getComputedStyle(glyph).transform;
      animation?.cancel();
      const frames: Keyframe[] = name === 'hangup' ? [
        { transform: current, offset: 0, easing: 'cubic-bezier(.4, 0, .2, 1)' },
        { transform: 'translateY(-2px) rotate(-8deg)', offset: .28, easing: 'cubic-bezier(.35, 0, .2, 1)' },
        { transform: 'translateY(3px) rotate(0)', offset: .86, easing: 'ease-out' },
        { transform: 'translateY(2.5px) rotate(0)', offset: 1 },
      ] : [
        { transform: current, offset: 0, easing: 'cubic-bezier(.4, 0, .2, 1)' },
        { transform: 'rotate(96deg)', offset: .8, easing: 'ease-out' },
        { transform: 'rotate(90deg)', offset: 1 },
      ];
      animation = glyph.animate(frames, { duration: name === 'hangup' ? 1400 : 780, fill: 'forwards' });
    };
    const leave = () => {
      if (button.matches(':hover, :focus-visible') || !engaged) return;
      engaged = false;
      const current = getComputedStyle(glyph).transform;
      animation?.cancel();
      if (reduced.matches) return;
      const returning = glyph.animate([{ transform: current }, { transform: 'none' }], { duration: 600, easing: 'ease-in-out' });
      animation = returning;
      void returning.finished.then(() => {
        if (animation === returning) { returning.cancel(); animation = undefined; }
      }).catch(() => { /* A new hover or unmount can interrupt the return. */ });
    };
    const focus = () => { if (button.matches(':focus-visible')) play(); };
    button.addEventListener('pointerenter', play);
    button.addEventListener('pointerleave', leave);
    button.addEventListener('focus', focus);
    button.addEventListener('blur', leave);
    reduced.addEventListener('change', clear);
    return () => {
      clear();
      button.removeEventListener('pointerenter', play);
      button.removeEventListener('pointerleave', leave);
      button.removeEventListener('focus', focus);
      button.removeEventListener('blur', leave);
      reduced.removeEventListener('change', clear);
    };
  }, [name]);
  return ref;
}

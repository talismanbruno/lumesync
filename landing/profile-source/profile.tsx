import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { User, CosmeticItem } from '@backspace/shared';
import { CustomizationProfilePreview } from '../../packages/web/src/components/modals/settingsPanels/ProfileCustomizationEditor';
import { useCustomizationStore } from '../../packages/web/src/stores/customizationStore';
import '../../packages/web/src/styles/globals.css';
import '../../packages/web/src/styles/customization.css';
import './profile.css';
import data from './data.json';
import { MotionSuspendedContext } from '../../packages/web/src/hooks/useReducedMotion';

// Resolve against the iframe document so the same build works at /site/ and on Pages.
const localData = JSON.parse(JSON.stringify(data), (_key, value) =>
  typeof value === 'string' && value.startsWith('./') ? new URL(value, location.href).href : value);
const items = localData.items as CosmeticItem[];
useCustomizationStore.setState({ items, byId: new Map(items.map(item => [item.id, item])), loaded: true, loading: false, error: null });
const user = localData.user as User;

export function Showcase() {
  const [animated, setAnimated] = useState(window.self === window.top && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const onControl = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'lume-profile-control') return;
      setAnimated(event.data.animated === true);
      if (event.data.replay === true) setCycle(value => value + 1);
    };
    addEventListener('message', onControl);
    let previousHeight = 0;
    let fontsReady = false;
    let active = true;
    const report = () => {
      if (!fontsReady || !active) return;
      const height = Math.ceil(document.querySelector('#root')!.getBoundingClientRect().height);
      if (height === previousHeight) return;
      previousHeight = height;
      parent.postMessage({ type: 'lume-profile-size', height }, location.origin);
    };
    const observer = new ResizeObserver(report);
    observer.observe(document.querySelector('#root')!);
    document.fonts.ready.then(() => { fontsReady = true; report(); });
    parent.postMessage({ type: 'lume-profile-ready' }, location.origin);
    return () => { active = false; removeEventListener('message', onControl); observer.disconnect(); };
  }, []);
  return <MotionSuspendedContext.Provider value={!animated}><div className="lume-customization-editor live-profile-root" data-motion={animated ? 'playing' : 'paused'}>
    <CustomizationProfilePreview effectReplayKey={cycle} user={user} avatarSrc={user.avatar} bannerSrc={animated ? user.banner : new URL('./banner-still.webp', location.href).href} bannerFallback="#08101e" />
  </div></MotionSuspendedContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Showcase />);

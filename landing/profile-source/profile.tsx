import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { User, CosmeticItem } from '@backspace/shared';
import { CustomizationProfilePreview } from '../../packages/web/src/components/modals/settingsPanels/ProfileCustomizationEditor';
import { useCustomizationStore } from '../../packages/web/src/stores/customizationStore';
import '../../packages/web/src/styles/globals.css';
import '../../packages/web/src/styles/customization.css';
import './profile.css';
import data from './data.json';

// Resolve against the iframe document so the same build works at /site/ and on Pages.
const localData = JSON.parse(JSON.stringify(data), (_key, value) =>
  typeof value === 'string' && value.startsWith('./') ? new URL(value, location.href).href : value);
const items = localData.items as CosmeticItem[];
useCustomizationStore.setState({ items, byId: new Map(items.map(item => [item.id, item])), loaded: true, loading: false, error: null });
const user = localData.user as User;

function Showcase() {
  const [animated, setAnimated] = useState(window.self === window.top && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const onControl = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'lume-profile-control') return;
      setAnimated(event.data.animated === true);
      if (event.data.replay === true) setCycle(value => value + 1);
    };
    addEventListener('message', onControl);
    const report = () => parent.postMessage({ type: 'lume-profile-size', height: Math.ceil(document.querySelector('#root')!.getBoundingClientRect().height) }, location.origin);
    const observer = new ResizeObserver(report);
    observer.observe(document.querySelector('#root')!);
    report();
    parent.postMessage({ type: 'lume-profile-ready' }, location.origin);
    return () => { removeEventListener('message', onControl); observer.disconnect(); };
  }, []);
  return <div className="lume-customization-editor live-profile-root">{animated
    ? <CustomizationProfilePreview key={cycle} user={user} avatarSrc={user.avatar} bannerSrc={user.banner} bannerFallback="#08101e" />
    : <img className="profile-poster" src="./poster.webp" alt="Perfil de demonstração Lume Studio com banner, cristais, decoração de avatar e cores personalizadas." />}</div>;
}
createRoot(document.getElementById('root')!).render(<Showcase />);

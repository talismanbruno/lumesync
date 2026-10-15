import { useEffect, useState } from 'react';
import type { ProfileCustomization } from '@backspace/shared';
import { Avatar } from '../ui/Avatar';
import { FlagCanvas, ProfileBanner } from '../ui/FlagCanvas';
import { Nameplate, ProfileCosmetics, ProfileFrameSpace } from '../ui/ProfileCosmetics';
import { useCustomizationStore } from '../../stores/customizationStore';
import { getNameStyle } from '../../utils/nameAppearance';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// These are existing library selections, rendered by the same components as profiles.
const ART = {
  wave: '1466980253741092936', amethyst: '1432550258256121966',
  mainFrame: '1484726324580061191', frame: '1519072339185369239',
  effect: '1232073286582538261', plate: '1432550258357043320', secondPlate: '1382845914192023632',
  banner: '/api/customization/assets/c3/c324355c6e3538e473248d5094945890b1711b17c8fe9a04278b1409e41a6dbb.png',
  effectStill: '/api/customization/assets/a0/a0c3e765d82b2439942b3495a5ad136ed153a4a6b27011fb92c741f01bca1b92.png',
} as const;
const NAME: ProfileCustomization = { nameFont: 'Tempo', nameEffect: 'gradient', nameColors: ['#e2c6ff', '#8bdeff'] };
const FEATURES = [
  { id: 'avatar', title: 'Decorações de avatar', description: 'A onda luminosa e outras molduras para o seu avatar.' },
  { id: 'effect', title: 'Efeitos de perfil', description: 'Animações que acontecem sobre o seu cartão.' },
  { id: 'frame', title: 'Molduras do cartão', description: 'Arte que envolve o perfil completo.' },
  { id: 'banner', title: 'Banners e bandeiras', description: 'GIFs e bandeiras com o tecido ondulando.' },
  { id: 'plate', title: 'Placas de identificação', description: 'Fundos animados para destacar o seu nome.' },
  { id: 'name', title: 'Estilos de nome', description: 'Fontes, cores, degradês e efeitos de brilho.' },
] as const;
type FeatureId = typeof FEATURES[number]['id'];

function ReleaseProfileCard({ customization, banner, miniature = false }: {
  customization: ProfileCustomization; banner?: string; miniature?: boolean;
}) {
  return <ProfileFrameSpace customization={customization}>
    <article className={`lume-release-profile${miniature ? ' lume-release-mini-profile' : ''}`} aria-label={miniature ? 'Exemplo de moldura do cartão' : 'Prévia completa da personalização'}>
      <ProfileBanner className="lume-release-banner" src={banner} customization={customization} fallback="#292044" />
      <div className="lume-release-profile-body">
        <Avatar name="Lume Studio" size={miniature ? 30 : 76} avatarColor="lavender" customization={customization} status={miniature ? null : 'online'} />
        <div className="lume-release-profile-name lume-nameplate-host"><Nameplate id={customization.nameplateId} /><span style={getNameStyle({ customization })}>Lume Studio</span></div>
        <p className="lume-release-handle">@lume_studio</p>
        <p className="lume-release-bio">Seu perfil, do seu jeito.</p>
      </div>
      <ProfileCosmetics customization={customization} />
    </article>
  </ProfileFrameSpace>;
}

function ReleaseFeatureArt({ id }: { id: FeatureId }) {
  const reduced = useReducedMotion();
  if (id === 'avatar') return <div className="lume-release-avatar-samples"><Avatar name="Lume" size={52} avatarColor="sky" customization={{ avatarDecorationId: ART.wave }} /><Avatar name="Lume" size={52} avatarColor="lavender" customization={{ avatarDecorationId: ART.amethyst }} /></div>;
  if (id === 'effect') return <img className="lume-release-effect-swatch" src={ART.effectStill} alt="Estrelas Cadentes, efeito da biblioteca" loading="lazy" />;
  if (id === 'frame') return <div className="lume-release-mini-scene"><ReleaseProfileCard miniature customization={{ profileFrameId: ART.frame }} /></div>;
  if (id === 'banner') return <div className="lume-release-flag-samples"><FlagCanvas code="br" /><FlagCanvas code="jp" /></div>;
  if (id === 'plate') return <div className="lume-release-plate-samples">{[ART.plate, ART.secondPlate].map(id => <div className="lume-nameplate-host" key={id}><Nameplate id={id} /><strong>Lume Studio</strong></div>)}</div>;
  return <div className="lume-release-name-samples"><span style={{ ...getNameStyle({ customization: NAME }), ...(reduced ? { animation: 'none' } : {}) }}>Lume Studio</span><span style={{ ...getNameStyle({ customization: { ...NAME, nameFont: 'Medieval', nameEffect: 'glow' } }), ...(reduced ? { animation: 'none' } : {}) }}>Lume Studio</span></div>;
}

export function ReleaseHighlights() {
  const load = useCustomizationStore(state => state.load);
  const error = useCustomizationStore(state => state.error);
  const [selected, setSelected] = useState<FeatureId | 'all'>('all');
  useEffect(() => { void load(); }, [load]);
  const customization: ProfileCustomization = {
    ...(selected === 'all' || selected === 'avatar' ? { avatarDecorationId: ART.amethyst } : {}),
    ...(selected === 'all' || selected === 'effect' ? { profileEffectId: ART.effect } : {}),
    ...(selected === 'all' || selected === 'frame' ? { profileFrameId: ART.mainFrame } : {}),
    ...(selected === 'all' || selected === 'plate' ? { nameplateId: ART.plate } : {}),
    ...(selected === 'all' || selected === 'name' ? NAME : {}),
  };
  return <div className="lume-release-showcase">
    <div className="lume-release-complete-preview">
      <div className="lume-release-preview-heading"><span>SEU PERFIL, COMPLETO</span><button type="button" aria-pressed={selected === 'all'} onClick={() => setSelected('all')}>Ver tudo junto</button></div>
      <ReleaseProfileCard customization={customization} banner={selected === 'all' || selected === 'banner' ? ART.banner : undefined} />
      <p className="lume-release-preview-caption" aria-live="polite">{selected === 'all' ? 'Banner, decoração, efeito, moldura, placa e nome combinados.' : FEATURES.find(feature => feature.id === selected)?.title}</p>
      {error && <div className="lume-release-library-error" role="status">A biblioteca não carregou.<button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    </div>
    <div className="lume-release-feature-grid">{FEATURES.map(feature => <button type="button" className="lume-release-feature" key={feature.id} aria-pressed={selected === feature.id} onClick={() => setSelected(feature.id)}>
      <div className="lume-release-feature-art"><ReleaseFeatureArt id={feature.id} /></div><strong>{feature.title}</strong><p>{feature.description}</p>
    </button>)}</div>
  </div>;
}

import type { CSSProperties } from 'react';
import type { ProfileCustomization } from '@backspace/shared';

export const NAME_COLOR_PRESETS = [
  { label: 'Branco', value: null },
  { label: 'Ciano', value: '#22d3ee' },
  { label: 'Azul', value: '#93c5fd' },
  { label: 'Lilás', value: '#c4b5fd' },
  { label: 'Rosa', value: '#f9a8d4' },
  { label: 'Verde', value: '#86efac' },
  { label: 'Coral', value: '#fca5a5' },
  { label: 'Âmbar', value: '#fcd34d' },
] as const;

export function getNameStyle(user: { nameColor?: string | null; customization?: ProfileCustomization | null }): CSSProperties {
  if (user.nameColor === 'gold') {
    return {
      color: '#ffdf80',
      backgroundImage: 'linear-gradient(110deg, #dca63b 0%, #ffeaa0 25%, #fff9dc 45%, #f0bf52 65%, #ffe5a0 85%, #dca63b 100%)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      filter: 'drop-shadow(0 0 3px rgba(255, 199, 70, 0.24))',
    };
  }
  const appearance = user.customization;
  const colors = appearance?.nameColors?.filter(color => /^#[0-9a-f]{6}$/i.test(color)) ?? [];
  const color = colors[0] ?? (/^#[0-9a-f]{6}$/i.test(user.nameColor ?? '') ? user.nameColor! : '#ffffff');
  const style: CSSProperties = { color, ...(appearance?.nameFont ? { fontFamily: `"${appearance.nameFont}", "DM Sans", sans-serif` } : {}) };
  switch (appearance?.nameEffect) {
    case 'gradient': case 'prism': case 'glow': case 'gummy':
      Object.assign(style, { backgroundImage: `linear-gradient(110deg, ${colors.length > 1 ? colors.join(', ') : `${color}, #ffffff, ${color}`})`, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 100%', animation: 'lume-name-shift 5s ease-in-out infinite alternate' });
      if (appearance.nameEffect === 'glow') style.filter = `drop-shadow(0 0 4px ${color})`;
      if (appearance.nameEffect === 'gummy') style.filter = `drop-shadow(0 2px 0 ${color})`;
      break;
    case 'neon': style.textShadow = `0 0 3px ${color}, 0 0 10px ${color}`; break;
    case 'toon': style.WebkitTextStroke = '0.5px #101018'; style.textShadow = '1px 2px 0 #101018'; break;
    case 'pop': style.textShadow = `1px 1px 0 #101018, 2px 2px 0 ${color}`; break;
  }
  return style;
}

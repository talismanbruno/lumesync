import type { CSSProperties } from 'react';

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

export function getNameStyle(user: { nameColor?: string | null }): CSSProperties {
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
  return { color: /^#[0-9a-f]{6}$/i.test(user.nameColor ?? '') ? user.nameColor! : '#ffffff' };
}

import { OrbitalIcon } from '../ui/OrbitalIcon';

/** Passive status marker, using the same glyphs and red as the call controls. */
export function VoiceStatusBadge({ name, enforced = false }: { name: 'mic' | 'audio'; enforced?: boolean }) {
  return <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${enforced ? 'bg-accent-amber/90' : 'bg-[#e53942]'}`}>
    <OrbitalIcon name={name} size={14} cut />
  </span>;
}

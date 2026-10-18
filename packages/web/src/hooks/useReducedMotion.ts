import { createContext, useContext, useEffect, useState } from 'react';

// Embeds can suspend decorative motion without replacing or remounting their UI.
export const MotionSuspendedContext = createContext(false);

export function useReducedMotion(): boolean {
  const suspended = useContext(MotionSuspendedContext);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced || suspended;
}

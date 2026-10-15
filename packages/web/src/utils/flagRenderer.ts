import type { ProfileFlagCountry } from '@backspace/shared';

interface ClothRenderer {
  canvas: HTMLCanvasElement;
  time: number;
  setCountry: (code: string) => Promise<boolean>;
  draw: () => void;
  dispose: () => void;
}
interface FlagModule {
  FlagCloth: new (canvas: HTMLCanvasElement, options: { animated: boolean; renderWidth: number; renderHeight: number; cacheCountries: number }) => ClothRenderer;
  renderFlagThumbnail: (code: string) => Promise<string>;
}
let modulePromise: Promise<FlagModule> | undefined;
export function loadFlagRenderer(): Promise<FlagModule> {
  const runtime = window as Window & { lumeFlagRenderer?: FlagModule };
  if (runtime.lumeFlagRenderer) return Promise.resolve(runtime.lumeFlagRenderer);
  return modulePromise ??= new Promise<FlagModule>((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/previews/flag-cloth.js';
    script.onload = () => {
      if (runtime.lumeFlagRenderer) resolve(runtime.lumeFlagRenderer);
      else { modulePromise = undefined; reject(new Error('Flag renderer unavailable')); }
      script.remove();
    };
    script.onerror = () => { modulePromise = undefined; script.remove(); reject(new Error('Flag renderer unavailable')); };
    document.head.append(script);
  });
}

interface Surface {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  code: ProfileFlagCountry;
  animated: boolean;
  failed: () => void;
}
const surfaces = new Set<Surface>();
let renderer: ClothRenderer | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let time = 1.5;

async function paint() {
  if (running || !surfaces.size) return;
  running = true;
  try {
    const module = await loadFlagRenderer();
    renderer ??= new module.FlagCloth(document.createElement('canvas'), { animated: false, renderWidth: 1024, renderHeight: 384, cacheCountries: 16 });
    if (!document.hidden) {
      time += .025;
      const groups = new Map<ProfileFlagCountry, Surface[]>();
      for (const surface of surfaces) {
        const rect = surface.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const group = groups.get(surface.code) ?? []; group.push(surface); groups.set(surface.code, group);
      }
      for (const [code, group] of groups) {
        try {
          await renderer.setCountry(code);
          for (const surface of group) {
            if (!surfaces.has(surface)) continue;
            const rect = surface.canvas.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) continue;
            const ratio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
            const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
            if (surface.canvas.width !== width || surface.canvas.height !== height) { surface.canvas.width = width; surface.canvas.height = height; }
            renderer.time = surface.animated ? time : 1.5;
            renderer.draw();
            surface.context.drawImage(renderer.canvas, 0, 0, width, height);
          }
        } catch { for (const surface of group) surface.failed(); }
      }
    }
  } catch { for (const surface of surfaces) surface.failed(); }
  finally {
    running = false;
    if (surfaces.size) timer = setTimeout(() => void paint(), 33);
    else { renderer?.dispose(); renderer = undefined; }
  }
}

/** All visible flags share one WebGL context; rows only hold a lightweight 2D canvas. */
export function attachFlagSurface(canvas: HTMLCanvasElement, code: ProfileFlagCountry, animated: boolean, failed: () => void): () => void {
  const context = canvas.getContext('2d');
  if (!context) { failed(); return () => {}; }
  const surface = { canvas, context, code, animated, failed };
  surfaces.add(surface);
  if (!running) { if (timer) clearTimeout(timer); void paint(); }
  return () => {
    surfaces.delete(surface);
    if (!surfaces.size && !running) { if (timer) clearTimeout(timer); renderer?.dispose(); renderer = undefined; }
  };
}

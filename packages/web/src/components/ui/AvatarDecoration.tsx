import { useEffect, useRef, useState } from 'react';
import { cosmeticAvatarUrl } from '../../stores/customizationStore';

// ImageDecoder is available in Electron/Chromium, but not every web browser.
interface DecodedFrame { image: CanvasImageSource & { duration: number | null; close(): void } }
interface AnimationDecoder {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number; repetitionCount: number } | null };
  decode(options: { frameIndex: number }): Promise<DecodedFrame>;
  close(): void;
}
interface DecoderConstructor { new(options: { data: ArrayBuffer; type: string; preferAnimation: boolean }): AnimationDecoder }

/** Plays the original encoded frames; pausing leaves the last painted frame visible. */
export function AvatarDecoration({ id, playing }: { id: string; playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<{ play(): void; pause(): void } | null>(null);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [nativeVisible, setNativeVisible] = useState(true);
  const active = playing && visible && nativeVisible;
  const playingRef = useRef(active);
  playingRef.current = active;
  const [painted, setPainted] = useState(false);
  const [nativeFallback, setNativeFallback] = useState(false);
  const source = cosmeticAvatarUrl(id, true)!;
  const still = cosmeticAvatarUrl(id, false)!;

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const bridge = window.backspace;
    let disposed = false, changed = false;
    const unsubscribe = bridge?.onWindowVisibilityChange?.(value => { changed = true; setNativeVisible(value); });
    void bridge?.getWindowVisibility?.().then(value => { if (!disposed && !changed) setNativeVisible(value); }).catch(() => {});
    return () => { disposed = true; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    const Decoder = (window as unknown as { ImageDecoder?: DecoderConstructor }).ImageDecoder;
    setPainted(false);
    setNativeFallback(!Decoder);
    if (!Decoder) return;
    let disposed = false;
    let decoder: AnimationDecoder | null = null;
    let data: ArrayBuffer | null = null;
    let loading: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let releasing: ReturnType<typeof setTimeout> | undefined;
    let decoding = false;
    let index = 0;
    let loops = 0;
    let exhausted = false;
    let resumeRequested = false;
    let failed = false;
    let releaseRequested = false;
    const abort = new AbortController();
    const release = () => { decoder?.close(); decoder = null; };
    const load = async () => {
      if (decoder || disposed) return;
      if (!data) {
        // The URL is stable: pausing never creates a new cache-busting download.
        const response = await fetch(source, { signal: abort.signal });
        if (!response.ok) throw new Error('Decoration download failed: ' + response.status);
        data = await response.arrayBuffer();
      }
      if (disposed) return;
      const bytes = new Uint8Array(data);
      // APNG is a PNG container. Content-Type and file extensions may just say PNG.
      const type = bytes[0] === 137 ? 'image/png' : bytes[0] === 71 ? 'image/gif' : 'image/webp';
      decoder = new Decoder({ data, type, preferAnimation: true });
      await decoder.tracks.ready;
    };
    const tick = async () => {
      timer = undefined;
      if (disposed || !playingRef.current || decoding || exhausted || failed) return;
      decoding = true;
      try {
        if (!decoder) { loading ??= load().finally(() => { loading = null; }); await loading; }
        const current = decoder;
        const track = current?.tracks.selectedTrack;
        if (!current || !track || disposed || !playingRef.current) return;
        const { image } = await current.decode({ frameIndex: index });
        let delay = 83;
        try {
          if (disposed || !playingRef.current) return;
          const target = canvas.current;
          const context = target?.getContext('2d');
          if (!target || !context) return;
          // Native decoder handles APNG frame blending/disposal and original timing.
          context.clearRect(0, 0, target.width, target.height);
          context.drawImage(image, 0, 0, target.width, target.height);
          setPainted(true);
          delay = Math.max(16, (image.duration ?? 83_000) / 1000);
        } finally { image.close(); }
        index++;
        if (index >= track.frameCount) {
          index = 0;
          loops++;
          exhausted = Number.isFinite(track.repetitionCount) && loops > track.repetitionCount;
        }
        if (!disposed && playingRef.current && !exhausted) timer = setTimeout(() => { void tick(); }, delay);
      } catch (error) {
        if (!disposed && !abort.signal.aborted) { failed = true; setNativeFallback(true); release(); }
      } finally {
        decoding = false;
        if (releaseRequested && !playingRef.current) release();
        if (resumeRequested && playingRef.current && !disposed && !failed) {
          resumeRequested = false; clearTimeout(timer);
          timer = setTimeout(() => { void tick(); }, 16);
        }
      }
    };
    player.current = {
      play() {
        releaseRequested = false;
        clearTimeout(releasing); clearTimeout(timer);
        if (decoding) resumeRequested = true;
        else void tick();
      },
      pause() {
        clearTimeout(timer);
        // Retain just the canvas and encoded bytes after a pause, not all decoded frames.
        releasing = setTimeout(() => { releaseRequested = true; if (!decoding) release(); }, 1500);
      },
    };
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(timer); clearTimeout(releasing);
      release(); data = null; player.current = null;
    };
  }, [id, source]);

  useEffect(() => {
    if (active) player.current?.play();
    else player.current?.pause();
  }, [active, id]);

  return <span className="lume-avatar-decoration" aria-hidden="true" data-decoration-playing={active}>
    {(!painted || nativeFallback) && <img src={nativeFallback && active ? source : still} alt="" className="w-full h-full object-contain" />}
    {!nativeFallback && <canvas ref={canvas} width={288} height={288} className="w-full h-full" style={{ display: painted ? 'block' : 'none' }} />}
  </span>;
}

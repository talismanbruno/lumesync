/** Samples rendered video, never MediaStreamTrack's requested/nominal frameRate. */
export interface PlaybackSample {
  timeMs: number;
  height: number;
  frames: number | null;
}

type PlaybackVideo = Pick<HTMLVideoElement, 'videoHeight'> & {
  getVideoPlaybackQuality?: () => Pick<VideoPlaybackQuality, 'totalVideoFrames' | 'droppedVideoFrames'>;
};

const nonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function sampleVideoPlayback(video: PlaybackVideo, timeMs: number): PlaybackSample {
  let frames: number | null = null;
  try {
    const quality = video.getVideoPlaybackQuality?.();
    if (quality && nonNegative(quality.totalVideoFrames) && nonNegative(quality.droppedVideoFrames)
      && quality.droppedVideoFrames <= quality.totalVideoFrames) {
      frames = quality.totalVideoFrames - quality.droppedVideoFrames;
    }
  } catch { /* Unsupported playback counters: resolution is still useful. */ }
  return { timeMs, height: nonNegative(video.videoHeight) ? video.videoHeight : 0, frames };
}

export function observedVideoFps(previous: PlaybackSample | null, current: PlaybackSample): number | null {
  if (!previous || !nonNegative(previous.frames) || !nonNegative(current.frames)) return null;
  const elapsed = current.timeMs - previous.timeMs;
  const frames = current.frames - previous.frames;
  // The counter can reset when the underlying track changes. An implausible
  // sample must not become an "infinite FPS" or a burst from the previous track.
  if (!Number.isFinite(elapsed) || elapsed < 250 || frames < 0) return null;
  const fps = frames * 1000 / elapsed;
  return Number.isFinite(fps) && fps <= 240 ? Math.round(fps) : null;
}

export function formatVideoQuality(height: number, fps: number | null): string {
  if (!Number.isFinite(height) || height <= 0) return '';
  const resolution = `${Math.round(height)}P`;
  return fps !== null && nonNegative(fps) && fps <= 240
    ? `${resolution} ${Math.round(fps)}FPS` : resolution;
}

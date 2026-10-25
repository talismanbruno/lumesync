import { describe, expect, it } from 'vitest';
import { formatVideoQuality, observedVideoFps, sampleVideoPlayback } from './videoPlaybackQuality';

describe('stream playback quality badge', () => {
  it('measures frames played over time rather than a requested frame rate', () => {
    const video = { videoHeight: 720, getVideoPlaybackQuality: () => ({ totalVideoFrames: 90, droppedVideoFrames: 0 }) };
    const first = sampleVideoPlayback(video, 1000);
    expect(formatVideoQuality(first.height, observedVideoFps(null, first))).toBe('720P');
    video.getVideoPlaybackQuality = () => ({ totalVideoFrames: 180, droppedVideoFrames: 0 });
    const second = sampleVideoPlayback(video, 4000);
    expect(formatVideoQuality(second.height, observedVideoFps(first, second))).toBe('720P 30FPS');
  });

  it('excludes dropped frames and shows a real playback stall as zero FPS', () => {
    const first = { timeMs: 1000, height: 720, frames: 90 };
    const next = sampleVideoPlayback({ videoHeight: 360, getVideoPlaybackQuality: () => ({ totalVideoFrames: 180, droppedVideoFrames: 60 }) }, 4000);
    expect(formatVideoQuality(next.height, observedVideoFps(first, next))).toBe('360P 10FPS');
    expect(observedVideoFps(next, { ...next, timeMs: 7000 })).toBe(0);
  });

  it.each([Infinity, -Infinity, NaN, -1, 10000])('never displays invalid FPS %s', fps => {
    expect(formatVideoQuality(720, fps)).toBe('720P');
  });

  it('uses resolution only when playback counters are unavailable or broken', () => {
    for (const video of [
      { videoHeight: 720 },
      { videoHeight: 720, getVideoPlaybackQuality: () => { throw new Error('unsupported'); } },
      { videoHeight: 720, getVideoPlaybackQuality: () => ({ totalVideoFrames: Infinity, droppedVideoFrames: 0 }) },
      { videoHeight: 720, getVideoPlaybackQuality: () => ({ totalVideoFrames: 5, droppedVideoFrames: 20 }) },
    ]) {
      const sample = sampleVideoPlayback(video, 1000);
      expect(sample.frames).toBeNull();
      expect(formatVideoQuality(sample.height, null)).toBe('720P');
    }
  });

  it('ignores reset counters, invalid clocks and implausible sample bursts', () => {
    const first = { timeMs: 1000, height: 720, frames: 90 };
    for (const next of [
      { ...first, timeMs: 4000, frames: 0 },
      { ...first, timeMs: 1000, frames: 120 },
      { ...first, timeMs: Infinity, frames: 120 },
      { ...first, timeMs: 1100, frames: 120 },
      { ...first, timeMs: 4000, frames: 99999 },
    ]) expect(observedVideoFps(first, next)).toBeNull();
    expect(formatVideoQuality(Infinity, 30)).toBe('');
  });
});

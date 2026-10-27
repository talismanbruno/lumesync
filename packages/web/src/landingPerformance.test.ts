import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import source from '../../../landing/performance.js?raw';
import markup from '../../../landing/index.html?raw';

function fixture(options: { reduced?: boolean; paused?: boolean; observer?: boolean } = {}) {
  const doc = document.implementation.createHTMLDocument();
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  const section = doc.importNode(parsed.getElementById('desempenho')!, true);
  doc.body.append(section);
  const race = section.querySelector<HTMLElement>('#lume-performance')!;
  if (options.paused) doc.documentElement.dataset.paused = 'true';
  let now = 0, nextFrame = 0, hidden = false;
  const frames = new Map<number, FrameRequestCallback>();
  const events = new EventTarget();
  const motion = Object.assign(new EventTarget(), { matches: options.reduced ?? false });
  let arrive: IntersectionObserverCallback = () => {};
  let mutate: () => void = () => {};
  Object.defineProperty(doc, 'hidden', { get: () => hidden });
  class Arrival {
    constructor(callback: IntersectionObserverCallback) { arrive = callback; }
    observe() {}
    disconnect() {}
  }
  class Mutations {
    constructor(callback: () => void) { mutate = callback; }
    observe() {}
  }
  runInNewContext(source, {
    document: doc,
    window: options.observer === false ? {} : { IntersectionObserver: Arrival },
    IntersectionObserver: Arrival,
    MutationObserver: Mutations,
    matchMedia: () => motion,
    performance: { now: () => now },
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    addEventListener: events.addEventListener.bind(events),
  });
  const enter = (ratio = .5) => arrive([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
  const advance = (ms: number) => {
    now += ms;
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, callback] of pending) callback(now);
  };
  return {
    section, frames, enter, advance,
    timer: () => section.querySelector('.lp-timer')!.textContent,
    status: () => section.querySelector('.lp-race-status')!.textContent,
    phase: () => race.dataset.racePaused === 'true' ? 'paused' : race.dataset.raceState,
    lume: () => parseFloat((section.querySelector('.lp-lume .lp-fill') as HTMLElement).style.width),
    discord: () => parseFloat((section.querySelector('.lp-discord .lp-fill') as HTMLElement).style.width),
    rocket: () => (section.querySelector('.lp-lume .lp-racer') as HTMLElement).style.left,
    turtle: () => (section.querySelector('.lp-discord .lp-racer') as HTMLElement).style.left,
    replay: () => section.querySelector<HTMLButtonElement>('.lp-replay')!.click(),
    setHidden(value: boolean) { hidden = value; doc.dispatchEvent(new Event('visibilitychange')); },
    setPaused(value: boolean) { doc.documentElement.dataset.paused = String(value); mutate(); },
    setReduced(value: boolean) { motion.matches = value; motion.dispatchEvent(new Event('change')); },
  };
}

describe('landing performance comparison', () => {
  it('does not initialize on a page without the comparison', () => {
    const doc = document.implementation.createHTMLDocument();
    expect(() => runInNewContext(source, { document: doc })).not.toThrow();
  });

  it('waits for the visitor to reach the performance section', () => {
    const page = fixture();
    page.advance(30_000);
    page.enter(0);
    page.enter(.05);
    expect(page.phase()).toBe('waiting');
    expect(page.frames.size).toBe(0);
    expect(page.timer()).toBe('0,00 s');
    page.enter();
    expect(page.phase()).toBe('running');
    expect(page.frames.size).toBe(1);
  });

  it('runs the same distance, celebrates Lume at 4.22 seconds, and finishes Discord at 19.81 seconds', () => {
    const page = fixture();
    page.enter();
    page.advance(4_219);
    expect(page.lume()).toBeLessThan(100);
    expect(page.phase()).toBe('running');
    page.advance(1);
    expect(page.status()).toContain('Lume chegou! O Discord');
    expect(page.lume()).toBe(100);
    expect(page.rocket()).toBe('100%');
    expect(page.discord()).toBeCloseTo(4.22 / 19.81 * 100);
    expect(parseFloat(page.turtle())).toBeCloseTo(page.discord());
    expect(page.phase()).toBe('winner');
    expect(page.section.querySelector('.lp-lume')!.classList.contains('is-finished')).toBe(true);
    expect(page.section.querySelector('.lp-discord')!.classList.contains('is-finished')).toBe(false);
    page.advance(15_590);
    expect(page.timer()).toBe('19,81 s');
    expect(page.discord()).toBe(100);
    expect(page.turtle()).toBe('100%');
    expect(page.phase()).toBe('finished');
    expect(page.frames.size).toBe(0);
  });

  it('does not restart after another scroll entry, but allows explicit replay', () => {
    const page = fixture();
    page.enter();
    page.advance(20_000);
    page.enter(0);
    page.enter();
    expect(page.phase()).toBe('finished');
    expect(page.frames.size).toBe(0);
    page.replay();
    expect(page.phase()).toBe('running');
    expect(page.timer()).toBe('0,00 s');
    expect(page.section.querySelector('.lp-lume')!.classList.contains('is-finished')).toBe(false);
  });

  it('pauses in a hidden tab without counting the time spent away', () => {
    const page = fixture();
    page.enter();
    page.advance(2_000);
    page.setHidden(true);
    page.advance(30_000);
    expect(page.phase()).toBe('paused');
    expect(page.frames.size).toBe(0);
    page.setHidden(false);
    page.advance(1_000);
    expect(page.timer()).toBe('3,00 s');
  });

  it('respects the existing landing motion control before and during the race', () => {
    const page = fixture({ paused: true });
    page.enter();
    expect(page.phase()).toBe('paused');
    expect(page.frames.size).toBe(0);
    page.setPaused(false);
    page.advance(1_000);
    expect(page.timer()).toBe('1,00 s');
    page.setPaused(true);
    expect(page.phase()).toBe('paused');
    expect(page.frames.size).toBe(0);
  });

  it('shows the full comparison immediately with reduced motion', () => {
    const page = fixture({ reduced: true });
    page.enter();
    expect(page.phase()).toBe('finished');
    expect(page.discord()).toBe(100);
    expect(page.lume()).toBe(100);
    expect(page.frames.size).toBe(0);
    page.replay();
    expect(page.frames.size).toBe(0);
  });

  it('stops the race if reduced motion is enabled while it is running', () => {
    const page = fixture();
    page.enter();
    page.advance(1_000);
    page.setReduced(true);
    expect(page.phase()).toBe('finished');
    expect(page.frames.size).toBe(0);
  });

  it('keeps the comparison readable when scroll observation is unavailable', () => {
    const page = fixture({ observer: false });
    expect(page.phase()).toBe('finished');
    expect(page.timer()).toBe('19,81 s');
    expect(page.frames.size).toBe(0);
  });
});

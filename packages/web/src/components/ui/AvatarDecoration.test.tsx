import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AvatarDecoration } from './AvatarDecoration';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('keeps a visible static fallback on browsers without ImageDecoder and removes animation sources on silence', () => {
  const { container, rerender, unmount } = render(<AvatarDecoration id="101" playing={false} />);
  const node = container.firstChild;
  expect(container.querySelector('img')).toHaveAttribute('src', '/api/customization/items/101/static');
  rerender(<AvatarDecoration id="101" playing />);
  expect(container.firstChild).toBe(node);
  expect(container.querySelector('img')).toHaveAttribute('src', '/api/customization/items/101/animated');
  rerender(<AvatarDecoration id="101" playing={false} />);
  expect(container.querySelector('img')).toHaveAttribute('src', '/api/customization/items/101/static');
  unmount(); expect(container.childNodes).toHaveLength(0);
});

it('decodes original frames on demand, pauses without work, resumes and closes resources', async () => {
  vi.useFakeTimers();
  const draw = vi.fn(), closeFrame = vi.fn(), closeDecoder = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage: draw } as unknown as CanvasRenderingContext2D);
  const decode = vi.fn().mockImplementation(async () => ({ image: { duration: 83_000, close: closeFrame } }));
  class Decoder {
    tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: 60, repetitionCount: Infinity } };
    decode = decode; close = closeDecoder;
  }
  vi.stubGlobal('ImageDecoder', Decoder);
  const fetchFile = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => Uint8Array.of(137,80,78,71).buffer });
  vi.stubGlobal('fetch', fetchFile);
  const { container, rerender, unmount } = render(<AvatarDecoration id="101" playing={false} />);
  expect(fetchFile).not.toHaveBeenCalled();
  rerender(<AvatarDecoration id="101" playing />);
  await act(() => vi.advanceTimersByTimeAsync(250));
  expect(draw.mock.calls.length).toBeGreaterThan(1);
  expect(closeFrame).toHaveBeenCalledTimes(draw.mock.calls.length);
  const canvas = container.querySelector('canvas');
  rerender(<AvatarDecoration id="101" playing={false} />);
  const beforePause = decode.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(decode).toHaveBeenCalledTimes(beforePause);
  expect(closeDecoder).toHaveBeenCalledTimes(1);
  expect(canvas).toBeVisible();
  rerender(<AvatarDecoration id="101" playing />);
  await act(() => vi.advanceTimersByTimeAsync(100));
  expect(container.querySelector('canvas')).toBe(canvas);
  expect(decode.mock.calls.length).toBeGreaterThan(beforePause);
  expect(fetchFile).toHaveBeenCalledTimes(1);
  unmount();
  const afterClose = decode.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(decode).toHaveBeenCalledTimes(afterClose);
  expect(closeDecoder).toHaveBeenCalledTimes(2);
});

it('suspends original animation when the document becomes hidden', () => {
  const { container } = render(<AvatarDecoration id="101" playing />);
  expect(container.querySelector('img')).toHaveAttribute('src', '/api/customization/items/101/animated');
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('img')).toHaveAttribute('src', '/api/customization/items/101/static');
});

it('releases a decoder whose pending decode finishes after the pause deadline', async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void;
  const close = vi.fn(), closeFrame = vi.fn();
  class SlowDecoder {
    tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: 60, repetitionCount: Infinity } };
    decode() { return new Promise(resolve => { finish = resolve; }); }
    close = close;
  }
  vi.stubGlobal('ImageDecoder', SlowDecoder);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => Uint8Array.of(137).buffer }));
  const { rerender } = render(<AvatarDecoration id="101" playing />);
  await act(() => vi.advanceTimersByTimeAsync(1));
  rerender(<AvatarDecoration id="101" playing={false} />);
  await act(() => vi.advanceTimersByTimeAsync(1600));
  expect(close).not.toHaveBeenCalled();
  await act(async () => { finish({ image: { duration: 83_000, close: closeFrame } }); });
  expect(closeFrame).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});

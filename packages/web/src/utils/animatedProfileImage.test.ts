// @vitest-environment node
import { expect, it } from 'vitest';
import { isAnimatedProfileImage } from './animatedProfileImage';

it('preserves WebP animations without treating static WebP as animated', async () => {
  const header = Uint8Array.from(Buffer.from('RIFF\0\0\0\0WEBPVP8X\0\0\0\0\x02'));
  expect(await isAnimatedProfileImage(new File([header], 'avatar.webp'))).toBe(true);
  header[20] = 0x10;
  expect(await isAnimatedProfileImage(new File([header], 'avatar.webp'))).toBe(false);
});

it('finds APNG animation metadata beyond a large PNG metadata chunk', async () => {
  const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const chunk = (type: string, length: number) => {
    const data = new Uint8Array(length + 12);
    new DataView(data.buffer).setUint32(0, length);
    data.set(new TextEncoder().encode(type), 4);
    return data;
  };
  const parts = [signature, chunk('IHDR', 13), chunk('iTXt', 90_000)];
  expect(await isAnimatedProfileImage(new File([...parts, chunk('acTL', 8), chunk('IDAT', 1)], 'avatar.png'))).toBe(true);
  expect(await isAnimatedProfileImage(new File([...parts, chunk('IDAT', 1)], 'avatar.png'))).toBe(false);
});

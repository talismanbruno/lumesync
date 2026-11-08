import { describe, expect, it } from 'vitest';
import { ScreenAudioPackets } from './windowsScreenAudio';

function packet(values: number[]) {
  const data = Buffer.alloc(4 + values.length * 4);
  data.writeUInt32LE(values.length * 4);
  values.forEach((value, i) => data.writeFloatLE(value, 4 + i * 4));
  return data;
}
describe('native screen audio transport', () => {
  it('reassembles partial headers and PCM without leaking adjacent buffer contents', () => {
    const decoder = new ScreenAudioPackets();
    const data = packet([0.25, -0.5]);
    const received: Uint8Array[] = [];
    decoder.push(data.subarray(0, 2), pcm => received.push(pcm));
    decoder.push(data.subarray(2, 9), pcm => received.push(pcm));
    expect(received).toHaveLength(0);
    decoder.push(data.subarray(9), pcm => received.push(pcm));
    expect(received).toHaveLength(1);
    expect(received[0]!.buffer.byteLength).toBe(8);
    expect([...new Float32Array(received[0]!.buffer)]).toEqual([0.25, -0.5]);
  });
  it('delivers multiple packets independently', () => {
    const received: Uint8Array[] = [];
    new ScreenAudioPackets().push(Buffer.concat([packet([1, 0]), packet([0, 1])]), pcm => received.push(pcm));
    expect(received).toHaveLength(2);
  });
  it.each([0, 7, 384008, 0xffffffff])('rejects malformed length %s', length => {
    const header = Buffer.alloc(4); header.writeUInt32LE(length);
    expect(() => new ScreenAudioPackets().push(header, () => {})).toThrow('Invalid screen audio packet');
  });
  it('bounds buffered input before allocation', () => {
    expect(() => new ScreenAudioPackets().push(Buffer.alloc(1_048_577), () => {})).toThrow('buffer exceeded');
  });
});

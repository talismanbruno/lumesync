import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';

/** stdout framing is bounded independently of native capture and IPC consumers. */
export class ScreenAudioPackets {
  private pending = Buffer.alloc(0);
  push(bytes: Buffer, consume: (pcm: Uint8Array) => void): void {
    if (this.pending.length + bytes.length > 1_048_576) throw new Error('Screen audio buffer exceeded');
    this.pending = Buffer.concat([this.pending, bytes]);
    while (this.pending.length >= 4) {
      const size = this.pending.readUInt32LE(0);
      if (size === 0 || size > 384_000 || size % 8 !== 0) throw new Error('Invalid screen audio packet');
      if (this.pending.length < size + 4) return;
      consume(new Uint8Array(this.pending.subarray(4, size + 4)));
      this.pending = this.pending.subarray(size + 4);
    }
  }
}

export class WindowsScreenAudio {
  private current: { id: string; child: ChildProcessWithoutNullStreams; stop: () => void } | null = null;
  constructor(private executable: string, private excludedProcess: number) {}

  stop(id?: string): void {
    if (!this.current || (id && id !== this.current.id)) return;
    const capture = this.current;
    this.current = null;
    capture.stop();
  }

  start(onData: (id: string, pcm: Uint8Array) => void, onEnd: (id: string) => void): Promise<{ id: string; sampleRate: number; channels: number }> {
    this.stop();
    const id = randomUUID();
    const child = spawn(this.executable, [String(this.excludedProcess)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    return new Promise((resolve, reject) => {
      let ready = false;
      let finished = false;
      let errorText = '';
      const packets = new ScreenAudioPackets();
      const deadline = setTimeout(() => finish(new Error('Screen audio activation timed out')), 10_000);
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        if (this.current?.id === id) this.current = null;
        child.stdin.end();
        child.kill();
        if (!ready) reject(error ?? new Error('Screen audio cancelled'));
        else onEnd(id);
      };
      this.current = { id, child, stop: () => finish() };
      child.stdout.on('data', (bytes: Buffer) => {
        if (finished) return;
        try { packets.push(bytes, pcm => { if (ready) onData(id, pcm); }); }
        catch { finish(new Error('Invalid native screen audio stream')); }
      });
      child.stderr.on('data', (bytes: Buffer) => {
        errorText = (errorText + bytes.toString()).slice(-4096);
        if (!ready && !finished && errorText.includes('READY 48000 2')) {
          ready = true;
          clearTimeout(deadline);
          resolve({ id, sampleRate: 48000, channels: 2 });
        }
      });
      child.on('error', error => finish(error));
      child.stdin.on('error', () => finish(new Error('Screen audio input closed')));
      child.on('exit', () => finish(new Error(errorText.trim() || 'Screen audio capture ended')));
    });
  }
}

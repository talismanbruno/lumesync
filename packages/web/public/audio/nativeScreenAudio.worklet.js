// Interleaved stereo PCM -> a publication-only MediaStreamDestination.
class NativeScreenAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 48000;
    this.left = new Float32Array(this.capacity);
    this.right = new Float32Array(this.capacity);
    this.read = 0;
    this.write = 0;
    this.frames = 0;
    this.started = false;
    this.port.onmessage = ({ data }) => {
      if (!(data instanceof Float32Array) || data.length % 2 || data.length > 96000) return;
      // Discard old latency after a blocked renderer; never accumulate unbounded audio.
      if (this.frames + data.length / 2 > 9600) {
        this.frames = 0;
        this.read = this.write;
        this.started = false;
      }
      for (let i = 0; i < data.length; i += 2) {
        if (this.frames === this.capacity) { this.read = (this.read + 1) % this.capacity; this.frames--; }
        this.left[this.write] = Number.isFinite(data[i]) ? data[i] : 0;
        this.right[this.write] = Number.isFinite(data[i + 1]) ? data[i + 1] : 0;
        this.write = (this.write + 1) % this.capacity;
        this.frames++;
      }
    };
  }
  process(_inputs, outputs) {
    const channels = outputs[0];
    if (!channels?.length) return true;
    if (!this.started && this.frames >= 1920) this.started = true;
    for (let i = 0; i < channels[0].length; i++) {
      if (!this.started || !this.frames) {
        for (const channel of channels) channel[i] = 0;
        if (!this.frames) this.started = false;
        continue;
      }
      channels[0][i] = this.left[this.read];
      if (channels[1]) channels[1][i] = this.right[this.read];
      this.read = (this.read + 1) % this.capacity;
      this.frames--;
    }
    return true;
  }
}
registerProcessor('lume-native-screen-audio', NativeScreenAudioProcessor);

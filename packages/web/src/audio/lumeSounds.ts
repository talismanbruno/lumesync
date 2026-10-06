type Tone = { kind: 'rounded' | 'velvet' | 'sparkle' | 'switch'; frequency: number; duration: number; decay: number; color: number };
type Sound = { duration: number; events: Array<[number, Tone, number]>; reflection: boolean };

const rounded = (frequency: number, duration: number, decay = .085, color = .65): Tone =>
  ({ kind: 'rounded', frequency, duration, decay, color });
const velvet = (frequency: number, duration = .25, decay = .095): Tone =>
  ({ kind: 'velvet', frequency, duration, decay, color: 0 });
const sparkle = (frequency: number, duration = .28, decay = .11): Tone =>
  ({ kind: 'sparkle', frequency, duration, decay, color: 0 });
const switchTone = (frequency: number): Tone =>
  ({ kind: 'switch', frequency, duration: .13, decay: .019, color: 0 });
const layers = (duration: number, events: Sound['events'], reflection = false): Sound =>
  ({ duration, events, reflection });

// Original Lume cues, matching the approved listening samples. Each action
// keeps its own rhythm and register; there are no noise sweeps or pitch slides.
const sounds: Record<string, Sound> = {
  message: layers(.33, [[0, rounded(265, .18, .042, .3), 1], [.09, rounded(340, .19, .044, .3), .7]]),
  mute: layers(.20, [[.01, rounded(205, .16, .028, .35), 1]]),
  unmute: layers(.27, [[.01, rounded(205, .13, .030, .35), .6], [.075, rounded(330, .17, .048, .30), 1]]),
  deafen: layers(.32, [[.01, velvet(146.83, .27, .085), 1], [.01, velvet(220, .23, .065), .3]]),
  undeafen: layers(.34, [[.01, velvet(196, .19, .055), .7], [.10, velvet(293.66, .21, .075), 1]]),
  user_join: layers(.45, [[0, sparkle(329.63, .25), .75], [.115, sparkle(493.88, .28), 1]], true),
  user_leave: layers(.41, [[0, velvet(329.63, .25, .08), 1], [.105, velvet(220, .24, .085), .85]]),
  disconnect: layers(.40, [[0, rounded(246.94, .21, .056), .8], [.11, rounded(164.81, .25, .072), 1], [.11, rounded(329.63, .20, .045), .25]]),
  camera_on: layers(.25, [[0, switchTone(425), .7], [.057, switchTone(550), 1]]),
  camera_off: layers(.23, [[0, switchTone(360), .75], [.063, switchTone(235), 1]]),
  stream_started: layers(.57, [[0, velvet(261.63, .39, .13), .6], [.075, sparkle(392, .39, .17), .65], [.145, sparkle(523.25, .39, .16), 1]], true),
  stream_ended: layers(.48, [[0, velvet(392, .32, .105), .8], [.075, velvet(261.63, .31, .1), .7], [.21, switchTone(200), .25]]),
  stream_user_joined: layers(.34, [[0, rounded(392, .13, .035, .85), 1], [.15, rounded(392, .15, .04, .85), .7]]),
  stream_user_left: layers(.35, [[0, rounded(293.66, .13, .035, .85), .7], [.095, rounded(293.66, .13, .035, .85), .6], [.19, rounded(246.94, .13, .035, .85), 1]]),
  // The trailing silence is part of the loop cadence, not a sustained tone.
  call_ringing: layers(3.4, [[.03, rounded(329.63, .26, .086, .4), .9], [.17, rounded(493.88, .27, .08, .3), .8], [.44, velvet(392, .34, .13), 1], [.61, sparkle(493.88, .30, .11), .45]], true),
  call_calling: layers(3.0, [[.025, velvet(220, .30, .11), 1], [.27, rounded(293.66, .29, .10, .25), .7]], true),
};

function sampleTone(tone: Tone, time: number): number {
  const phase = 2 * Math.PI * tone.frequency * time;
  switch (tone.kind) {
    case 'rounded': {
      const signal = Math.sin(phase + tone.color * Math.sin(phase * 2) * Math.exp(-time / .027))
        + .08 * Math.sin(phase * .5) * Math.exp(-time / .075);
      return signal * (1 - Math.exp(-time / .0035)) * Math.exp(-time / tone.decay);
    }
    case 'velvet': {
      const signal = Math.sin(phase) + .16 * Math.sin(phase * 2)
        + .035 * Math.sin(phase * 3) * Math.exp(-time / .025);
      return signal * (1 - Math.exp(-time / .009)) * Math.exp(-time / tone.decay);
    }
    case 'sparkle':
      return (Math.sin(phase) * Math.exp(-time / tone.decay)
        + .23 * Math.sin(phase * 2.76) * Math.exp(-time / .026)) * (1 - Math.exp(-time / .004));
    case 'switch':
      return (Math.sin(phase) * Math.exp(-time / .019)
        + .35 * Math.sin(phase * 2.3) * Math.exp(-time / .010)
        + .12 * Math.sin(phase * 4.1) * Math.exp(-time / .005)) * (1 - Math.exp(-time / .0018));
  }
}

export function createLumeSound(context: BaseAudioContext, name: string): AudioBuffer {
  const sound = sounds[name] ?? sounds.message!;
  const rate = context.sampleRate;
  const length = Math.round(sound.duration * rate);
  const mono = new Float64Array(length);
  for (const [start, tone, gain] of sound.events) {
    const first = Math.round(start * rate);
    const count = Math.min(Math.round(tone.duration * rate), length - first);
    for (let i = 0; i < count; i++) {
      mono[first + i] = mono[first + i]! + sampleTone(tone, i / rate) * gain;
    }
  }

  const channels = [new Float64Array(mono), new Float64Array(mono)];
  const fade = Math.min(Math.round(.006 * rate), Math.floor(length / 3));
  let peak = 0;
  for (let channel = 0; channel < 2; channel++) {
    const data = channels[channel]!;
    if (sound.reflection) {
      const shift = Math.round((channel === 0 ? .047 : .058) * rate);
      for (let i = shift; i < length; i++) data[i] = data[i]! + mono[i - shift]! * .09;
    }
    for (let i = 0; i < fade; i++) {
      const progress = i / Math.max(1, fade - 1);
      data[i] = data[i]! * progress;
      data[length - fade + i] = data[length - fade + i]! * (1 - progress) ** 2;
    }
    for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  }

  const buffer = context.createBuffer(2, length, rate);
  const gain = peak > 0 ? .43 / peak : 1;
  channels.forEach((data, channel) => {
    const output = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) output[i] = data[i]! * gain;
  });
  return buffer;
}

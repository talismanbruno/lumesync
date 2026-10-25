# Screen audio feedback through virtual outputs — 2026-10-24

## Finding

The user reported remote viewers hearing themselves when the Windows desktop
app published a screen and viewers watched in a browser. A synthetic test on
the user's Windows 11 machine reproduced own-app audio leaking through system
capture even though the returned settings said `restrictOwnAudio: true` and
`deviceId: loopbackWithoutChrome`.

The default and communications output devices were FxSound Speakers. FxSound's
documented path replays processed audio from its own process into a hardware
output. Excluding the capturing application's process does not also exclude
that external replay. Thus a true constraint setting was insufficient evidence
of end-to-end isolation on this route.

## Controlled test

A separate local laboratory used Electron 43.4.0 / Chromium 150.0.7871.224 on
Windows build 26300. It did not change Windows defaults, FxSound settings or
the running Lume call. It used no microphone and published no media. Only
frequency magnitudes and technical settings were retained, not audio recordings.

- A 1999 Hz oscillator in the capturing app represented call playback.
- An independent Electron process played 659 Hz through the system default,
  representing shared game/media audio.
- Each capture measured off/on/off periods of the own-app signal.
- The direct-output case changed only the laboratory AudioContext sink to
  the Realtek output. Other apps remained on FxSound.

Mean spectral magnitudes during the own-app tone, in dBFS:

| Capture | Call playback output | Own-app component | External content component |
| --- | --- | ---: | ---: |
| Global loopback, no exclusion | Default / FxSound | -47.6 | -54.5 |
| Native exclusion requested and confirmed | Default / FxSound | -35.6 | -42.9 |
| Native exclusion requested and confirmed | Direct Realtek | -102.1 | -42.8 |

The direct route reduced the own-app component to the observed background floor
(66.5 dB below the leaking case), while external content stayed within 0.1 dB
between the two exclusion-enabled cases. Content stayed present during all
off/on/off phases; there was no voice-triggered muting. These are synthetic
measurements of this route, not proof for every driver or device.

## Implementation

- The shared web capture path resolves the actual Lume AudioContext output and
  the configured output before publishing system audio. It recognizes known
  virtual routing products, including FxSound, Voicemeeter, Sonar, Wave Link,
  BlackHole and Soundflower. The name list is a heuristic, not hardware
  certification and not a guarantee against unrecognized external routing.
- On a known virtual or unidentifiable output, the user chooses a direct
  headphone/speaker output, video-only sharing, or cancellation. Only Lume's
  output is changed; no global OS or equalizer setting is changed. The chosen
  output is retained as Lume's preference. The actual AudioContext sink must
  confirm the switch before screen audio is published.
- Failed/unsupported output changes do not authorize audio publication. A
  failed or cancelled change restores the previous Lume output request.
- Device changes, output preference changes and AudioContext sink changes are
  watched. A detected unsafe route stops screen audio independently of the
  microphone and video. OS device-change notifications and enumeration are
  asynchronous; this is not a zero-latency driver-level isolation guarantee.
- Desktop capture now requires the native `loopbackWithoutChrome` source as
  well as the true constraint setting. A global `loopback` source is rejected
  even if it reports the preference as true.
- An isolated browser tab keeps its existing separate-source path. No output
  rerouting dialog is needed for that path.
- Display capture remains in the original click before awaiting enumeration
  or a dialog. Pending dialog requests are cancelled on capture end,
  disconnect, or an explicit stop. No audio packets are published while the
  output choice is unresolved.
- The participant tile's mute/deafen indicators now reuse the call-control
  glyphs and red; server-enforced states retain their amber distinction.

## Platform scope and remaining acceptance

The correction is on the publisher: browser, desktop and mobile receivers
cannot reliably separate voices that were already mixed into screen audio.

| Publisher | Current handling | Functional evidence |
| --- | --- | --- |
| Windows 11 desktop | Confirm native source; resolve known virtual output to direct Lume output before audio publication | Synthetic real capture, direct output and preserved external content passed on the machine above; final multi-user application test pending |
| Windows browser / PWA | Same output guard for system/window audio; isolated external tab remains separate | Shared policy/unit tests; final Chrome/Brave/Edge live-call acceptance pending |
| Older Windows / older desktop engines | No unsafe global-loopback fallback; require confirmed exclusion backend | Compatibility rejection tested, not every historical installer |
| macOS desktop/browser | Same policy where capture and direct sink selection are supported; no unverified global-loopback fallback | Source review and policy tests; no physical macOS validation in this session |
| Linux desktop/browser | Generic Electron `loopback` is not accepted as isolated, even if the constraint is echoed back | Rejection regression tested; per-application native audio backend not implemented |
| Android app | Existing native screen path publishes screen video only | Source/SDK review and existing merge tests; no internal audio capture added |
| iOS | No native screen-audio publisher implementation in this repository | Not claimed as supported or tested |

Android currently calls `setScreenShareEnabled` with ScreenCaptureParams in
`android/app/src/main/java/social/lume/mobile/MainActivity.kt`. LiveKit Android
2.29.0 publishes video through that call. Future internal audio support must use
Android 10+ playback capture, exclude the app's UID explicitly and keep it
separate from microphone audio. The auxiliary room's no-subscribe permission
does not exclude audio played by the primary WebView.

Final acceptance still needs real multi-user calls on supported publisher
platforms, including simultaneous speech and media, switching outputs,
switching sources and reconnecting. External routers without recognizable
device names (or audio remixed on another machine) remain outside the heuristic.
This change does not claim universal audio isolation across arbitrary routing
software or implement missing native capture backends.

## Validation and publication

Targeted regression tests: 78 passed across seven files, covering capture,
output routing, actual-sink confirmation, failed/disconnected outputs,
video-only choice, cancellation, route changes, dialog keyboard behavior,
continuous receiver audio during speech, playback FPS and Android companion
merging. The web production build includes TypeScript validation. UI preview
uses the real indicator and dialog components with fictional device choices.
These results were collected locally before publication. Deployment must use
the reviewed commit and scanned container; runtime delivery does not replace
the platform acceptance checks above.

## Evidence and sources

- Local installed ASAR static analysis: `ev_f5c5c17ce1046bc955bfc8e2a091f40f73f5f8ffb164be7ecee1641fd6a04c4d`, artifact SHA-256 `06da7688c45e015e32fb94249564623fa8f58319b605155f7a3a51e579fd2fe3`.
  Only selected main/preload/manifest sources were analyzed; this does not
  establish the engine version of the user's running Lume process. The engine
  identity above belongs to the controlled laboratory.
- [Electron own-audio fix and version boundaries](https://releases.electronjs.org/pr/52455)
- [FxSound's documented processing path](https://forum.fxsound.com/t/troubleshooting/3105)
- [Exact Chromium loopback device identifiers](https://github.com/chromium/chromium/blob/150.0.7871.224/media/audio/audio_device_description.cc)
- [LiveKit Android 2.29.0 participant publishing](https://github.com/livekit/client-sdk-android/blob/v2.29.0/livekit-android-sdk/src/main/java/io/livekit/android/room/participant/LocalParticipant.kt)

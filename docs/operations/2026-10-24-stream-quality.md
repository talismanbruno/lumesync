# Stream quality investigation — 2026-10-24

## Report and observed evidence

A browser publisher's screen share dropped from 720p to 360p and sometimes
180p, with stalls. Multiple viewers noticed the drop, including a desktop
viewer. Recovery sometimes took one to two minutes. Sender diagnostics were
not available, so the sender's CPU and upstream bandwidth remain unverified.

Read-only samples from the affected desktop viewer's connection panel showed:

| Sample | Received video | Bitrate | Ping | Packet loss | Jitter |
| --- | --- | --- | --- | --- | --- |
| Degraded | VP9, 640×360, 7 FPS | 386 kbps | 17 ms | 0.1% | 24 ms |
| Recovered | VP9, 1280×720, 32 FPS | 2.7 Mbps | 16 ms | 0.1% | 8 ms |

These are successive observations, not a continuous trace. The old overlay
displayed `INFINITYFPS` during the degraded sample and cannot be used as a
reliable FPS measurement in earlier screenshots.

At 23:09:34 UTC, the server publication advertised one 1280×720 VP9 spatial
layer with a 4 Mbps ceiling. A VP8 backup codec was also registered; registration
alone does not show that the backup encoder was active. Thus the observed
360p/540p values are not evidence of the viewer selecting smaller advertised
spatial layers. They point toward publisher capture/encoder/upstream adaptation,
without distinguishing CPU pressure from bandwidth pressure.

Two five-second server samples did not establish sustained CPU or memory
exhaustion, and UDP receive/send error counters did not increase during those
samples. The voice container had no restart or OOM event. Logs contained
out-of-order sequence warnings, which alone do not establish the cause of the
stalls. A clean short sample cannot exclude earlier transient host or network
pressure.

## Confirmed local corrections

- The video badge now measures presented frames from playback counters over
  elapsed time instead of treating a track's nominal `frameRate` as actual FPS.
  Unsupported counters and non-finite or implausible values produce resolution
  only; a measured playback stall can show zero FPS.
- Connection diagnostics no longer infer a simulcast layer from resolution.
  The old inference called a single 720p VP9 stream "Medium" without evidence.
- Text mode now preserves LiveKit 2.17.1's VP9 `motion` content hint through
  initial, delayed and configuration-change tuning. The SDK explicitly applies
  this workaround to avoid the low-FPS VP9 screenshare path. H264 text mode
  retains `detail`, and text retains `maintain-resolution`. The reported
  publisher's mode is unknown, so this is not a confirmed explanation for the
  incident.
- The approved circular red end-call control is used in desktop and mobile
  voice controls. The focused stream's native hover title was removed.

Audio capture policy, speech handling, codecs, bitrate ceilings, congestion
control and production server configuration were not changed.

## Remaining investigation

LiveKit server v1.9.11's default probe regulator starts at three seconds and can
back off to two minutes after congesting probes. This is compatible with the
reported recovery delay, but no trace proves that this mechanism was exercised
in this incident. Changing probe intervals or bandwidth estimation without a
controlled trace would be speculative.

The next decisive evidence is the publisher's outbound video
`qualityLimitationReason` (`cpu`, `bandwidth`, `other` or `none`), actual encoded
dimensions, frame rate, bitrate and limitation durations during a drop. Correlate
those with receiver stats and server events. A controlled 720p/30 trial can help
test encoder/upload pressure, but is not a proven fix.

Do not force a fixed resolution or minimum bitrate, disable congestion control,
or restart voice services during an active call to mask this issue.

## Validation and deployment status

Targeted tests cover playback counters, invalid FPS, capture/audio isolation,
delayed VP9 tuning, mobile voice controls and global audio rendering: 48 passed
across four files. The web production build (including TypeScript) passed.
The end-call control and resolution-only fallback were visually checked in an
isolated local preview using the actual components. These are pre-publication
validation results; deployment does not establish the unresolved incident cause
or complete real-device acceptance.

## Primary references

- [WebRTC statistics specification](https://www.w3.org/TR/webrtc-stats/)
- [LiveKit JS v2.17.1 publisher implementation](https://github.com/livekit/client-sdk-js/blob/v2.17.1/src/room/participant/LocalParticipant.ts)
- [LiveKit server v1.9.11 probe regulator](https://github.com/livekit/livekit/blob/v1.9.11/pkg/sfu/ccutils/probe_regulator.go)

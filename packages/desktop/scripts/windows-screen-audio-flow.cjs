// End-to-end local native PCM -> production preload -> production AudioWorklet
// -> MediaStreamTrack -> WebRTC -> receiver. No calls/accounts or recordings.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const desktop = path.resolve(__dirname, '..');
const web = path.resolve(desktop, '../web');

if (!process.versions.electron) {
  const electron = process.argv[2];
  if (!electron || process.platform !== 'win32') throw new Error('Pass a Windows Electron executable');
  const esbuild = require(require.resolve('esbuild', { paths: [path.dirname(require.resolve('vite', { paths: [web] }))] }));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-audio-flow-'));
  esbuild.buildSync({ stdin: {
    contents: `import { startNativeScreenAudio } from ${JSON.stringify(path.join(web, 'src/utils/nativeScreenAudio.ts'))};
      window.startNativeScreenAudio = startNativeScreenAudio;`,
    resolveDir: web, loader: 'ts',
  }, bundle: true, format: 'iife', outfile: path.join(temp, 'renderer.js'),
  define: { 'import.meta.env.BASE_URL': JSON.stringify(pathToFileURL(path.join(web, 'public') + path.sep).href) } });
  fs.writeFileSync(path.join(temp, 'index.html'), '<!doctype html><meta charset="utf-8"><script src="renderer.js"></script>');
  const source = spawn(electron, [path.join(__dirname, 'windows-screen-audio-smoke.cjs'), 'source'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let capture;
  const deadline = setTimeout(() => { source.kill(); capture?.kill(); process.exitCode = 1; }, 25000);
  source.stderr.pipe(process.stderr);
  source.stdout.once('data', () => {
    capture = spawn(electron, [__filename, temp], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    capture.stdout.pipe(process.stdout); capture.stderr.pipe(process.stderr);
    capture.on('exit', code => { clearTimeout(deadline); source.kill(); process.exitCode = code ?? 1; });
  });
} else {
  const { app, BrowserWindow, ipcMain, session } = require('electron');
  const { WindowsScreenAudio } = require('../dist/windowsScreenAudio.js');
  const capture = new WindowsScreenAudio(process.env.LUME_AUDIO_HELPER_PATH || path.join(desktop, 'resources/native/LumeProcessAudio.exe'), process.pid);
  const temp = process.argv[2];
  app.setPath('userData', path.join(temp, 'profile'));
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.on('before-quit', () => capture.stop());
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionCheckHandler(() => true);
    const window = new BrowserWindow({ show: false,
      webPreferences: { sandbox: true, contextIsolation: true, preload: path.join(desktop, 'dist/preload.js') } });
    ipcMain.on('get-preferred-languages', event => { event.returnValue = ['pt-BR']; });
    ipcMain.handle('start-screen-audio', () => capture.start(
      (id, pcm) => window.webContents.send('screen-audio-data', { id, pcm }),
      id => window.webContents.send('screen-audio-ended', { id })));
    ipcMain.on('stop-screen-audio', (_event, id) => capture.stop(id));
    await window.loadFile(path.join(temp, 'index.html'));
    const result = await window.webContents.executeJavaScript(`(async () => {
      const ctx = new AudioContext({sampleRate:48000});
      const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
      const direct = outputs.find(d => d.label && !['default','communications',''].includes(d.deviceId) && !/fxsound|voicemeeter|vb.audio|virtual|cable|sonar|wave.link/i.test(d.label));
      if (!direct) throw Error('Physical audio output unavailable');
      await ctx.setSinkId(direct.deviceId); await ctx.resume();
      const own = ctx.createOscillator(), gain = ctx.createGain();
      own.frequency.value = 1999; gain.gain.value = 0.02;
      own.connect(gain).connect(ctx.destination); own.start();
      const capture = await window.startNativeScreenAudio(new AbortController().signal);
      if (!capture) throw Error('Native bridge missing');
      const sender = new RTCPeerConnection(), receiver = new RTCPeerConnection();
      sender.onicecandidate = e => { if(e.candidate) receiver.addIceCandidate(e.candidate); };
      receiver.onicecandidate = e => { if(e.candidate) sender.addIceCandidate(e.candidate); };
      const received = new Promise(resolve => { receiver.ontrack = e => resolve(e.track); });
      sender.addTrack(capture.track, new MediaStream([capture.track]));
      await sender.setLocalDescription(await sender.createOffer());
      await receiver.setRemoteDescription(sender.localDescription);
      await receiver.setLocalDescription(await receiver.createAnswer());
      await sender.setRemoteDescription(receiver.localDescription);
      const remote = await Promise.race([received, new Promise((_,reject)=>setTimeout(()=>reject(Error('WebRTC track timeout')),5000))]);
      const element = document.createElement('audio'); element.autoplay = true; element.muted = true;
      element.srcObject = new MediaStream([remote]); document.body.append(element); await element.play();
      const analyser = ctx.createAnalyser(); analyser.fftSize = 32768;
      const source = ctx.createMediaStreamSource(new MediaStream([remote])); source.connect(analyser);
      const mute = ctx.createGain(); mute.gain.value = 0; analyser.connect(mute).connect(ctx.destination);
      await new Promise(resolve=>setTimeout(resolve,3000));
      const spectrum = new Float32Array(analyser.frequencyBinCount); analyser.getFloatFrequencyData(spectrum);
      const band = hz => { const bin=Math.round(hz*32768/48000); return Math.max(...spectrum.slice(bin-2,bin+3)); };
      const externalDb = band(659), ownDb = band(1999);
      const passed = externalDb > -80 && ownDb < externalDb - 30;
      capture.stop(); sender.close(); receiver.close(); source.disconnect(); element.srcObject=null;
      own.stop(); await ctx.close();
      return {passed,externalDb,ownDb,trackEnded:capture.track.readyState === 'ended'};
    })()`, true);
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(JSON.stringify({ ...result, windows: os.release(), electron: process.versions.electron }));
    capture.stop(); window.destroy(); app.exit(result.passed && result.trackEnded ? 0 : 1);
  }).catch(error => { console.error(error); capture.stop(); app.exit(1); });
}

// Run with Node: node windows-screen-audio-smoke.cjs <electron.exe>
// Two sibling Electron processes emit quiet synthetic tones. No microphone,
// screen pixels, recordings, accounts or network are used.
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

if (!process.versions.electron) {
  const electron = process.argv[2];
  if (!electron || process.platform !== 'win32') throw new Error('Pass a Windows Electron executable');
  const children = [];
  const launch = mode => {
    const child = spawn(electron, [__filename, mode], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    child.stderr.pipe(process.stderr);
    return child;
  };
  const deadline = setTimeout(() => { children.forEach(c => c.kill()); process.exitCode = 1; }, 20000);
  const source = launch('source');
  source.stdout.once('data', () => {
    const capture = launch('capture');
    capture.stdout.pipe(process.stdout);
    capture.on('exit', code => { clearTimeout(deadline); source.kill(); process.exitCode = code ?? 1; });
  });
  source.on('error', () => { clearTimeout(deadline); process.exitCode = 1; });
} else {
  const { app, BrowserWindow, session } = require('electron');
  const mode = process.argv[2];
  app.setPath('userData', path.join(os.tmpdir(), `lume-audio-smoke-${process.pid}`));
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionCheckHandler(() => true);
    const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    await window.loadFile(path.join(__dirname, 'audio-smoke.html'));
    await window.webContents.executeJavaScript(`(async () => {
      const context = new AudioContext({sampleRate:48000});
      const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
      const direct = outputs.find(d => d.label && !['default','communications',''].includes(d.deviceId) && !/fxsound|voicemeeter|vb.audio|virtual|cable|sonar|wave.link/i.test(d.label));
      if (!direct) throw new Error('No direct physical output for isolation test');
      await context.setSinkId(direct.deviceId);
      const tone = context.createOscillator(); const gain = context.createGain();
      tone.frequency.value = ${mode === 'source' ? 659 : 1999}; gain.gain.value = 0.02;
      tone.connect(gain).connect(context.destination); tone.start(); await context.resume();
      window.testAudio = {context,tone,gain};
    })()`, true);
    if (mode === 'source') { console.log('SOURCE READY'); return; }
    const helper = spawn(path.join(__dirname, '../resources/native/LumeProcessAudio.exe'), [String(process.pid)],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let pending = Buffer.alloc(0), ready = false, finished = false;
    const samples = [];
    helper.stderr.on('data', bytes => { if (bytes.toString().includes('READY')) ready = true; else process.stderr.write(bytes); });
    helper.stdout.on('data', bytes => {
      pending = Buffer.concat([pending, bytes]);
      while (pending.length >= 4) {
        const size = pending.readUInt32LE(0);
        if (size > 384000 || size % 8) throw new Error('Invalid PCM frame');
        if (pending.length < size + 4) break;
        for (let i = 4; i < size + 4; i += 8) if (samples.length < 48000 * 4) samples.push(pending.readFloatLE(i));
        pending = pending.subarray(size + 4);
      }
    });
    const finish = () => {
      if (finished) return;
      finished = true;
      helper.stdin.end(); helper.kill();
      const data = samples.slice(24000);
      const magnitude = frequency => {
        let re = 0, im = 0;
        for (let i = 0; i < data.length; i++) {
          re += data[i] * Math.cos(2 * Math.PI * frequency * i / 48000);
          im += data[i] * Math.sin(2 * Math.PI * frequency * i / 48000);
        }
        return Math.hypot(re, im) * 2 / Math.max(1, data.length);
      };
      const band = frequency => Math.max(...[-2,-1,0,1,2].map(d => magnitude(frequency + d)));
      const external = band(659), own = band(1999);
      const passed = ready && data.length > 48000 && external > 0.0001 && own < external * 0.02;
      console.log(JSON.stringify({ passed, windows: os.release(), electron: process.versions.electron,
        frames: data.length, externalTone: external, excludedTone: own, ratio: own / external }));
      window.destroy(); app.exit(passed ? 0 : 1);
    };
    helper.on('error', finish);
    setTimeout(finish, 4000);
  }).catch(error => { console.error(error); app.exit(1); });
}

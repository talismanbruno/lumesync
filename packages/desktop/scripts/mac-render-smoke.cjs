// Native rendering regression probe; uses an isolated profile and no remote service.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-render-check-'));
app.setPath('userData', temporary);
const watchdog = setTimeout(() => { console.error('Renderer did not complete within 45 seconds'); app.exit(1); }, 45000);

app.whenReady().then(async () => {
  const policy = fs.readFileSync(path.resolve(__dirname, '../../web/src/styles/mac-desktop.css'), 'utf8');
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const cards = Array.from({ length: 24 }, (_, index) => `<section class="glass-modal"><h2>Perfil ${index + 1}</h2><div class="glass-bubble">Conversas e configurações</div><p>Uma interface responsiva, com o mesmo acabamento.</p></section>`).join('');
  const html = `<html><head><style>
    *{box-sizing:border-box}body{margin:0;background:#0b0b10;color:white;font:15px sans-serif}
    .light{position:fixed;inset:-40%;background:radial-gradient(ellipse,#146f96,transparent 65%);animation:drift 2s linear infinite alternate}
    main{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px}
    section{padding:14px;border:1px solid #ffffff16;border-radius:12px;background:#10131ad9}
    .glass-modal,.glass-bubble{backdrop-filter:blur(20px) saturate(120%)}
    .glass-bubble{padding:10px;background:#ffffff09;border-radius:8px}
    h2{font-size:17px}p{font-size:12px;color:#b8c2cc}@keyframes drift{to{transform:translate(15%,10%)}}
    ${policy}
  </style></head><body><div class="light"></div><main>${cards}</main></body></html>`;
  const source = path.join(temporary, 'render.html'); fs.writeFileSync(source, html);
  await window.loadFile(source);
  app.focus({ steal: true }); window.show(); window.focus();
  const measure = async native => window.webContents.executeJavaScript(`(async()=>{
    document.documentElement.dataset.lumeRuntime=${JSON.stringify(native ? 'mac-desktop' : '')};
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const intervals=[]; const start=performance.now(); let previous=start;
    await new Promise(resolve=>{const frame=now=>{intervals.push(now-previous);previous=now;if(now-start<3000)requestAnimationFrame(frame);else resolve()};requestAnimationFrame(frame)});
    const sorted=intervals.slice().sort((a,b)=>a-b);
    return {fps:Math.round(intervals.length*10000/(previous-start))/10,p95:Math.round(sorted[Math.floor(sorted.length*.95)]),frames:intervals.length,blur:getComputedStyle(document.querySelector('.glass-modal')).backdropFilter};
  })()`);
  const before = await measure(false), after = await measure(true);
  console.log(JSON.stringify({ platform:process.platform,arch:process.arch,gpu:app.getGPUFeatureStatus(),before,after }));
  if (after.blur !== 'none' || after.fps < 24 || after.p95 > 250) throw new Error('Native renderer failed the responsiveness gate');
  clearTimeout(watchdog); window.destroy(); app.quit();
}).catch(error => { console.error(error); clearTimeout(watchdog); app.exit(1); });

app.on('will-quit', () => {
  if (path.dirname(temporary) === path.resolve(os.tmpdir()) && path.basename(temporary).startsWith('lume-render-check-')) fs.rmSync(temporary, { recursive:true, force:true });
});

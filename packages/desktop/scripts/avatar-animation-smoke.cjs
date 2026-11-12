// Native rendering test with original catalog assets. This is NOT a real voice call.
const {app,BrowserWindow,ipcMain}=require('electron');const {attachWindowVisibility,isWindowVisible}=require('../dist/windowVisibility.js');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const report=process.env.LUME_ANIMATION_REPORT;if(!report||!process.env.LUME_AVATAR_PROBE_URL)throw Error('Set report path and fixture URL');
app.setPath('userData',path.join(path.dirname(report),'avatar-smoke-profile'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));let win;
const deadline=setTimeout(()=>{console.error('Native animation probe timed out');app.exit(1)},45000);
app.whenReady().then(async()=>{
 ipcMain.on('get-preferred-languages', event => { event.returnValue=app.getPreferredSystemLanguages(); });
 win=new BrowserWindow({width:800,height:480,show:true,webPreferences:{preload:path.resolve(__dirname,'../dist/preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 attachWindowVisibility(win);ipcMain.handle('get-window-visibility',()=>isWindowVisible(win));
 await win.loadURL(process.env.LUME_AVATAR_PROBE_URL);win.show();win.focus();await wait(2500);
 const read=()=>win.webContents.executeJavaScript('({stats:{...window.animationProbe},paint:[...document.querySelectorAll(".lume-avatar-decoration")].map(e=>({playing:e.dataset.decorationPlaying,frame:e.querySelector("canvas")?.toDataURL(),static:e.querySelector("img")?.getAttribute("src")})),reduced:matchMedia("(prefers-reduced-motion: reduce)").matches})');
 const idle=await read();assert.equal(idle.paint.length,3);assert.equal(idle.stats.openDecoders,1,'Only the open profile should decode while participants are silent');
 await win.webContents.executeJavaScript('window.setProbeSpeaking(true)');await wait(600);const speakingA=await read();await wait(350);const speakingB=await read();
 assert.equal(speakingB.stats.openDecoders,3);assert.notEqual(speakingA.paint[0].frame,speakingB.paint[0].frame);assert.notEqual(speakingA.paint[1].frame,speakingB.paint[1].frame);
 await win.webContents.executeJavaScript('window.setProbeSpeaking(false);window.closeProbeProfile()');await wait(150);const pausedA=await read();await wait(2000);const pausedB=await read();
 assert.equal(pausedB.paint.length,2);assert.equal(pausedA.paint[0].frame,pausedB.paint[0].frame);assert.equal(pausedA.paint[1].frame,pausedB.paint[1].frame);assert.equal(pausedA.stats.decodes,pausedB.stats.decodes);assert.equal(pausedB.stats.openDecoders,0);
 await win.webContents.executeJavaScript('window.setProbeSpeaking(true)');await wait(400);const resumed=await read();assert.notEqual(resumed.paint[0].frame,pausedB.paint[0].frame);
 win.hide();await wait(150);const hiddenA=await read();await wait(1900);const hiddenB=await read();
 assert.equal(hiddenA.stats.decodes,hiddenB.stats.decodes);assert.equal(hiddenB.stats.openDecoders,0);win.show();await wait(400);const visibleAgain=await read();assert(visibleAgain.stats.decodes>hiddenB.stats.decodes);
 const metrics=app.getAppMetrics().map(m=>({type:m.type,cpu:m.cpu,memory:m.memory}));
 await win.webContents.executeJavaScript('window.setProbeSpeaking(false)');await wait(1700);
 const summary={passed:true,realCall:false,originalAssets:true,reducedMotion:idle.reduced,framesChangedForBothParticipants:true,pausedFramesUnchanged:true,pausedDecodeCountUnchanged:true,decodersReleasedAfterPause:pausedB.stats.openDecoders===0,profileUnmounted:true,resumeChangedFrame:true,hiddenDecodingStopped:true,visibilityResume:true,metrics};
 fs.writeFileSync(report,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));clearTimeout(deadline);win.destroy();app.quit();
}).catch(e=>{console.error(e);clearTimeout(deadline);if(win&&!win.isDestroyed())win.destroy();app.exit(1)});

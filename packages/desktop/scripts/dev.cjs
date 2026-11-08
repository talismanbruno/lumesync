const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
require('./build-native.cjs');
const electron = require('electron');
if (process.platform === 'darwin') {
  try {
    fs.copyFileSync(path.join(__dirname, '../build/icon.icns'), path.resolve(path.dirname(electron), '../Resources/electron.icns'));
  } catch { /* Development branding is optional; packaged icons use electron-builder. */ }
}
const compile = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc')], { stdio: 'inherit', windowsHide: true });
if (compile.error) throw compile.error;
if (compile.status !== 0) process.exit(compile.status || 1);
const child = spawn(electron, ['.'], { stdio: 'inherit', env: process.env });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform === 'win32') {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'resources', 'native');
  fs.mkdirSync(output, { recursive: true });
  const compiler = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  const result = spawnSync(compiler, ['/nologo', '/optimize+', '/platform:anycpu', '/target:exe',
    '/out:' + path.join(output, 'LumeProcessAudio.exe'), path.join(root, 'native', 'WindowsProcessAudio.cs')],
  { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

import { readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, copyFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function checkVersions(rootVersion, desktopVersion, androidSource, ref = '') {
  if (!/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(rootVersion)) throw new Error('Invalid release version');
  if (desktopVersion !== rootVersion) throw new Error('Desktop version differs from release');
  if (androidSource.match(/versionName\s*=\s*"([^"]+)"/)?.[1] !== rootVersion) throw new Error('Android version differs from release');
  if (ref.startsWith('refs/tags/') && ref !== `refs/tags/v${rootVersion}`) throw new Error('Tag differs from release version');
  return rootVersion;
}

export function verifyFeed(source, directory, version) {
  if (source.match(/^version:\s*([^\s]+)\s*$/m)?.[1] !== version) throw new Error('Update feed has wrong version');
  const entries = [...source.matchAll(/^\s*- url:\s*(.+)\n\s+sha512:\s*(\S+)\n\s+size:\s*(\d+)/gm)];
  if (!entries.length) throw new Error('Update feed has no downloadable files');
  for (const [, rawName, sha512, size] of entries) {
    const name = decodeURIComponent(rawName.trim().replace(/^['"]|['"]$/g, ''));
    if (basename(name) !== name || !name.includes(version)) throw new Error('Unexpected update filename');
    const file = readFileSync(join(directory, name));
    if (file.length !== Number(size) || createHash('sha512').update(file).digest('base64') !== sha512) throw new Error(`Corrupt update asset: ${name}`);
  }
}

function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// ASAR header is a Chromium pickle; inspect package.json without extracting or executing it.
function packagedVersion(path) {
  const data = readFileSync(path);
  const headerSize = data.readUInt32LE(4);
  const jsonSize = data.readUInt32LE(12);
  const header = JSON.parse(data.subarray(16, 16 + jsonSize).toString());
  const entry = header.files['package.json'];
  if (!entry || entry.unpacked) throw new Error('Packaged application metadata missing');
  const start = 8 + headerSize + Number(entry.offset);
  return JSON.parse(data.subarray(start, start + entry.size).toString()).version;
}

function main() {
  const version = checkVersions(JSON.parse(readFileSync('package.json')).version,
    JSON.parse(readFileSync('packages/desktop/package.json')).version,
    readFileSync('android/app/build.gradle.kts', 'utf8'), process.env.GITHUB_REF);
  const [mode, directory] = process.argv.slice(2);
  if (mode === 'version') {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  } else if (mode === 'desktop') {
    const archives = walk(directory).filter(path => path.endsWith('/app.asar') || path.endsWith('\\app.asar'));
    if (!archives.length) throw new Error('No packaged applications found');
    for (const archive of archives) if (packagedVersion(archive) !== version) throw new Error(`Wrong packaged version: ${archive}`);
    // GitHub's builder provider emits latest feeds even for prerelease versions.
    // Existing beta clients request beta feeds; both must refer to the same bytes.
    if (version.includes('-beta.')) {
      for (const name of readdirSync(directory).filter(name => /^latest.*\.yml$/.test(name))) {
        copyFileSync(join(directory, name), join(directory, name.replace(/^latest/, 'beta')));
      }
    }
    console.log(`Verified ${archives.length} packaged application(s)`);
  } else if (mode === 'assets') {
    const names = readdirSync(directory);
    for (const required of [`Lume-${version}-x64.exe`, `Lume-${version}-arm64.exe`, `Lume-${version}-arm64.dmg`, `Lume-${version}-x64.dmg`, `Lume-${version}-android.apk`, 'beta.yml', 'latest.yml']) {
      if (!names.includes(required)) throw new Error(`Missing download: ${required}`);
    }
    for (const name of names) {
      if (/\.yml$/.test(name)) verifyFeed(readFileSync(join(directory, name), 'utf8'), directory, version);
      else if (!name.includes(version)) throw new Error(`Unexpected asset: ${name}`);
    }
    const checksums = names.sort().map(name => `${createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')}  ${name}`).join('\n');
    writeFileSync(join(directory, 'SHA256SUMS.txt'), checksums + '\n');
    console.log(`Verified ${names.length} downloads and update manifests`);
  } else throw new Error('Use version, desktop, or assets');
  console.log(`Release ${version} verified`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

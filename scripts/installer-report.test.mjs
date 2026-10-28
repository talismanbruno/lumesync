import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source=await readFile(new URL('../landing/downloads-core.js',import.meta.url),'utf8');
const {normalizeReleases,selectAsset,matchesInstallerReport}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const sha='a1530f93f4a49c3ae8170e7390b8768ce19be50d2adc60f75d16ce758af0f8de';
const filename='Lume-1.0.0-beta.25-x64.exe';
const release=(version,name,hash)=>({tag_name:'v'+version,published_at:version.endsWith('26')?'2026-10-28T00:00:00Z':'2026-10-27T00:00:00Z',assets:[{name,state:'uploaded',digest:'sha256:'+hash,browser_download_url:'https://github.com/talismanbruno/lumesync/releases/download/v'+version+'/'+name}]});

test('matches the report only to the exact published Windows installer bytes',()=>{
 const releases=normalizeReleases([release('1.0.0-beta.25',filename,sha)]);
 const asset=selectAsset(releases,'windows','x64').asset;
 assert.equal(asset.sha256,sha);assert.equal(matchesInstallerReport(asset,filename,sha),true);
 assert.equal(matchesInstallerReport({...asset,sha256:'b'.repeat(64)},filename,sha),false);
 assert.equal(matchesInstallerReport({...asset,name:filename.replace('x64','arm64')},filename,sha),false);
 assert.equal(matchesInstallerReport(undefined,filename,sha),false);
});

test('does not reuse an old report when the automatic download selects a new release',()=>{
 const latestName=filename.replace('25','26');
 const releases=normalizeReleases([release('1.0.0-beta.25',filename,sha),release('1.0.0-beta.26',latestName,'b'.repeat(64))]);
 assert.equal(matchesInstallerReport(selectAsset(releases,'windows','x64').asset,filename,sha),false);
});

test('rejects missing or malformed digests instead of treating them as proof',()=>{
 const raw=release('1.0.0-beta.25',filename,sha);
 for(const digest of [undefined,'sha1:'+sha,'sha256:invalid']){
  raw.assets[0].digest=digest;
  const asset=selectAsset(normalizeReleases([raw]),'windows','x64').asset;
  assert.equal(matchesInstallerReport(asset,filename,sha),false);
 }
});

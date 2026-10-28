import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source=await readFile(new URL('../landing/downloads-core.js',import.meta.url),'utf8');
const {normalizeReleases,selectAsset,matchesInstallerReport,selectInstallerReport,detectPlatform}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
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

test('every advertised platform report matches its own release asset and hash',async()=>{
 const html=await readFile(new URL('../landing/index.html',import.meta.url),'utf8');
 const reports=[...html.matchAll(/<a data-installer-report data-report-platform="([^"]+)" data-report-arch="([^"]*)" data-report-filename="([^"]+)" data-report-sha256="([^"]+)" href="([^"]+)"/g)];
 assert.equal(reports.length,7);
 const raw={tag_name:'v1.0.0-beta.25',published_at:'2026-10-27T23:12:56Z',assets:reports.map(([,p,a,name,hash])=>({name,state:'uploaded',digest:'sha256:'+hash,browser_download_url:'https://github.com/talismanbruno/lumesync/releases/download/v1.0.0-beta.25/'+name}))};
 const list=normalizeReleases([raw]);
 for(const [,platform,arch,name,hash,url] of reports){
  assert.equal(matchesInstallerReport(selectAsset(list,platform,arch||null)?.asset,name,hash),true,platform+' '+arch);
  assert.equal(url,'https://www.virustotal.com/gui/file/'+hash+'/detection');
 }
 assert(!html.includes('100% Seguro'));
});


test('automatic report follows the detected download platform and exact architecture',async()=>{
 const html=await readFile(new URL('../landing/index.html',import.meta.url),'utf8');
 const reports=[...html.matchAll(/data-report-platform="([^"]+)" data-report-arch="([^"]*)" data-report-filename="([^"]+)" data-report-sha256="([^"]+)"/g)].map(([,platform,arch,filename,sha256])=>({platform,arch,filename,sha256}));
 const releases=normalizeReleases([{tag_name:'v1.0.0-beta.25',published_at:'2026-10-27T23:12:56Z',assets:reports.map(r=>({name:r.filename,digest:'sha256:'+r.sha256,browser_download_url:'https://github.com/talismanbruno/lumesync/releases/download/v1.0.0-beta.25/'+r.filename}))}]);
 for(const report of reports){
  const found=selectInstallerReport(releases,reports,report.platform,report.arch||null);
  assert.equal(found.report.filename,selectAsset(releases,report.platform,report.arch||null).asset.name);
  assert.equal(found.report.sha256,report.sha256);
 }
 assert.equal(detectPlatform({userAgent:'Mozilla/5.0 (Linux; Android 15)'}),'android');
 assert.equal(detectPlatform({platform:'MacIntel',maxTouchPoints:0}),'mac');
 const mac=selectInstallerReport(releases,reports,'mac',null);
 assert.equal(mac.choice,true);assert.deepEqual(mac.reports.map(r=>r.arch),['arm64','x64']);
 assert.equal(selectInstallerReport(releases,reports,'ios',null),null);
 assert.equal(selectInstallerReport(releases,reports,'unknown',null),null);
 assert.equal(selectInstallerReport(releases.map(r=>({...r,assets:r.assets.map(a=>({...a,sha256:'b'.repeat(64)}))})),reports,'android',null),null);
});

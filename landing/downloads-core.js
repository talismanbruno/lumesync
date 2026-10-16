export const REPOSITORY='https://github.com/talismanbruno/lumesync';
export const RELEASE_API='https://api.github.com/repos/talismanbruno/lumesync/releases?per_page=30';
export function detectPlatform(nav){
  const ua=nav.userAgent||'',platform=nav.userAgentData?.platform||nav.platform||'';
  if(/Android/i.test(ua+' '+platform))return 'android';
  if(/iPhone|iPad|iPod/i.test(ua)||(/Mac/i.test(platform)&&nav.maxTouchPoints>1))return 'ios';
  if(/Mac/i.test(platform+' '+ua))return 'mac';
  if(/Win/i.test(platform+' '+ua))return 'windows';
  if(/Linux/i.test(platform+' '+ua))return 'linux';
  return 'unknown';
}
export async function detectArchitecture(nav,platform){
  try{
    const hints=await nav.userAgentData?.getHighEntropyValues(['architecture','bitness']);
    if(/arm|aarch64/i.test(hints?.architecture||''))return 'arm64';
    if(/x86|x64/i.test(hints?.architecture||''))return hints.bitness==='32'?'ia32':'x64';
  }catch{}
  if(platform==='mac')return null;
  if(/aarch64|arm64|armv8/i.test(nav.userAgent||''))return 'arm64';
  if(/i686|i386|Win32(?!.*Win64)/i.test(nav.userAgent||''))return 'ia32';
  return platform==='windows'||platform==='linux'?'x64':null;
}
export function normalizeReleases(input){
  if(!Array.isArray(input))throw Error('Invalid release response');
  return input.filter(r=>!r.draft&&r.published_at&&Array.isArray(r.assets)&&/^(?:lume-desktop-)?v?\d+\.\d+\.\d+/i.test(r.tag_name||''))
    .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))
    .map(r=>({tag:r.tag_name,url:REPOSITORY+'/releases/tag/'+encodeURIComponent(r.tag_name),assets:r.assets.filter(a=>(!a.state||a.state==='uploaded')&&typeof a.name==='string'&&a.browser_download_url?.startsWith(REPOSITORY+'/releases/download/')).map(a=>({name:a.name,url:a.browser_download_url}))}));
}
export function selectAsset(releases,platform,arch){
  for(const release of releases){
    const files=release.assets;
    let asset;
    const arm=a=>/(?:^|[-_.])(?:arm64|aarch64)(?:[-_.]|$)/i.test(a.name);
    const x64=a=>/(?:^|[-_.])(?:x64|x86_64|amd64)(?:[-_.]|$)/i.test(a.name);
    if(platform==='android')asset=files.find(a=>/\.apk$/i.test(a.name)&&!arm(a)&&!x64(a))||files.find(a=>/\.apk$/i.test(a.name)&&arm(a));
    if(platform==='windows'&&arch!=='ia32')asset=files.find(a=>/\.exe$/i.test(a.name)&&(arch==='arm64'?arm(a):x64(a)));
    if(platform==='linux'&&arch!=='ia32'){
      const match=arch==='arm64'?arm:x64;
      asset=files.find(a=>/\.AppImage$/i.test(a.name)&&match(a))||files.find(a=>/\.deb$/i.test(a.name)&&match(a));
    }
    if(platform==='mac'){
      asset=files.find(a=>/universal.*\.dmg$/i.test(a.name));
      if(!asset&&arch)asset=files.find(a=>/\.dmg$/i.test(a.name)&&(arch==='arm64'?arm(a):arch==='x64'&&x64(a)));
      if(!asset&&!arch&&files.some(a=>/\.dmg$/i.test(a.name)))return {release,choice:true};
    }
    if(asset)return {release,asset};
  }
  return null;
}

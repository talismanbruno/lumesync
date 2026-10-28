import {REPOSITORY,RELEASE_API,detectPlatform,detectArchitecture,normalizeReleases,selectAsset,matchesInstallerReport} from './downloads-core.js';
const platform=detectPlatform(navigator);
const labels={windows:'Windows',mac:'macOS',linux:'Linux',android:'Android'};
const buttons=[...document.querySelectorAll('[data-smart-download]')];
const dialog=document.querySelector('#mac-download-dialog');
const status=document.querySelector('#download-status');
let releases=[],fetchedAt=0,pending=null,busy=false,architecture=null;
function savedMac(){try{return ['arm64','x64'].includes(localStorage.getItem('lume.mac-architecture'))?localStorage.getItem('lume.mac-architecture'):null;}catch{return null;}}
const architectureReady=detectArchitecture(navigator,platform).then(value=>{architecture=value||(platform==='mac'?savedMac():null);return architecture;});
async function getReleases(){
  if(releases.length&&Date.now()-fetchedAt<60000)return releases;
  if(pending)return pending;
  pending=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    try{
      const response=await fetch(RELEASE_API,{headers:{Accept:'application/vnd.github+json'},credentials:'omit',signal:controller.signal});
      if(!response.ok)throw Error('Release unavailable');
      const next=normalizeReleases(await response.json());
      if(!next.length)throw Error('No published releases');
      releases=next;fetchedAt=Date.now();renderLinks();return releases;
    }finally{clearTimeout(timer);pending=null;}
  })();
  return pending;
}
function renderLinks(){
  // A scan belongs to exact bytes, not to every future Lume installer.
  // Hide a previously reviewed report when the current download changes.
  if(releases.length){

    for(const report of document.querySelectorAll('[data-installer-report]')){
      const asset=selectAsset(releases,report.dataset.reportPlatform,report.dataset.reportArch||null)?.asset;
      report.hidden=!matchesInstallerReport(asset,report.dataset.reportFilename,report.dataset.reportSha256);
    }
  }
  for(const button of buttons){
    const text=platform==='ios'?'Abrir no navegador':labels[platform]?'Baixar para '+labels[platform]:'Ver downloads';
    const label=button.querySelector('[data-download-label]');if(label)label.textContent=text;
    if(platform==='ios'){button.href='https://lumesocial.online/app/register';continue;}
    const selection=selectAsset(releases,platform,architecture);
    button.href=selection?.asset?.url||'#downloads';
  }
  for(const link of document.querySelectorAll('[data-platform-download]')){
    const target=link.dataset.platformDownload;
    const selection=selectAsset(releases,target,target===platform?architecture:target==='mac'?savedMac():'x64');
    if(selection?.asset)link.href=selection.asset.url;
    link.removeAttribute('target');
  }
  if(releases.length){
    document.querySelector('#download-version').textContent='Versão '+releases[0].tag.replace(/^v/,'');
    document.querySelector('#all-releases').href=REPOSITORY+'/releases';
  }
}
function start(asset){status.textContent='Seu download está começando.';location.assign(asset.url);}
async function download(target=platform){
  if(busy)return;
  if(target==='ios'){location.assign('https://lumesocial.online/app/register');return;}
  if(target==='unknown'){document.querySelector('#downloads').scrollIntoView({behavior:'smooth'});return;}
  busy=true;
  buttons.forEach(button=>button.setAttribute('aria-busy','true'));
  status.textContent='Preparando seu download…';
  try{
    await architectureReady;
    const list=await getReleases();
    const arch=target===platform?architecture:target==='mac'?savedMac():'x64';
    const selection=selectAsset(list,target,arch);
    if(selection?.choice){status.textContent='';dialog.showModal();}
    else if(selection?.asset)start(selection.asset);
    else{status.textContent='Não há um instalador compatível com este dispositivo. Você pode usar o Lume no navegador.';document.querySelector('#downloads').scrollIntoView({behavior:'smooth'});}
  }catch{status.textContent='Não foi possível buscar o download. Tente novamente ou veja todas as versões.';}
  finally{busy=false;buttons.forEach(button=>button.removeAttribute('aria-busy'));}
}
function plainClick(event){return event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey;}
buttons.forEach(button=>button.addEventListener('click',event=>{if(!plainClick(event))return;event.preventDefault();void download();}));
document.querySelectorAll('[data-platform-download]').forEach(link=>link.addEventListener('click',event=>{if(!plainClick(event))return;event.preventDefault();void download(link.dataset.platformDownload);}));
dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
dialog.querySelectorAll('[data-mac-architecture]').forEach(button=>button.addEventListener('click',()=>{
  const arch=button.dataset.macArchitecture;
  const selection=selectAsset(releases,'mac',arch);
  if(!selection?.asset){status.textContent='Essa versão não está disponível. Veja todas as versões.';dialog.close();return;}
  try{localStorage.setItem('lume.mac-architecture',arch);}catch{}
  if(platform==='mac')architecture=arch;
  renderLinks();dialog.close();start(selection.asset);
}));
renderLinks();
architectureReady.then(renderLinks);
void getReleases().catch(()=>{});

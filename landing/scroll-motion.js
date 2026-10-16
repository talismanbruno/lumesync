(() => {
  const root=document.documentElement;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const nav=document.querySelector('.site-nav');
  const records=[];
  const compact=innerWidth<=640;
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const record=records.find(record=>record.node===entry.target);
      if(!record)continue;
      record.entered=true;
      if(root.dataset.paused!=='true'&&!document.hidden)record.animation.play();
      observer.unobserve(entry.target);
    }
  },{rootMargin:'0px 0px -5% 0px',threshold:.08});
  function reveal(node,index=0,perspective=false){
    if(!node||motion.matches)return;
    const animation=node.animate([
      {opacity:0,transform:perspective?'perspective(1400px) translateY(42px) rotateX(5deg) scale(.97)':`translateY(${compact?18:26}px)`,filter:`blur(${perspective?0:compact?2:5}px)`},
      {opacity:1,transform:perspective?'perspective(1400px) translateY(0) rotateX(0) scale(1)':'translateY(0)',filter:'blur(0px)'}
    ],{duration:perspective?1050:800,delay:compact?0:index*95,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
    animation.pause();
    animation.currentTime=0;
    records.push({node,animation,entered:false});
    observer.observe(node);
  }
  document.querySelectorAll('.section-intro,.product-heading>div,.product-heading>p,.personal-copy,.download-heading,.download-section>.section-kicker').forEach(node=>reveal(node));
  document.querySelectorAll('.reason').forEach((node,index)=>reveal(node,index));
  reveal(document.querySelector('.capture-shell'),0,true);
  document.querySelectorAll('.download-options>a').forEach((node,index)=>reveal(node,index));
  function sync(){
    for(const record of records){
      if(record.animation.playState==='finished')continue;
      if(motion.matches)record.animation.finish();
      else if(document.hidden||root.dataset.paused==='true')record.animation.pause();
      else if(record.entered&&record.animation.playState==='paused')record.animation.play();
    }
  }
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-paused']});
  addEventListener('visibilitychange',sync);
  motion.addEventListener('change',sync);
  addEventListener('pointerdown',event=>{
    for(const record of records)if(record.entered&&record.node.contains(event.target)&&record.animation.playState!=='finished')record.animation.finish();
  },{passive:true});
  let pending=false,range=1;
  const update=()=>{pending=false;nav.style.setProperty('--page-read',String(Math.max(0,Math.min(1,scrollY/range))));};
  new ResizeObserver(()=>{range=Math.max(1,document.documentElement.scrollHeight-innerHeight);update();}).observe(document.body);
  addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});
  update();
})();

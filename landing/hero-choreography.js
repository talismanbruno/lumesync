(() => {
  const root = document.documentElement;
  if (root.dataset.hook !== 'light') return;
  const hero = document.querySelector('.home-hero');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const replayButton = document.querySelector('.replay-intro');
  let animations = [], inView = true, accelerated = false;
  function sync() {
    const paused = root.dataset.paused === 'true' || document.hidden || !inView;
    replayButton.disabled = reduced.matches;
    for (const animation of animations) {
      if (animation.playState === 'finished' || animation.playState === 'idle') continue;
      if (reduced.matches) animation.finish();
      else if (paused && animation.playState !== 'paused') animation.pause();
      else if (!paused && animation.playState === 'paused') animation.play();
    }
  }
  function animate(node, frames, delay, duration) {
    if (node) animations.push(node.animate(frames, { delay, duration, fill:'backwards', easing:'cubic-bezier(.16,1,.3,1)' }));
  }
  function enter() {
    animations.forEach(animation => animation.cancel());
    animations=[]; accelerated=false;
    if (reduced.matches) { sync(); return; }
    const brand = document.querySelector('.site-nav .site-brand');
    animate(brand.querySelector('img'),[{opacity:.1,transform:'scale(.86)',filter:'blur(3px)'},{opacity:1,transform:'scale(1)',filter:'blur(0)'}],0,650);
    animate(hero.querySelector('.hero-positioning'),[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],70,700);
    const lines=[...hero.querySelectorAll('.hero-title-line')];
    lines.forEach((line,index) => animate(line,[{opacity:0,transform:'translateY(26px)',filter:'blur(8px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],130+index*110,900));
    const reveal=[
      ['.description',360,760,16,5],
      ['.primary-button',490,680,12,3],
      ['.browser-link',565,680,12,3],
      ['.platforms',660,650,5,0],
      ['.small-signature',735,650,8,0]
    ];
    reveal.forEach(([selector,delay,duration,y,blur]) => animate(hero.querySelector(selector),[{opacity:0,transform:`translateY(${y}px)`,filter:`blur(${blur}px)`},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],delay,duration));
    sync();
  }
  function accelerate() {
    if (accelerated) return;
    accelerated=true;
    animations.forEach(animation => { if(animation.playState!=='finished') animation.updatePlaybackRate(3); });
  }
  ['wheel','pointerdown','keydown','touchstart'].forEach(type => addEventListener(type,accelerate,{passive:true}));
  new IntersectionObserver(entries => {inView=entries[0].isIntersecting;sync();}).observe(hero);
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-paused']});
  addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  replayButton.addEventListener('click',() => {
    if (reduced.matches) return;
    scrollTo({top:0,behavior:'smooth'});
    enter();
    dispatchEvent(new Event('lume:replay-intro'));
  });
  enter();
})();

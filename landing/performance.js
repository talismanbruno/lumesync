(() => {
  const root = document.getElementById('lume-performance');
  if (!root) return;
  const race = root.querySelector('.lp-race');
  const lume = root.querySelector('.lp-lume');
  const discord = root.querySelector('.lp-discord');
  const lumeFill = lume.querySelector('.lp-fill');
  const discordFill = discord.querySelector('.lp-fill');
  const rocket = lume.querySelector('.lp-racer');
  const turtle = discord.querySelector('.lp-racer');
  const timer = root.querySelector('.lp-timer');
  const status = root.querySelector('.lp-race-status');
  const replay = root.querySelector('.lp-replay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function blocked() { return document.hidden || document.documentElement.dataset.paused === 'true'; }
  let entered = false;
  let running = false;
  let elapsed = 0;
  let started = 0;
  let frame = 0;
  let stage = '';
  root.dataset.raceState = 'waiting';
  root.dataset.racePaused = 'false';
  function draw(seconds) {
    const time = Math.max(0, Math.min(seconds, 19.81));
    const lumeProgress = Math.min(time / 4.22, 1) * 100 + '%';
    const discordProgress = Math.min(time / 19.81, 1) * 100 + '%';
    lumeFill.style.width = lumeProgress;
    discordFill.style.width = discordProgress;
    rocket.style.left = lumeProgress;
    turtle.style.left = discordProgress;
    timer.textContent = time.toFixed(2).replace('.', ',') + ' s';
    lume.classList.toggle('is-finished', time >= 4.22);
    discord.classList.toggle('is-finished', time >= 19.81);
    const next = time >= 19.81 ? 'finished' : time >= 4.22 ? 'winner' : 'running';
    root.dataset.raceState = next;
    if (next === 'finished') root.dataset.racePaused = 'false';
    if (next !== stage) {
      stage = next;
      status.textContent = next === 'finished' ? 'Lume pronto 15,59 s antes, neste teste.' : next === 'winner' ? 'Lume chegou! O Discord continua abrindo.' : 'Os dois partem juntos.';
    }
  }
  function pause() {
    if (!running) return;
    elapsed = Math.min(19.81, elapsed + (performance.now() - started) / 1000);
    running = false;
    root.dataset.racePaused = 'true';
    cancelAnimationFrame(frame);
  }
  function tick(now) {
    if (!running) return;
    if (blocked()) { pause(); return; }
    const seconds = Math.min(19.81, elapsed + (now - started) / 1000);
    draw(seconds);
    if (seconds >= 19.81) { elapsed = 19.81; running = false; return; }
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (running || elapsed >= 19.81 || blocked()) return;
    if (reduced.matches) { elapsed = 19.81; draw(elapsed); return; }
    running = true;
    root.dataset.racePaused = 'false';
    started = performance.now();
    frame = requestAnimationFrame(tick);
  }
  function start() {
    pause();
    entered = true;
    elapsed = 0;
    stage = '';
    draw(0);
    root.dataset.racePaused = String(blocked());
    play();
  }
  new MutationObserver(() => { if (blocked()) pause(); else if (entered) play(); }).observe(document.documentElement, { attributes:true, attributeFilter:['data-paused'] });
  replay.addEventListener('click', start);
  document.addEventListener('visibilitychange', () => { if (blocked()) pause(); else if (entered) play(); });
  addEventListener('pagehide', pause);
  addEventListener('pageshow', () => { if (entered) play(); });
  reduced.addEventListener('change', () => { if (reduced.matches) { pause(); elapsed = 19.81; draw(elapsed); } });
  if (reduced.matches) { entered = true; elapsed = 19.81; draw(elapsed); }
  else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entered && entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .2)) {
        observer.disconnect();
        start();
      }
    }, { threshold:.2 });
    observer.observe(race);
  } else { entered = true; elapsed = 19.81; draw(elapsed); }
})();

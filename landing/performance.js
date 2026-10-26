(() => {
  const section = document.getElementById('desempenho');
  if (!section) return;
  const intro = section.querySelector('.lpr-intro');
  const replay = section.querySelector('.lpr-replay');
  const replayText = replay.querySelector('span');
  const timer = section.querySelector('.lpr-timer');
  const lumeBar = section.querySelector('.lpr-race-lume');
  const discordBar = section.querySelector('.lpr-race-discord');
  const ready = section.querySelector('.lpr-ready');
  const status = section.querySelector('.lpr-race-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const lumeSeconds = 4.22;
  const discordSeconds = 19.81;
  let entered = false;
  let frame = 0;
  let phase = 'waiting';
  let elapsedMs = 0;
  let startedAt = 0;
  let lumeReady = false;
  let arrival;

  function state(next) {
    phase = next;
    section.dataset.raceState = next;
  }
  function draw(seconds) {
    lumeBar.style.width = (Math.min(seconds, lumeSeconds) / discordSeconds * 100) + '%';
    discordBar.style.width = (seconds / discordSeconds * 100) + '%';
    timer.textContent = seconds.toFixed(2).replace('.', ',') + ' s';
    if (seconds >= lumeSeconds && !lumeReady) {
      lumeReady = true;
      ready.style.visibility = 'visible';
      status.textContent = 'Lume pronto. O Discord continua abrindo.';
    }
  }
  function finish() {
    cancelAnimationFrame(frame);
    state('finished');
    elapsedMs = discordSeconds * 1000;
    draw(discordSeconds);
    ready.style.visibility = 'visible';
    replayText.textContent = 'Repetir corrida';
    status.textContent = 'Lume pronto 15,59 s antes, neste teste.';
  }
  function blocked() {
    return document.hidden || document.documentElement.dataset.paused === 'true';
  }
  function tick(now) {
    if (phase !== 'running') return;
    if (blocked()) { pause(); return; }
    const seconds = Math.min(discordSeconds, (elapsedMs + now - startedAt) / 1000);
    draw(seconds);
    if (seconds >= discordSeconds) { finish(); return; }
    frame = requestAnimationFrame(tick);
  }
  function play() {
    state('running');
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    if (phase !== 'running') return;
    elapsedMs = Math.min(discordSeconds * 1000, elapsedMs + performance.now() - startedAt);
    cancelAnimationFrame(frame);
    state('paused');
  }
  function sync() {
    if (!entered || phase === 'finished') return;
    if (motion.matches) { finish(); return; }
    if (blocked()) { pause(); return; }
    if (phase !== 'running') play();
  }
  function start() {
    entered = true;
    arrival?.disconnect();
    cancelAnimationFrame(frame);
    elapsedMs = 0;
    lumeReady = false;
    state('paused');
    if (motion.matches) { finish(); return; }
    ready.style.visibility = 'hidden';
    draw(0);
    replayText.textContent = 'Recomeçar corrida';
    status.textContent = 'Comparação iniciada.';
    sync();
  }
  state('waiting');
  if (!motion.matches) {
    ready.style.visibility = 'hidden';
    draw(0);
    status.textContent = 'A corrida começa ao entrar nesta seção.';
  }
  replay.addEventListener('click', start);
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  addEventListener('pagehide', pause);
  addEventListener('pageshow', sync);
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-paused'],
  });
  if ('IntersectionObserver' in window) {
    arrival = new IntersectionObserver(entries => {
      if (!entered && entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .12)) start();
    }, { threshold: .12 });
    arrival.observe(intro);
  } else {
    // Older browsers retain the complete comparison without a scroll animation.
    entered = true;
    finish();
  }
})();

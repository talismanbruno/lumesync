const landingRoot = document.documentElement;
const hook = "light";
landingRoot.dataset.hook = hook;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
function reduced() { return motionPreference.matches || landingRoot.dataset.paused === 'true'; }
const liveProfile = document.querySelector('#live-profile');
const profileStage = document.querySelector('.profile-stage');
const replay = document.querySelector('.replay-profile');
let visibleProfile = false;
let lastProfileState;
function syncProfile(force = false) {
  const animated = visibleProfile && !document.hidden && !reduced();
  replay.disabled = !animated;
  document.querySelector('.profile-live-status').textContent = reduced() ? 'Movimento reduzido · perfil real' : 'Perfil real · conteúdo demo';
  if (force || lastProfileState !== animated) {
    liveProfile.contentWindow?.postMessage({ type: 'lume-profile-control', animated }, location.origin);
    lastProfileState = animated;
  }
}
new IntersectionObserver(entries => { visibleProfile = entries[0].isIntersecting && entries[0].intersectionRatio >= .35; syncProfile(); }, { rootMargin: '-85px 0px -20px 0px', threshold: [0, .35] }).observe(liveProfile);
liveProfile.addEventListener('load', () => syncProfile(true));
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== liveProfile.contentWindow) return;
  if (event.data?.type === 'lume-profile-ready') syncProfile(true);
  if (event.data?.type === 'lume-profile-size' && Number.isFinite(event.data.height) && event.data.height >= 120 && event.data.height <= 1600) {
    const height = Math.ceil(event.data.height) + 'px';
    if (liveProfile.style.height !== height) liveProfile.style.height = height;
  }
});
replay.addEventListener('click', () => { if (!reduced()) liveProfile.contentWindow?.postMessage({ type: 'lume-profile-control', animated: true, replay: true }, location.origin); });
function syncMotion() { syncProfile(); }
new MutationObserver(syncMotion).observe(landingRoot, { attributes: true, attributeFilter: ['data-paused'] });
motionPreference.addEventListener('change', syncMotion);
addEventListener('visibilitychange', syncMotion);
syncMotion();

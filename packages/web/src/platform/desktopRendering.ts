/** Avoid nested backdrop sampling on Retina Electron windows; browsers keep their normal material. */
export function configureDesktopRendering() {
  if (window.backspace?.platform === 'darwin') document.documentElement.dataset.lumeRuntime = 'mac-desktop';
  else delete document.documentElement.dataset.lumeRuntime;
}

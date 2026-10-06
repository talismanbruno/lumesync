import { t as uiText } from '../i18n';
import { useUIStore } from '../stores/uiStore';

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

export function getVoiceFullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as FullscreenDocument).webkitFullscreenElement ?? null;
}

export async function exitVoiceFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  if (document.exitFullscreen) await document.exitFullscreen();
  else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
  useUIStore.getState().setVoiceFullscreen(false);
}

// Call directly from the button's click handler. Deferring the native request
// to a React effect can lose the user gesture required by the browser.
export async function toggleVoiceFullscreen(target: HTMLElement | null): Promise<void> {
  if (!target) return;
  const ui = useUIStore.getState();
  try {
    if (getVoiceFullscreenElement() === target) {
      await exitVoiceFullscreen();
    } else if (ui.voiceFullscreen) {
      ui.setVoiceFullscreen(false);
    } else {
      ui.setVoiceFullscreen(true);
      const element = target as FullscreenElement;
      const request = element.requestFullscreen ?? element.webkitRequestFullscreen;
      // Older mobile browsers have no element fullscreen API. The view can
      // still expand to the viewport, while supported browsers use native mode.
      if (request) await request.call(element);
    }
  } catch {
    ui.setVoiceFullscreen(false);
    ui.addToast(uiText("Não foi possível abrir a tela cheia. Tente novamente."), 'warning');
  }
}

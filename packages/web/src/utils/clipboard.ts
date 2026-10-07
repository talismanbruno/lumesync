import { isElectron } from '../platform/platform';

function copySelection(text: string): boolean {
  const focused = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.tabIndex = -1;
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
  document.body.appendChild(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    input.remove();
    if (focused instanceof HTMLElement && focused.isConnected) {
      focused.focus({ preventScroll: true });
    }
  }
}

/** Call from a user action. Older desktop builds deny the asynchronous API,
 * but still support copying a selection during the original click. */
export async function copyText(text: string): Promise<boolean> {
  const desktop = isElectron();
  if (desktop && copySelection(text)) return true;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return desktop ? false : copySelection(text);
  }
}

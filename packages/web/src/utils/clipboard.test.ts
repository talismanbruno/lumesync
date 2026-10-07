import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const writeText = vi.fn();
const execCopy = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  execCopy.mockReset().mockReturnValue(false);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCopy });
});

afterEach(() => {
  delete window.backspace;
  document.body.replaceChildren();
});

describe('copyText', () => {
  it('uses the asynchronous clipboard API in a browser', async () => {
    expect(await copyText('https://lumesocial.online/join/example')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://lumesocial.online/join/example');
    expect(execCopy).not.toHaveBeenCalled();
  });

  it('copies a selection when browser clipboard access is denied', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    execCopy.mockImplementation(() => {
      const selection = document.activeElement as HTMLTextAreaElement;
      expect(selection.value).toBe('invite');
      expect(selection.selectionEnd! - selection.selectionStart!).toBe(6);
      return true;
    });
    expect(await copyText('invite')).toBe(true);
    expect(execCopy).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('copies synchronously in an older desktop build before yielding the click gesture', async () => {
    // Only the existence of the preload bridge is relevant to this path.
    window.backspace = {} as BackspaceElectronAPI;
    writeText.mockRejectedValue(new Error('Denied by desktop policy'));
    execCopy.mockReturnValue(true);
    const result = copyText('desktop invite');
    expect(execCopy).toHaveBeenCalledWith('copy');
    expect(await result).toBe(true);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('uses the modern API if selection copy is unavailable on desktop', async () => {
    window.backspace = {} as BackspaceElectronAPI;
    expect(await copyText('invite')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('invite');
  });

  it('works when the asynchronous clipboard API is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    execCopy.mockReturnValue(true);
    expect(await copyText('invite')).toBe(true);
  });

  it('reports failure instead of a false success when both methods are blocked', async () => {
    writeText.mockRejectedValue(new Error('Denied'));
    expect(await copyText('invite')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('cleans up and restores focus if selection copy throws', async () => {
    writeText.mockRejectedValue(new Error('Denied'));
    execCopy.mockImplementation(() => { throw new Error('Unavailable'); });
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    expect(await copyText('invite')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});

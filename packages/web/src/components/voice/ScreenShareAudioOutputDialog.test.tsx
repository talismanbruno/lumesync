import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ScreenShareAudioOutputDialog } from './ScreenShareAudioOutputDialog';
import { requestScreenAudioOutput, useScreenShareAudioOutputStore } from '../../stores/screenShareAudioOutputStore';

afterEach(() => { act(() => useScreenShareAudioOutputStore.getState().request?.choose('cancel')); cleanup(); });
function open(devices = [{ deviceId: 'headphones', label: 'Fone USB' }]) {
  render(<ScreenShareAudioOutputDialog />);
  const abort = new AbortController();
  let pending!: ReturnType<typeof requestScreenAudioOutput>;
  act(() => { pending = requestScreenAudioOutput('FxSound Speakers', devices, abort.signal); });
  return { pending, abort };
}
it('makes a direct output choice explicit before resolving the capture request', async () => {
  const { pending } = open();
  expect(screen.getByRole('dialog')).toHaveTextContent('FxSound Speakers');
  expect(screen.getByRole('combobox')).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta saída e compartilhar' }));
  await expect(pending).resolves.toEqual({ deviceId: 'headphones' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('provides a deliberate video-only fallback if no direct device is available', async () => {
  const { pending } = open([]);
  expect(screen.getByRole('button', { name:'Usar esta saída e compartilhar' })).toBeDisabled();
  expect(screen.getByRole('button', { name:'Compartilhar sem áudio do sistema' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name:'Compartilhar sem áudio do sistema' }));
  await expect(pending).resolves.toBe('silent');
});
it('cancels on Escape and does not apply a device choice', async () => {
  const { pending } = open(); fireEvent.keyDown(document, { key:'Escape' });
  await expect(pending).resolves.toBe('cancel');
});
it('closes when screen capture is cancelled externally', async () => {
  const { pending, abort } = open(); act(() => abort.abort());
  await expect(pending).resolves.toBe('cancel'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps keyboard focus inside the dialog', () => {
  open(); const cancel = screen.getByRole('button', {name:'Cancelar'}); cancel.focus();
  fireEvent.keyDown(document, {key:'Tab'}); expect(screen.getByRole('combobox')).toHaveFocus();
  fireEvent.keyDown(document, {key:'Tab',shiftKey:true}); expect(cancel).toHaveFocus();
});

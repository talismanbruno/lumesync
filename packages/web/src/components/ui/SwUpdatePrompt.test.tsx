import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ update: vi.fn().mockResolvedValue(undefined), registrationUpdate: vi.fn().mockResolvedValue(undefined), register: vi.fn() }));
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: (options: { onRegisteredSW: (url: string, registration: unknown) => void }) => {
  state.register(); options.onRegisteredSW('/sw.js', { update: state.registrationUpdate });
  return { needRefresh: [true], updateServiceWorker: state.update };
} }));
vi.mock('../../stores/voiceStore', async () => { const { create } = await import('zustand'); return { useVoiceStore: create(() => ({ currentVoiceChannelId: null, activeDmCall: null, outgoingCall: null })) }; });
vi.mock('../../stores/transferStore', async () => { const { create } = await import('zustand'); return { useTransferStore: create(() => ({ transfers: new Map() })) }; });
import { SwAutoUpdate } from './SwUpdatePrompt';
import { useVoiceStore } from '../../stores/voiceStore';

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('backspace', undefined); useVoiceStore.setState({ currentVoiceChannelId: null, activeDmCall: null, outgoingCall: null }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (navigator as { serviceWorker?: unknown }).serviceWorker; });

it('uses only the native updater on Desktop and unregisters only Lume workers', async () => {
  vi.stubGlobal('backspace', { platform: 'win32' });
  const unregister = vi.fn().mockResolvedValue(true), other = vi.fn();
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistrations: async () => [
    { active: { scriptURL: location.origin + '/sw.js' }, unregister },
    { active: { scriptURL: location.origin + '/other-worker.js' }, unregister: other },
  ] } });
  render(<SwAutoUpdate />);
  await waitFor(() => expect(unregister).toHaveBeenCalledOnce());
  expect(other).not.toHaveBeenCalled(); expect(state.register).not.toHaveBeenCalled();
  expect(screen.queryByText('Atualização pronta')).toBeNull();
});

it('requires confirmation and blocks browser reloads during a call', () => {
  useVoiceStore.setState({ currentVoiceChannelId: 'voice' });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<SwAutoUpdate />);
  const button = screen.getByRole('button', { name: 'Atualizar' });
  expect(button).toBeDisabled(); fireEvent.click(button); expect(state.update).not.toHaveBeenCalled();
  act(() => useVoiceStore.setState({ currentVoiceChannelId: null }));
  fireEvent.click(button); expect(confirm).toHaveBeenCalledOnce(); expect(state.update).toHaveBeenCalledWith(true);
});

it('stops periodic worker checks when the browser prompt unmounts', async () => {
  vi.useFakeTimers(); const { unmount } = render(<SwAutoUpdate />);
  await act(() => vi.advanceTimersByTimeAsync(60_000)); expect(state.registrationUpdate).toHaveBeenCalledOnce();
  unmount(); await act(() => vi.advanceTimersByTimeAsync(120_000)); expect(state.registrationUpdate).toHaveBeenCalledOnce();
});

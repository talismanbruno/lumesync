import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DesktopPanel } from './DesktopPanel';
import { UpdateToast } from '../../ui/UpdateToast';
import { useVoiceStore } from '../../../stores/voiceStore';

vi.mock('../../../stores/voiceStore', async () => {
  const { create } = await import('zustand');
  return { useVoiceStore: create(() => ({ currentVoiceChannelId: null, activeDmCall: null, outgoingCall: null })) };
});

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

it('shows the installed version, reports update events and restarts from the anchored notice', async () => {
  const initial: RecoveryState = {
    mode: 'normal', reason: null, updateState: 'idle', updateVersion: null,
    lastUpdateError: null, lastCheckResult: null,
  };
  const listeners = new Set<(state: RecoveryState) => void>();
  const installUpdate = vi.fn();
  const checkForUpdates = vi.fn();
  vi.stubGlobal('backspace', {
    platform: 'win32',
    getAutoLaunchSettings: vi.fn().mockResolvedValue({ openAtLogin: false, startMinimized: false }),
    getVersion: vi.fn().mockResolvedValue('1.0.0-beta.26'),
    getRuntimeInfo: vi.fn().mockResolvedValue({ platform: 'win32', updatesSupported: true }),
    getRecoveryState: vi.fn().mockResolvedValue(initial),
    onRecoveryStateChanged: (receive: (state: RecoveryState) => void) => {
      listeners.add(receive);
      return () => listeners.delete(receive);
    },
    checkForUpdates,
    installUpdate,
  });
  useVoiceStore.setState({ currentVoiceChannelId: null, activeDmCall: null, outgoingCall: null });
  render(<><DesktopPanel /><UpdateToast anchored /></>);
  expect(await screen.findByText('Versão 1.0.0-beta.26')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Verificar atualizações' }));
  expect(checkForUpdates).toHaveBeenCalledTimes(1);

  const emit = (patch: Partial<RecoveryState>) => act(() => listeners.forEach(listener => listener({ ...initial, ...patch })));
  emit({ lastCheckResult: 'up-to-date' });
  expect(screen.getByText('Você está usando a versão mais recente')).toBeVisible();
  emit({ updateState: 'downloading', updateVersion: '1.0.0-beta.27' });
  expect(screen.getAllByText('Baixando a versão 1.0.0-beta.27… 0%')).toHaveLength(2);
  expect(screen.getByText('Atualização disponível')).toBeVisible();
  emit({ updateState: 'downloaded', updateVersion: '1.0.0-beta.27' });
  const notice = screen.getByText('Atualização disponível').closest('.bottom-full')!;
  expect(notice).toHaveClass('bottom-full');
  expect(screen.getByText('Versão 1.0.0-beta.26')).toBeVisible();

  act(() => useVoiceStore.setState({ currentVoiceChannelId: 'voice' }));
  expect(screen.getByRole('button', { name: 'Em chamada' })).toBeDisabled();
  act(() => useVoiceStore.setState({ currentVoiceChannelId: null }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Atualizar e reiniciar' }).at(-1)!);
  expect(installUpdate).toHaveBeenCalledTimes(1);
});

it('shows real update errors and remembers dismissal across remounts for the same version', async () => {
  const initial: RecoveryState = { mode: 'normal', reason: null, updateState: 'downloading', updateVersion: '1.0.0-beta.27', lastUpdateError: null, lastCheckResult: null, updateProgress: { percent: 42, transferred: 420, total: 1000 } };
  const listeners = new Set<(state: RecoveryState) => void>();
  vi.stubGlobal('backspace', { platform: 'win32', getRecoveryState: async () => initial, onRecoveryStateChanged: (receive: (state: RecoveryState) => void) => { listeners.add(receive); return () => listeners.delete(receive); } });
  const mounted = render(<UpdateToast anchored />);
  expect(await screen.findByRole('progressbar')).toHaveAttribute('value', '42');
  act(() => listeners.forEach(receive => receive({ ...initial, updateState: 'error', lastUpdateError: { message: 'ECONNRESET: connection closed', code: 'ECONNRESET', at: 1 } })));
  expect(screen.getByText('ECONNRESET: connection closed')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  mounted.unmount();
  render(<UpdateToast anchored />);
  await act(async () => {});
  expect(screen.queryByText('Atualização disponível')).toBeNull();
});

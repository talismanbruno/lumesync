import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AudioDevicePanel } from './AudioDevicePanel';

const props = () => ({ kind: 'input' as const, deviceId: 'default', deviceLabel: 'Padrão do sistema', devices: [{ deviceId: 'usb-mic', label: 'Microfone USB' }] as MediaDeviceInfo[], deviceLabels: new Map([['usb-mic', 'Microfone USB']]), permission: 'granted' as const, requestPermission: vi.fn().mockResolvedValue(undefined), onSelectDevice: vi.fn(), volume: 100, onVolumeChange: vi.fn(), level: 0.25, onClose: vi.fn(), onSettings: vi.fn() });

describe('audio device panel', () => {
  it('requests microphone permission only after an explicit click', async () => {
    const options = { ...props(), permission: 'prompt' as const };
    render(<AudioDevicePanel {...options} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispositivo de entrada/ }));
    expect(options.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Permitir acesso' }));
    await waitFor(() => expect(options.requestPermission).toHaveBeenCalledOnce());
  });

  it('sends the selected device id and closes the list', () => {
    const options = props();
    render(<AudioDevicePanel {...options} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispositivo de entrada/ }));
    expect(screen.getByRole('radio', { name: 'Padrão do sistema' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Microfone USB' }));
    expect(options.onSelectDevice).toHaveBeenCalledWith('usb-mic');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('keeps the full volume range and restores 100%', () => {
    const options = props();
    function Panel() {
      const [volume, setVolume] = useState(100);
      return <AudioDevicePanel {...options} volume={volume} onVolumeChange={setVolume} />;
    }
    render(<Panel />);
    const slider = screen.getByRole('slider', { name: 'Volume do microfone' });
    for (const value of [0, 200, 65]) {
      fireEvent.change(slider, { target: { value } });
      expect(slider).toHaveValue(String(value));
      expect(slider).toHaveAttribute('aria-valuetext', `${value}%`);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar volume do microfone para 100%' }));
    expect(slider).toHaveValue('100');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '25');
  });

  it('closes with Escape and returns focus to the opening button', () => {
    function Menu() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Abrir áudio</button>{open && <AudioDevicePanel {...props()} onClose={() => setOpen(false)} />}</>;
    }
    render(<Menu />);
    const trigger = screen.getByRole('button', { name: 'Abrir áudio' });
    trigger.focus();
    fireEvent.click(trigger);
    screen.getByRole('slider').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('slider')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('explains a rejected permission request and allows retry', async () => {
    const options = { ...props(), permission: 'prompt' as const, requestPermission: vi.fn().mockRejectedValue(new Error('Denied')) };
    render(<AudioDevicePanel {...options} />);
    fireEvent.click(screen.getByRole('button', { name: /Dispositivo de entrada/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Permitir acesso' }));
    await screen.findByText(/Acesso ao microfone bloqueado/);
    expect(screen.getByRole('button', { name: 'Permitir acesso' })).toBeEnabled();
  });
});

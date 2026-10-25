import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePortalContainer } from '../../hooks/usePortalContainer';
import { useScreenShareAudioOutputStore } from '../../stores/screenShareAudioOutputStore';
import { t } from '../../i18n';

export function ScreenShareAudioOutputDialog() {
  const request = useScreenShareAudioOutputStore(s => s.request);
  const [selected, setSelected] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const portal = usePortalContainer();
  useEffect(() => {
    if (!request) return;
    setSelected(request.devices[0]?.deviceId ?? '');
    const previous = document.activeElement;
    (selectRef.current ?? dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') request.choose('cancel');
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('select,button:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [request]);
  if (!request) return null;
  return createPortal(<div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="screen-audio-title" aria-describedby="screen-audio-description" className="w-full max-w-md rounded-2xl border border-border-soft bg-surface-channel p-5 shadow-2xl">
      <h2 id="screen-audio-title" className="text-lg font-semibold text-txt-primary">{t('Compartilhar sem retorno da chamada')}</h2>
      <p id="screen-audio-description" className="mt-2 text-sm text-txt-secondary">{t('A saída {0} pode colocar as vozes da chamada na transmissão. Escolha o fone ou alto-falante diretamente para manter o som do conteúdo sem esse retorno.', [request.deviceLabel])}</p>
      {request.devices.length > 0 && <label className="mt-4 block text-sm text-txt-primary">{t('Ouvir a chamada em')}
        <select ref={selectRef} className="mt-2 w-full rounded-lg border border-border-soft bg-surface-base p-2.5" value={selected} onChange={event => setSelected(event.target.value)}>
          {request.devices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </label>}
      <p className="mt-3 text-xs text-txt-tertiary">{t('A mudança vale para o som do Lume. Os outros aplicativos continuam usando a saída atual.')}</p>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" disabled={!selected} onClick={() => request.choose({ deviceId: selected })} className="rounded-lg bg-accent-primary px-3 py-2.5 font-semibold text-surface-base disabled:opacity-40">{t('Usar esta saída e compartilhar')}</button>
        <button type="button" onClick={() => request.choose('silent')} className="rounded-lg bg-surface-base px-3 py-2 text-sm text-txt-primary">{t('Compartilhar sem áudio do sistema')}</button>
        <button type="button" onClick={() => request.choose('cancel')} className="rounded-lg px-3 py-2 text-sm text-txt-secondary">{t('Cancelar')}</button>
      </div>
    </section>
  </div>, portal);
}

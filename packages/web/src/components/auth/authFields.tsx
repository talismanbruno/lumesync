import { useState } from 'react';

export function PasswordField({ id, label, value, onChange, creating = false, confirmation = false }: { id: string; label: string; value: string; onChange: (value: string) => void; creating?: boolean; confirmation?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div>
    <label htmlFor={id} className="block mb-2 text-sm font-semibold text-txt-secondary">{label}</label>
    <div className="relative"><input id={id} name={id} type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} className="input-standard w-full py-3 pr-20 text-base" autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : undefined} maxLength={1024} aria-describedby={creating && !confirmation ? `${id}-requirements` : undefined} required />
      <button type="button" onClick={() => setVisible(value => !value)} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-txt-tertiary hover:text-txt-primary">{visible ? 'Ocultar' : 'Mostrar'}</button></div>
    {creating && !confirmation && <div id={`${id}-requirements`} className="mt-3 text-xs leading-5">
      <ul aria-label="Critérios da senha"><li className={`flex items-center gap-2 ${value.length >= 8 ? 'text-status-online' : 'text-txt-tertiary'}`}>
        <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${value.length >= 8 ? 'border-status-online bg-status-online/10' : 'border-white/20'}`}>{value.length >= 8 && <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>}</span>
        <span>Pelo menos 8 caracteres<span className="sr-only">{value.length >= 8 ? ' — atendido' : ' — pendente'}</span></span>
      </li></ul>
      <p className="mt-1.5 text-txt-tertiary">Dica: use uma frase longa e exclusiva para sua conta.</p>
    </div>}
  </div>;
}

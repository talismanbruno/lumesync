import { useId, useState } from 'react';
import type { ReactNode } from 'react';

export function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="relative inline-flex normal-case font-normal">
    <button type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-xs text-txt-tertiary hover:text-accent-primary focus-visible:outline focus-visible:outline-accent-primary">?</button>
    {open && <span id={id} role="note" className="absolute top-7 left-0 -translate-x-1/4 z-20 w-60 rounded-xl border border-white/10 bg-surface-base p-3 text-xs leading-5 text-txt-secondary shadow-xl">{children}</span>}
  </span>;
}

export function PasswordField({ id, label, value, onChange, creating = false, confirmation = false }: { id: string; label: string; value: string; onChange: (value: string) => void; creating?: boolean; confirmation?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div>
    <div className="flex items-center gap-2 mb-2"><label htmlFor={id} className="text-sm font-semibold text-txt-secondary">{label}</label>{!confirmation && <FieldHelp label={`Ajuda sobre ${label.toLowerCase()}`}>{creating ? 'Use pelo menos 8 caracteres. Uma frase longa e exclusiva é uma boa escolha.' : 'Digite a senha que você escolheu ao criar sua conta. Se não lembrar, use “Esqueci minha senha”.'}</FieldHelp>}</div>
    <div className="relative"><input id={id} name={id} type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} className="input-standard w-full py-3 pr-20 text-base" autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : undefined} maxLength={1024} aria-describedby={creating && !confirmation ? `${id}-requirements` : undefined} required />
      <button type="button" onClick={() => setVisible(value => !value)} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-txt-tertiary hover:text-txt-primary">{visible ? 'Ocultar' : 'Mostrar'}</button></div>
    {creating && !confirmation && <p id={`${id}-requirements`} className="mt-2 text-xs leading-5 text-txt-tertiary">Pelo menos 8 caracteres. Prefira uma frase longa que você não use em outro lugar.</p>}
  </div>;
}

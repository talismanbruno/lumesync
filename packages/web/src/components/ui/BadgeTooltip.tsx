import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { usePortalContainer } from '../../hooks/usePortalContainer';

/** Shared nameplate for profile badges, outside clipped cards and sidebars. */
export function BadgeTooltip({ name, label = name, className = '', children }: {
  name: string;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const floating = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const container = usePortalContainer();
  const { style, actualPlacement } = useFloatingPosition(anchor, floating, {
    placement: 'top', offset: 10, enabled: open,
  });
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); };
  const show = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(true), 120);
  };
  const hide = () => {
    clearTimer();
    if (!focused.current) timer.current = setTimeout(() => setOpen(false), 100);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      clearTimeout(timer.current);
      setOpen(false);
    };
    document.addEventListener('keydown', dismiss, true);
    return () => document.removeEventListener('keydown', dismiss, true);
  }, [open]);

  return (
    <span ref={anchor} role="img" aria-label={label} aria-describedby={open ? id : undefined}
      tabIndex={0}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-chat ${className}`}
      onMouseEnter={show} onMouseLeave={hide}
      onFocus={() => { focused.current = true; clearTimer(); setOpen(true); }}
      onBlur={() => { focused.current = false; hide(); }}
    >
      {children}
      {open && createPortal(
        <span ref={floating} id={id} role="tooltip"
          style={{ ...style, zIndex: 10000, maxWidth: 'calc(100vw - 16px)' }}
          className="flex w-max items-center gap-2 rounded-lg border border-accent-primary/15 bg-surface-elevated px-3 py-2 text-[12px] font-semibold leading-4 text-txt-primary shadow-[0_10px_30px_rgba(2,4,14,0.58)]"
          onMouseEnter={() => { clearTimer(); setOpen(true); }} onMouseLeave={hide}
        >
          <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-accent-primary/80" />
          <span className="min-w-0 break-words">{name}</span>
          <span aria-hidden="true"
            className={`absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-surface-elevated ${actualPlacement === 'top' ? '-bottom-1 border-b border-r border-accent-primary/15' : '-top-1 border-l border-t border-accent-primary/15'}`} />
        </span>, container,
      )}
    </span>
  );
}

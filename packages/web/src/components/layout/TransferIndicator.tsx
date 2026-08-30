import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { useTransferStore, type Transfer } from '../../stores/transferStore';
import { OrbitalIcon } from '../ui/OrbitalIcon';

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function TransferIndicator() {
  // Subscribe to the Map directly. `listVisible()` returns a fresh array each call,
  // which would force a re-render on every store mutation. The Map reference only
  // changes when transfers are added/removed/updated, so useMemo recomputes only
  // when needed.
  const transfersMap = useTransferStore((s) => s.transfers);
  const visible = useMemo(
    () => Array.from(transfersMap.values()).filter((t) => t.tray),
    [transfersMap],
  );

  const pause = useTransferStore((s) => s.pauseUpload);
  const resume = useTransferStore((s) => s.resumeUpload);
  const abort = useTransferStore((s) => s.abortUpload);
  const pauseDl = useTransferStore((s) => s.pauseDownload);
  const resumeDl = useTransferStore((s) => s.resumeDownload);
  const abortDl = useTransferStore((s) => s.abortDownload);
  const remove = useTransferStore((s) => s.remove);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [position, setPosition] = useState({ top: 56, left: 8, maxHeight: 400 });

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(300, window.innerWidth - 16);
      const height = panelRef.current?.getBoundingClientRect().height ?? 400;
      setPosition({
        left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - height - 8)),
        maxHeight: Math.max(0, window.innerHeight - 16),
      });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, visible.length]);

  // Click-outside-to-close. iOS Safari does not synthesize `mousedown` from
  // touch reliably, so we listen for `touchstart` alongside `mousedown` so the
  // panel dismisses on the first tap on touch devices. Mirrors the pattern
  // used in AudioInputSection.tsx.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const active = visible.filter(
    (t) => t.state === 'active' || t.state === 'paused' || t.state === 'queued',
  );
  const failed = visible.some((t) => t.state === 'failed');
  const idle = visible.length === 0;

  const badgeColor = failed ? 'bg-accent-rose' : 'bg-accent-amber';

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={`relative w-8 h-8 flex items-center justify-center rounded-[6px] transition-colors ${
          idle
            ? 'text-txt-tertiary/60 hover:text-txt-tertiary hover:bg-interactive-hover'
            : 'text-txt-tertiary hover:text-txt-primary hover:bg-interactive-hover'
        }`}
        title="Transfers"
        aria-label="Transfers"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <OrbitalIcon name="transfer" />
        {active.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 ${badgeColor} text-black text-[10px] font-medium rounded-full px-1.5 leading-4 min-w-[16px] text-center`}>
            {active.length}
          </span>
        )}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Transfers"
          style={position}
          className="fixed w-[min(300px,calc(100vw-16px))] bg-surface-elevated border border-border-soft shadow-2xl z-[1000] rounded-lg overflow-y-auto"
        >
          <div className="px-3 py-2 border-b border-border-soft text-xs flex justify-between items-center">
            <span className="text-txt-secondary">
              {visible.length} transfer{visible.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() =>
                visible
                  .filter((t) => t.state === 'completed' || t.state === 'aborted')
                  .forEach((t) => remove(t.id))
              }
              className="text-txt-tertiary hover:text-txt-primary transition-colors"
            >
              Clear completed
            </button>
          </div>
          {visible.length === 0 && (
            <div className="px-3 py-6 text-center text-txt-tertiary text-xs">
              No active transfers.
            </div>
          )}
          <div className="max-h-[400px] overflow-y-auto">
            {visible.map((t) => (
              <TransferRow
                key={t.id}
                transfer={t}
                onPause={() => (t.type === 'upload' ? pause(t.id) : pauseDl(t.id))}
                onResume={() => {
                  if (t.type === 'upload') void resume(t.id);
                  else void resumeDl(t.id);
                }}
                onAbort={() => (t.type === 'upload' ? abort(t.id) : abortDl(t.id))}
                onDismiss={() => remove(t.id)}
              />
            ))}
          </div>
        </div>,
        document.fullscreenElement ?? document.body,
      )}
    </div>
  );
}

interface TransferRowProps {
  transfer: Transfer;
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
  onDismiss: () => void;
}

function TransferRow({ transfer, onPause, onResume, onAbort, onDismiss }: TransferRowProps) {
  const pct =
    transfer.progress.total > 0
      ? Math.min(100, Math.round((transfer.progress.loaded / transfer.progress.total) * 100))
      : 0;
  const barColor =
    transfer.state === 'failed'
      ? 'bg-accent-rose'
      : transfer.state === 'completed'
      ? 'bg-accent-mint'
      : 'bg-accent-mint/70';
  return (
    <div className="px-3 py-2 border-b border-border-soft last:border-none">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-txt-tertiary text-[10px]">
          {transfer.type === 'upload' ? '↑' : '↓'}
        </span>
        <span className="text-txt-primary truncate flex-1">{transfer.file.name}</span>
      </div>
      <div className="mt-1 h-[3px] bg-surface-input rounded overflow-hidden">
        <div className={`h-full ${barColor} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between items-center text-[10px] text-txt-tertiary gap-2">
        <span className="truncate">
          {transfer.state === 'completed'
            ? 'Done'
            : transfer.state === 'failed'
            ? `Failed: ${transfer.error?.message ?? 'unknown'}`
            : transfer.state === 'aborted'
            ? 'Aborted'
            : `${fmt(transfer.progress.loaded)} / ${fmt(transfer.progress.total)}`}
        </span>
        <span className="flex gap-2 flex-shrink-0">
          {transfer.state === 'active' && (
            <button onClick={onPause} className="hover:text-txt-primary transition-colors">
              Pause
            </button>
          )}
          {transfer.state === 'paused' && (
            <button onClick={onResume} className="hover:text-txt-primary transition-colors">
              Resume
            </button>
          )}
          {(transfer.state === 'active' ||
            transfer.state === 'paused' ||
            transfer.state === 'queued') && (
            <button onClick={onAbort} className="hover:text-accent-rose transition-colors">
              Abort
            </button>
          )}
          {(transfer.state === 'completed' ||
            transfer.state === 'failed' ||
            transfer.state === 'aborted') && (
            <button onClick={onDismiss} className="hover:text-txt-primary transition-colors">
              Dismiss
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

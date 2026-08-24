import { isElectron } from '../../platform/platform';
import { getDesktopDownload } from '../../config/desktopDownloads';

export function DesktopDownloadLink() {
  if (isElectron()) return null;
  const download = getDesktopDownload();

  return (
    <a
      href={download.url}
      download={download.filename}
      className="group mt-4 flex w-full items-center justify-between rounded-xl border border-accent-primary/20 bg-accent-primary/[0.055] px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-primary/45 hover:bg-accent-primary/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/70"
      aria-label={download.label}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-primary/12 text-accent-primary ring-1 ring-accent-primary/20 transition-transform duration-200 group-hover:scale-105">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v11" />
            <path d="m7.5 10 4.5 4.5 4.5-4.5" />
            <path d="M5 19h14" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-txt-primary">{download.label}</span>
          <span className="block text-[11px] text-txt-tertiary">{download.detail}</span>
        </span>
      </span>
      <span className="ml-3 text-xs font-semibold text-accent-primary transition-transform duration-200 group-hover:translate-x-0.5">Baixar</span>
    </a>
  );
}

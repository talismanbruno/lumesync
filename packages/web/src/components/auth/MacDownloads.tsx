import { getMacDownloads, LUME_DESKTOP_VERSION } from '../../config/desktopDownloads';

export function MacDownloads() {
  return <main className="min-h-screen bg-surface-base text-txt-primary grid place-items-center px-6 py-12"><div className="w-full max-w-lg">
    <img src="/icons/logo.png" alt="Lume" className="w-12 h-12 mb-7"/>
    <h1 className="text-3xl font-semibold mb-3">Lume para Mac</h1><p className="text-txt-secondary mb-7">Escolha o chip do seu Mac para instalar a versão certa.</p>
    <div className="grid gap-3">{getMacDownloads().map(download => <a key={download.filename} href={download.url} download={download.filename} className="block rounded-xl border border-white/10 bg-white/5 p-5 hover:border-accent-primary/60 focus-visible:outline focus-visible:outline-accent-primary"><strong className="block text-lg">{download.label}</strong><span className="block text-sm text-txt-secondary mt-1">{download.detail}</span><span className="block text-sm text-accent-primary mt-4">Baixar DMG →</span></a>)}</div>
    <p className="text-xs text-txt-tertiary mt-6">Para conferir: menu Apple → Sobre Este Mac → Chip ou Processador.</p><p className="text-xs text-txt-tertiary mt-2">Versão {LUME_DESKTOP_VERSION}</p><a href="/" className="inline-block text-sm text-accent-primary mt-6">Voltar ao Lume</a>
  </div></main>;
}

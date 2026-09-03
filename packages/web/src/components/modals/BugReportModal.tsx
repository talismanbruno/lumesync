import { useEffect, useState } from 'react';
import type { BugReportCategory } from '@backspace/shared';
import { Modal } from '../ui/Modal';
import { api } from '../../api/client';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';

const CATEGORIES: Array<{ value: BugReportCategory; label: string }> = [
  { value: 'call', label: 'Chamada' },
  { value: 'audio', label: 'Áudio' },
  { value: 'screen_share', label: 'Compartilhamento' },
  { value: 'messages', label: 'Mensagens' },
  { value: 'interface', label: 'Interface' },
  { value: 'other', label: 'Outro' },
];

export function BugReportModal() {
  const activeModal = useUIStore((state) => state.activeModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const addToast = useUIStore((state) => state.addToast);
  const [category, setCategory] = useState<BugReportCategory>('interface');
  const [description, setDescription] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isOpen = activeModal === 'bugReport';

  useEffect(() => {
    if (!isOpen) return;
    setDescription('');
    setCategory('interface');
    setIncludeDiagnostics(true);
  }, [isOpen]);

  const submit = async () => {
    const text = description.trim();
    if (text.length < 10) {
      addToast('Conte um pouco mais sobre o que aconteceu.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const voice = useVoiceStore.getState();
      await api.feedback.reportBug({
        category,
        description: text,
        diagnostics: includeDiagnostics ? {
          platform: window.backspace ? 'desktop' : 'web',
          connectionQuality: voice.connectionQuality,
          participantCount: voice.participants.length,
          channelKind: voice.activeDmCall ? 'dm' : voice.currentVoiceChannelId ? 'server' : 'none',
        } : undefined,
      });
      closeModal();
      addToast('Obrigado! Seu relato chegou para a equipe do Lume.', 'success');
    } catch {
      addToast('Não foi possível enviar agora. Tente novamente em instantes.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Relatar um bug" mobileStyle="sheet" maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-txt-secondary">Descreva o que aconteceu e, se puder, o que estava fazendo antes do problema.</p>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((item) => (
            <button key={item.value} type="button" onClick={() => setCategory(item.value)}
              className={`rounded-lg border px-2 py-2 text-xs transition ${category === item.value ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-subtle bg-surface-secondary text-txt-secondary hover:text-txt-primary'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 2000))}
            rows={6}
            autoFocus
            placeholder="Ex.: eu estava em uma chamada com quatro pessoas e o áudio parou..."
            className="w-full resize-none rounded-xl border border-border-subtle bg-surface-input px-3 py-2.5 text-sm text-txt-primary outline-none transition focus:border-accent-primary"
          />
          <div className="mt-1 text-right text-[11px] text-txt-tertiary">{description.length}/2000</div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface-secondary p-3">
          <input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} className="mt-0.5 accent-accent-primary" />
          <span>
            <span className="block text-xs font-semibold text-txt-primary">Incluir diagnóstico básico</span>
            <span className="block text-[11px] leading-4 text-txt-tertiary">Envia apenas plataforma, qualidade da conexão e quantidade de pessoas. Nunca envia mensagens, áudio ou IP.</span>
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-sm text-txt-secondary hover:text-txt-primary">Cancelar</button>
          <button type="button" onClick={submit} disabled={submitting || description.trim().length < 10}
            className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? 'Enviando…' : 'Enviar relato'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

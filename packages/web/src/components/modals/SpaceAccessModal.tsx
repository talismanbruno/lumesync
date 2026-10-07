import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { Modal } from '../ui/Modal';
import { CreateSpaceForm } from './CreateSpace';
import { JoinSpaceForm } from './JoinSpace';

// Retain both entry keys so existing invite shortcuts can open the join tab.
export function SpaceAccessModal() {
  const activeModal = useUIStore(s => s.activeModal);
  const openModal = useUIStore(s => s.openModal);
  const closeModal = useUIStore(s => s.closeModal);
  const [busy, setBusy] = useState(false);
  const createTab = useRef<HTMLButtonElement>(null);
  const joinTab = useRef<HTMLButtonElement>(null);
  const focusNextTab = useRef(false);
  const isOpen = activeModal === 'createSpace' || activeModal === 'joinSpace';

  useEffect(() => {
    if (!isOpen) setBusy(false);
  }, [isOpen]);

  useEffect(() => {
    if (focusNextTab.current) {
      (activeModal === 'createSpace' ? createTab : joinTab).current?.focus();
      focusNextTab.current = false;
    }
  }, [activeModal]);

  const selectTab = (tab: 'createSpace' | 'joinSpace', focus = false) => {
    if (busy) return;
    focusNextTab.current = focus;
    openModal(tab);
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Comunidades" mobileStyle="sheet">
      <div role="tablist" aria-label="Criar ou entrar em um servidor" className="flex gap-1 rounded-xl border border-accent-primary/15 bg-black/20 p-1 mb-5">
        {(['createSpace', 'joinSpace'] as const).map(tab => (
          <button
            key={tab}
            ref={tab === 'createSpace' ? createTab : joinTab}
            type="button"
            role="tab"
            id={`space-access-${tab}`}
            aria-controls="space-access-panel"
            aria-selected={activeModal === tab}
            tabIndex={activeModal === tab ? 0 : -1}
            disabled={busy}
            onClick={() => selectTab(tab)}
            onKeyDown={event => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 'createSpace' : event.key === 'End' ? 'joinSpace' : tab === 'createSpace' ? 'joinSpace' : 'createSpace';
                selectTab(next, true);
              }
            }}
            className={`flex-1 min-w-0 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors disabled:cursor-wait ${activeModal === tab ? 'bg-accent-primary/10 text-accent-primary' : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'}`}
          >
            {tab === 'createSpace' ? 'Criar servidor' : 'Entrar por convite'}
          </button>
        ))}
      </div>
      {isOpen && (
        <div id="space-access-panel" role="tabpanel" aria-labelledby={`space-access-${activeModal}`} aria-busy={busy}>
          {activeModal === 'createSpace'
            ? <CreateSpaceForm onClose={closeModal} onBusyChange={setBusy} />
            : <JoinSpaceForm onClose={closeModal} onBusyChange={setBusy} />}
        </div>
      )}
    </Modal>
  );
}

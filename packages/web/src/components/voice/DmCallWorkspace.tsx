import { t as uiText } from '../../i18n';
import { useEffect, useState } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { DmDeletedNotice } from '../chat/DmDeletedNotice';
import { VoiceGrid } from './VoiceGrid';
import { VoiceControlBar } from './VoiceControlBar';

interface DmCallWorkspaceProps {
  channelId: string;
  channelName: string;
  inputPlaceholder?: string;
  partnerDeleted: boolean;
  jumpToMessageId: string | null;
  onJumpComplete: () => void;
}

export function DmCallWorkspace({ channelId, channelName, inputPlaceholder, partnerDeleted, jumpToMessageId, onJumpComplete }: DmCallWorkspaceProps) {
  const participants = useVoiceStore(s => s.participants);
  const connected = useVoiceStore(s => s.isLiveKitConnected);
  const connectionError = useVoiceStore(s => s.connectionError);
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    if (jumpToMessageId) setChatOpen(true);
  }, [jumpToMessageId]);

  return (
    <div className="lume-dm-call-workspace flex-1 min-h-0 min-w-0">
      <div className={`lume-dm-call-layout ${chatOpen ? '' : 'is-chat-closed'}`}>
        <section aria-label={uiText("Chamada privada")} className="lume-dm-call-video flex flex-col min-w-0 min-h-0">
          <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs shrink-0">
            <span className="font-semibold text-txt-secondary">{uiText("Chamada")}</span>
            <span className={connectionError ? 'text-txt-danger' : connected ? 'text-status-online' : 'text-status-idle'} role="status">
              {connectionError ? uiText("Falha na conexão") : connected ? uiText("{0} na chamada", [participants.length]) : uiText("Conectando…")}
            </span>
          </div>
          <div className="flex flex-1 min-h-0 overflow-hidden p-2">
            <VoiceGrid participants={participants} />
          </div>
          <VoiceControlBar docked chatOpen={chatOpen} onToggleChat={() => setChatOpen(open => !open)} />
        </section>
        {/* Keep the conversation mounted so collapsing it preserves drafts. */}
        <section aria-label={uiText("Conversa durante a chamada")} hidden={!chatOpen} className={`lume-dm-call-chat relative min-w-0 min-h-0 flex-col ${chatOpen ? 'flex' : 'hidden'}`}>
          <div className="px-4 py-2 border-b border-border-soft text-xs font-semibold text-txt-secondary shrink-0">{uiText("Conversa")}</div>
          <MessageList channelId={channelId} jumpToMessageId={jumpToMessageId} onJumpComplete={onJumpComplete} />
          {partnerDeleted
            ? <DmDeletedNotice />
            : <MessageInput channelId={channelId} channelName={channelName} placeholder={inputPlaceholder} />}
        </section>
      </div>
    </div>
  );
}

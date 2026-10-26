import { forwardRef, useEffect, useRef, type HTMLAttributes, type MouseEvent } from 'react';
import type { User } from '@backspace/shared';
import { useVoiceStore } from '../../stores/voiceStore';
import { useUIStore } from '../../stores/uiStore';
import { watchParticipantStream } from '../../utils/watchParticipantStream';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick' | 'onDoubleClick' | 'onKeyDown' | 'onClickCapture' | 'onDoubleClickCapture'> {
  userId: string;
  roomId: string;
  user?: User | null;
  onOpenProfile?: (position: { top: number; left: number }) => void;
  onOpenCall?: () => void;
  disabled?: boolean;
}

const SINGLE_CLICK_WAIT = 400;

/** Keep a pending profile click from stealing the stream's double click. */
export const CallParticipantTarget = forwardRef<HTMLDivElement, Props>(function CallParticipantTarget({
  userId, roomId, user, onOpenProfile, onOpenCall, disabled = false, children, ...props
}, ref) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const canWatch = useVoiceStore(state => !disabled && state.isLiveKitConnected
    && (state.currentVoiceChannelId === roomId || state.activeDmCall?.dmChannelId === roomId)
    && state.participants.some(person => person.userId === userId && person.isScreenSharing));
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => cancel, [userId, roomId]);

  const profile = (position: { top: number; left: number }) => {
    if (onOpenProfile) onOpenProfile(position);
    else if (user) useUIStore.getState().openUserProfile(user, position);
    else useUIStore.getState().openModal('userProfile', { userId });
  };
  const stream = () => {
    cancel();
    if (disabled) return;
    if (!watchParticipantStream(userId, roomId)) return;
    useUIStore.getState().closeUserProfile();
    if (onOpenCall) onOpenCall();
    else if (useUIStore.getState().isMobile) useUIStore.getState().pushMobileScreen('voice-full');
  };
  const click = (event: MouseEvent<HTMLDivElement>) => {
    cancel();
    if (disabled || event.detail > 1) return;
    const position = { top: event.clientY, left: event.clientX + 12 };
    if (canWatch && event.detail !== 0) timer.current = setTimeout(() => { timer.current = undefined; profile(position); }, SINGLE_CLICK_WAIT);
    else profile(position);
  };
  const nestedControl = (event: MouseEvent<HTMLDivElement>) => event.target instanceof Element
    && !!event.target.closest('button,a,input,select,textarea,[data-participant-ignore-click]');
  return <div {...props} ref={ref} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined} className={'select-none touch-manipulation ' + (props.className ?? '')}
    aria-keyshortcuts={canWatch ? 'Alt+Enter' : undefined}
    onClickCapture={event => {
      if (nestedControl(event)) { cancel(); return; }
      if (!canWatch) return;
      // Prevent nested avatar handlers from opening a profile on the first click.
      event.stopPropagation(); click(event);
    }}
    onClick={event => { if (!canWatch && !nestedControl(event)) click(event); }}
    onDoubleClick={event => {
      if (nestedControl(event)) return;
      event.preventDefault(); event.stopPropagation();
      stream();
    }}
    onContextMenuCapture={cancel}
    onDragStartCapture={cancel}
    onKeyDown={event => {
      if (disabled || event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault(); cancel();
      if (canWatch && event.altKey && event.key === 'Enter') stream();
      else { const rect = event.currentTarget.getBoundingClientRect(); profile({ top: rect.top, left: rect.right + 12 }); }
    }}
  >{children}</div>;
});

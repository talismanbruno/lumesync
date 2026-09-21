import React, { useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useLocation } from 'react-router-dom';
import { MobileScreenStack } from './MobileScreenStack';
import { MobileBottomNav } from './MobileBottomNav';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useVisualViewportInset } from '../../hooks/useVisualViewportInset';

import { MobileScreenHeader } from './MobileScreenHeader';
import { TransferIndicator } from './TransferIndicator';
import { MobileVoiceMiniBar } from './MobileVoiceMiniBar';

// The stack renders only one screen at a time. Keep optional screens out of
// the first mobile download, especially the large admin tools.
const MobileSpacesScreen = React.lazy(() => import('./MobileSpacesScreen').then((m) => ({ default: m.MobileSpacesScreen })));
const MobileDmsScreen = React.lazy(() => import('./MobileDmsScreen').then((m) => ({ default: m.MobileDmsScreen })));
const MobileYouScreen = React.lazy(() => import('./MobileYouScreen').then((m) => ({ default: m.MobileYouScreen })));
const MobileChatScreen = React.lazy(() => import('./MobileChatScreen').then((m) => ({ default: m.MobileChatScreen })));
const MobileSettingsScreen = React.lazy(() => import('./MobileSettingsScreen').then((m) => ({ default: m.MobileSettingsScreen })));
const MobileInstancePanel = React.lazy(() => import('./MobileInstancePanel').then((m) => ({ default: m.MobileInstancePanel })));
const MobileVoiceFullScreen = React.lazy(() => import('./MobileVoiceFullScreen').then((m) => ({ default: m.MobileVoiceFullScreen })));
const MobileMembersScreen = React.lazy(() => import('./MobileMembersScreen').then((m) => ({ default: m.MobileMembersScreen })));
const MobileGroupDmInfo = React.lazy(() => import('./MobileGroupDmInfo').then((m) => ({ default: m.MobileGroupDmInfo })));
const FriendsPage = React.lazy(() => import('../chat/FriendsPage').then((m) => ({ default: m.FriendsPage })));
const ExplorePage = React.lazy(() => import('../chat/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const UserProfileModal = React.lazy(() => import('../modals/UserProfileModal').then((m) => ({ default: m.UserProfileModal })));
const GeneralPanel = React.lazy(() => import('../modals/instanceSettingsPanels/GeneralPanel').then((m) => ({ default: m.GeneralPanel })));
const RegistrationPanel = React.lazy(() => import('../modals/instanceSettingsPanels/RegistrationPanel').then((m) => ({ default: m.RegistrationPanel })));
const FederationPanel = React.lazy(() => import('../modals/instanceSettingsPanels/FederationPanel').then((m) => ({ default: m.FederationPanel })));
const StreamingPanel = React.lazy(() => import('../modals/instanceSettingsPanels/StreamingPanel').then((m) => ({ default: m.StreamingPanel })));
const StoragePanel = React.lazy(() => import('../modals/instanceSettingsPanels/StoragePanel').then((m) => ({ default: m.StoragePanel })));
const UsersPanel = React.lazy(() => import('../modals/instanceSettingsPanels/UsersPanel').then((m) => ({ default: m.UsersPanel })));
const InsightsPanel = React.lazy(() => import('../modals/instanceSettingsPanels/InsightsPanel').then((m) => ({ default: m.InsightsPanel })));
const SpacesPanel = React.lazy(() => import('../modals/instanceSettingsPanels/SpacesPanel').then((m) => ({ default: m.SpacesPanel })));
const AuditPanel = React.lazy(() => import('../modals/instanceSettingsPanels/AuditPanel').then((m) => ({ default: m.AuditPanel })));
const HealthPanel = React.lazy(() => import('../modals/instanceSettingsPanels/HealthPanel').then((m) => ({ default: m.HealthPanel })));

/**
 * Wrapper for the Federation sub-panel that forwards FederationPanel's
 * approval-count callback into the shared uiStore slot read by
 * MobileInstancePanel — this keeps the badge live while the admin is inside
 * the panel approving/denying requests.
 */
function MobileFederationPanelWrapper() {
  const setApprovalCount = useUIStore((s) => s.setFederationApprovalCount);
  return (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Federation" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4">
        <FederationPanel onApprovalCountChange={setApprovalCount} />
      </div>
    </div>
  );
}

const screenMap: Record<string, (params?: Record<string, string>) => React.ReactNode> = {
  'channel-chat': (params) => <MobileChatScreen params={params} />,
  'friends': () => <FriendsPage mobile />,
  'settings': () => <MobileSettingsScreen />,
  'settings-account': () => <MobileSettingsScreen initialPanel="account" />,
  'settings-voice': () => <MobileSettingsScreen initialPanel="voice" />,
  'settings-privacy': () => <MobileSettingsScreen initialPanel="privacy" />,
  'settings-connections': () => <MobileSettingsScreen initialPanel="connections" />,
  'settings-keybinds': () => <MobileSettingsScreen initialPanel="keybinds" />,
  'settings-desktop': () => <MobileSettingsScreen initialPanel="desktop" />,
  'settings-instance': () => <MobileInstancePanel />,
  'settings-instance-insights': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Visão geral" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><InsightsPanel /></div>
    </div>
  ),
  'settings-instance-health': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Saúde do sistema" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><HealthPanel /></div>
    </div>
  ),
  'settings-instance-spaces': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Servidores" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><SpacesPanel /></div>
    </div>
  ),
  'settings-instance-audit': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Histórico admin" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><AuditPanel /></div>
    </div>
  ),
  'settings-instance-general': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="General" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><GeneralPanel /></div>
    </div>
  ),
  'settings-instance-registration': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Registration" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><RegistrationPanel /></div>
    </div>
  ),
  'settings-instance-federation': () => <MobileFederationPanelWrapper />,
  'settings-instance-streaming': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Streaming" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><StreamingPanel /></div>
    </div>
  ),
  'settings-instance-storage': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Storage" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><StoragePanel /></div>
    </div>
  ),
  'settings-instance-users': () => (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title="Users" rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto p-4"><UsersPanel /></div>
    </div>
  ),
  'members': (params) => <MobileMembersScreen params={params} />,
  'group-dm-info': (params) => <MobileGroupDmInfo params={params} />,
  'voice-full': () => <MobileVoiceFullScreen />,
  'explore': () => <ExplorePage />,
  'user-profile': (params) => {
    // Open the user profile modal with the userId from params
    if (params?.userId) {
      // Set modalData so UserProfileModal can read it
      useUIStore.getState().openModal('userProfile', { userId: params.userId });
    }
    return <UserProfileModal />;
  },
};

export function MobileShell() {
  const mobileScreen = useUIStore((s) => s.mobileScreen);
  const popMobileScreen = useUIStore((s) => s.popMobileScreen);
  const pushMobileScreen = useUIStore((s) => s.pushMobileScreen);
  const mobileStack = useUIStore((s) => s.mobileStack);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const location = useLocation();

  // Deep links and refreshes should open the matching root tab. Keep the
  // current stack intact: a direct DM link still needs its chat screen above
  // the DMs root, and tapping "Você" does not change the URL.
  useEffect(() => {
    if (/^\/channels\/@me(?:\/|$)/.test(location.pathname)) {
      useUIStore.setState({ mobileScreen: 'dms' });
    } else if (location.pathname === '/channels' || /^\/channels\/[^/]+/.test(location.pathname)) {
      useUIStore.setState({ mobileScreen: 'spaces' });
    }
  }, [location.pathname]);

  // Edge swipe back gesture
  useSwipeGesture({
    onSwipeRight: () => {
      if (mobileStack.length > 0) {
        popMobileScreen();
      }
    },
    enabled: mobileStack.length > 0,
  });

  // Reconstruct mobile stack from URL on mount AND on subsequent pathname
  // changes (deep link, refresh, programmatic navigate from SpaceInviteCard
  // Join, joinByCode flows, etc.).
  //
  // Subscribes to `location.pathname` only — NOT to `mobileStack`. This is
  // important because pushing an unrelated screen (e.g. settings) must not
  // re-trigger this effect; otherwise we would re-push the channel-chat on
  // top of every newly-pushed screen, since pathname is still `/channels/...`.
  // We read the current stack imperatively via `useUIStore.getState()` for
  // the idempotency guard.
  //
  // Idempotency guard: callers like MobileSpacesScreen call BOTH
  // `pushMobileScreen('channel-chat', …)` AND `navigate('/channels/…')`.
  // The pushMobileScreen call alone doesn't change pathname (history.pushState
  // with no URL preserves it), but the navigate call does — and that pathname
  // change re-runs this effect after the screen is already on top. The guard
  // below catches that case by inspecting the topmost stack entry. We also
  // guard against the popstate path: when the user navigates back, popstate
  // pops both the browser history AND our stack; the resulting pathname change
  // matches the new top entry, so we skip.
  useEffect(() => {
    const path = location.pathname;
    const match = path.match(/^\/channels\/([^/]+)\/([^/]+)$/);
    if (!match) return;
    const spaceId = match[1] ?? '';
    const channelId = match[2] ?? '';
    const normalizedSpaceId = spaceId === '@me' ? '@me' : spaceId;

    // Read current stack imperatively to avoid re-firing on stack changes.
    const currentStack = useUIStore.getState().mobileStack;
    const top = currentStack[currentStack.length - 1];
    if (
      top &&
      top.screen === 'channel-chat' &&
      top.params?.channelId === channelId &&
      top.params?.spaceId === normalizedSpaceId
    ) {
      return;
    }

    // If the stack has channel-chat entries for OTHER channels, we still push
    // — this preserves back-stack semantics for in-app navigation (e.g. tapping
    // a SpaceInviteCard Join button while inside a chat should stack the new
    // channel on top so back returns to the originating chat).
    pushMobileScreen('channel-chat', { channelId, spaceId: normalizedSpaceId });
  }, [location.pathname, pushMobileScreen]);

  // Sync browser back button with mobile stack
  useEffect(() => {
    const handlePopState = () => {
      if (useUIStore.getState().mobileStack.length > 0) {
        popMobileScreen();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [popMobileScreen]);

  const rootScreens: Record<string, React.ReactNode> = {
    spaces: <MobileSpacesScreen />,
    dms: <MobileDmsScreen />,
    you: <MobileYouScreen />,
  };

  // Size the shell to the visual viewport when the iOS soft keyboard is open
  // so a `position: absolute; bottom: 0` child (the chat composer) lands on
  // the keyboard's top edge — independent of how reliably the
  // `visualViewport.resize` event fires in standalone PWA mode. When the
  // keyboard is closed we use `100dvh` so the shell extends through the
  // home-indicator safe area as designed. See `useVisualViewportInset` for
  // the iOS-PWA-specific fallback (focusin polling) that updates `height`
  // even when no `resize` event ever lands.
  const { keyboardOpen, height: vvHeight } = useVisualViewportInset();
  const shellHeight = keyboardOpen && vvHeight !== null ? `${vvHeight}px` : '100dvh';

  return (
    <div className="flex flex-col" style={{ height: shellHeight }}>
      <React.Suspense fallback={<div role="status" className="flex flex-1 items-center justify-center text-sm text-txt-secondary">Abrindo tela…</div>}>
        <MobileScreenStack
          rootScreen={rootScreens[mobileScreen]}
          screenMap={screenMap}
        />
      </React.Suspense>

      {/* Voice mini-bar — shown when in a voice call */}
      {currentVoiceChannelId && <MobileVoiceMiniBar />}

      {/* Bottom nav — MobileBottomNav hides itself when stack is non-empty */}
      <MobileBottomNav />
    </div>
  );
}

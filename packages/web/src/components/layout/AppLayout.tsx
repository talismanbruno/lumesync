import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SpaceSidebar } from './SpaceSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { MainContent } from './MainContent';
import { RightPanel } from './RightPanel';
import { MobileShell } from './MobileShell';
import { ImagePreview } from '../chat/ImagePreview';
import { CreateSpaceModal } from '../modals/CreateSpace';
import { JoinSpaceModal } from '../modals/JoinSpace';
import { CreateChannelModal } from '../modals/CreateChannel';
import { CreateCategoryModal } from '../modals/CreateCategory';
import { InviteModal } from '../modals/InviteModal';
import { UserSettingsModal } from '../modals/UserSettings';
import { SpaceSettingsModal } from '../modals/SpaceSettings';
import { ChannelSettingsModal } from '../modals/ChannelSettingsModal';
import { CategorySettingsModal } from '../modals/CategorySettingsModal';
import { NewDmModal } from '../modals/NewDmModal';
import { AddDmMemberModal } from '../modals/AddDmMemberModal';
import { GroupDmSettings } from '../modals/GroupDmSettings';
import { UserProfileModal } from '../modals/UserProfileModal';
import { IncomingCallModal } from '../voice/IncomingCallModal';
import { PictureInPicture } from '../voice/PictureInPicture';
import { SoundController } from '../voice/SoundController';
import { GlobalAudioRenderer } from '../voice/GlobalAudioRenderer';
import { NotificationController } from '../NotificationController';
import { UserProfilePopout } from '../ui/UserProfilePopout';
import { ToastContainer } from '../ui/ToastContainer';
import { UpdateToast } from '../ui/UpdateToast';
import { ContextMenuRenderer } from '../ui/ContextMenuRenderer';
import { useAuth } from '../../hooks/useAuth';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useFederationToasts } from '../../hooks/useFederationToasts';
import { useLiveKit } from '../../hooks/useLiveKit';
import { useKeybinds } from '../../hooks/useKeybinds';
import { useDeepLinkHandler } from '../../platform/deepLink';
import { initActivityBridge, teardownActivityBridge } from '../../platform/activityBridge';
import { useSpaceStore } from '../../stores/spaceStore';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { AudioManager } from '../../audio/AudioManager';
import { BugReportButton } from '../feedback/BugReportButton';
import { BugReportModal } from '../modals/BugReportModal';

export function AppLayout() {
  const { spaceId, channelId } = useParams<{ spaceId?: string; channelId?: string }>();
  const navigate = useNavigate();
  
  // Global interaction handler to resume AudioContext
  useEffect(() => {
    const resume = () => {
      AudioManager.getInstance().resumeContext().then(() => {
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
        window.removeEventListener('touchstart', resume);
      });
    };
    window.addEventListener('click', resume);
    window.addEventListener('keydown', resume);
    window.addEventListener('touchstart', resume);
    return () => {
      window.removeEventListener('click', resume);
      window.removeEventListener('keydown', resume);
      window.removeEventListener('touchstart', resume);
    };
  }, []);

  // MutationObserver: neutralize rogue LiveKit <audio> elements that bypass our Web Audio pipeline.
  // LiveKit can re-attach hidden <audio> elements after .detach(), causing full-volume playback
  // that ignores our volume/mute controls. Any <audio> without data-backspace is immediately killed.
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLAudioElement && !node.dataset.backspace) {
            node.muted = true;
            node.volume = 0;
            node.pause();
            node.srcObject = null;
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Sync persisted output device preference to AudioManager.
  // AudioManager defers setSinkId until the AudioContext is actually created,
  // so this is safe to call before any user interaction.
  const outputDeviceId = useVoiceStore((s) => s.outputDeviceId);
  useEffect(() => {
    AudioManager.getInstance().setOutputDevice(outputDeviceId);
  }, [outputDeviceId]);

  // Audio device hot-plug handler.
  //
  // Three jobs on every devicechange event:
  //   (1) Prune persisted IDs that no longer exist (delegated to voiceStore).
  //   (2) Force re-acquire the live mic stream when the user's chosen input is
  //       'default' AND a stream is already live. Chromium does NOT migrate an
  //       existing getUserMedia track to the new OS-default — it stays bound to
  //       the device that was default at acquisition time. Setting the input
  //       again with 'default' triggers a fresh getUserMedia, which picks up
  //       the new OS default. The downstream syncMic effect republishes.
  //   (3) Force re-apply setSinkId('') for output when 'default' is selected,
  //       for the same reason on the output side.
  //   (4) Toast on a *new* audioinput appearance (debounced + dedupe by groupId).
  //       Removals do not toast — the user already knows they unplugged it.
  useEffect(() => {
    const prune = useVoiceStore.getState().pruneStaleDevices;
    let lastInputGroupIds = new Set<string>();
    const recentToastByGroup = new Map<string, number>(); // groupId -> timestamp ms
    const TOAST_DEBOUNCE_MS = 1000;
    const TOAST_DEDUPE_WINDOW_MS = 30_000;
    let pendingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    // Handler-level debounce: collapses devicechange storms (BT re-pair, USB
    // hub enumeration can fire 5-10x/sec) into a single prune + reacquire pass.
    // The toast logic has its own longer debounce (TOAST_DEBOUNCE_MS) layered
    // on top so user-visible toasts collapse storms even more aggressively.
    let pendingHandlerTimer: ReturnType<typeof setTimeout> | null = null;
    const HANDLER_DEBOUNCE_MS = 250;

    const seedBaseline = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        lastInputGroupIds = new Set(
          devices.filter(d => d.kind === 'audioinput' && d.groupId).map(d => d.groupId)
        );
      } catch { /* enumeration may be blocked pre-permission; baseline is empty */ }
    };

    const handleNewDeviceToasts = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const currentInputGroupIds = new Set(
          devices.filter(d => d.kind === 'audioinput' && d.groupId).map(d => d.groupId)
        );
        const now = Date.now();
        const newGroups: string[] = [];
        for (const gid of currentInputGroupIds) {
          if (lastInputGroupIds.has(gid)) continue;
          const lastToast = recentToastByGroup.get(gid) ?? 0;
          if (now - lastToast < TOAST_DEDUPE_WINDOW_MS) continue;
          newGroups.push(gid);
          recentToastByGroup.set(gid, now);
        }
        // GC dedupe map entries older than the window so it doesn't leak.
        for (const [gid, ts] of recentToastByGroup) {
          if (now - ts > TOAST_DEDUPE_WINDOW_MS) recentToastByGroup.delete(gid);
        }
        lastInputGroupIds = currentInputGroupIds;

        if (newGroups.length > 0) {
          const newest = devices.find(d =>
            d.kind === 'audioinput' && d.groupId && newGroups.includes(d.groupId) && d.label,
          );
          const label = newest?.label || 'New audio device';
          useUIStore.getState().addToast(
            `${label} detected — choose it in Voice settings to switch`,
            'info',
            6000,
          );
        }
      } catch { /* enumeration failure is non-fatal */ }
    };

    const reacquireLiveStream = async () => {
      const am = AudioManager.getInstance();
      const inputId = useVoiceStore.getState().inputDeviceId;
      const outputId = useVoiceStore.getState().outputDeviceId;
      // Re-acquire input only if user is on 'default' AND a stream is live.
      // Anything else: persisted ID is concrete, stream stays bound correctly.
      if (inputId === 'default' && am.hasActiveStream()) {
        try { await am.setInputDevice('default'); } catch { /* serialized chain handles errors */ }
      }
      if (outputId === 'default') {
        try { await am.setOutputDevice('default'); } catch { /* setSinkId may not exist on Safari */ }
      }
    };

    const handler = () => {
      if (pendingHandlerTimer) clearTimeout(pendingHandlerTimer);
      pendingHandlerTimer = setTimeout(async () => {
        await prune();
        await reacquireLiveStream();
        if (pendingDebounceTimer) clearTimeout(pendingDebounceTimer);
        pendingDebounceTimer = setTimeout(() => { handleNewDeviceToasts(); }, TOAST_DEBOUNCE_MS);
      }, HANDLER_DEBOUNCE_MS);
    };

    // Seed baseline so the first event after mount doesn't false-positive every
    // existing device as "new". Register the listener only AFTER baseline is
    // seeded so the first real event compares against a populated set.
    let listenerRegistered = false;
    let cancelled = false;
    seedBaseline()
      .then(() => prune())
      .then(() => {
        if (cancelled) return;
        navigator.mediaDevices.addEventListener('devicechange', handler);
        listenerRegistered = true;
      });
    return () => {
      cancelled = true;
      if (pendingHandlerTimer) clearTimeout(pendingHandlerTimer);
      if (pendingDebounceTimer) clearTimeout(pendingDebounceTimer);
      if (listenerRegistered) {
        navigator.mediaDevices.removeEventListener('devicechange', handler);
      }
    };
  }, []);

  const { user, isLoading } = useAuth();
  const showBootSkeleton = useDelayedLoading(isLoading);
  const setCurrentSpace = useSpaceStore((s) => s.setCurrentSpace);
  const loadSpaceDetail = useSpaceStore((s) => s.loadSpaceDetail);
  const setCurrentChannel = useChatStore((s) => s.setCurrentChannel);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const setIsMobile = useUIStore((s) => s.setIsMobile);
  const setShowDms = useUIStore((s) => s.setShowDms);

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const isMobile = useUIStore((s) => s.isMobile);
  const userProfilePopout = useUIStore((s) => s.userProfilePopout);
  const closeUserProfile = useUIStore((s) => s.closeUserProfile);
  
  const channels = useSpaceStore((s) => s.channels);

  const {
    connect: connectVoice,
    disconnect: disconnectVoice,
  } = useLiveKit();

  // Register connect/disconnect refs in voiceStore so click handlers can access them
  // without calling useLiveKit() (which would create duplicate Room instances).
  useEffect(() => {
    useVoiceStore.getState().setConnectFn(connectVoice);
    useVoiceStore.getState().setDisconnectFn(disconnectVoice);
    return () => {
      useVoiceStore.getState().setConnectFn(null);
      useVoiceStore.getState().setDisconnectFn(null);
    };
  }, [connectVoice, disconnectVoice]);

  // Initialize WebSocket
  useWebSocket();

  // Federation toast notifications for remote instance connection state changes
  useFederationToasts();

  // Keybinds handler
  useKeybinds();

  // Deep link handler for Electron (backspace:// protocol)
  useDeepLinkHandler();

  // Electron activity detection bridge (game/app process scanning → activityStore)
  useEffect(() => {
    initActivityBridge();
    return () => teardownActivityBridge();
  }, []);

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsMobile]);

  // Handle route params
  useEffect(() => {
    if (spaceId === '@me') {
      setShowDms(true);
      setCurrentSpace(null);
    } else if (spaceId) {
      setShowDms(false);
      setCurrentSpace(spaceId);
      loadSpaceDetail(spaceId);
    } else {
      setShowDms(false);
      setCurrentSpace(null);
    }
  }, [spaceId, setCurrentSpace, loadSpaceDetail, setShowDms]);

  useEffect(() => {
    if (channelId) {
      setCurrentChannel(channelId);
      loadMessages(channelId);
      if (spaceId && spaceId !== '@me') {
        useUIStore.getState().setLastChannel(spaceId, channelId);
      }
    } else {
      setCurrentChannel(null);
    }
  }, [channelId, spaceId, setCurrentChannel, loadMessages]);

  // Auto-select last visited (or first) channel when opening a server without a channelId.
  // Desktop-only: on mobile, `/channels/<spaceId>` should leave the user at the channel
  // sidebar overview (MobileSpacesScreen), not auto-jump into a text channel — otherwise
  // joining a space via SpaceInviteCard or tapping the Spaces bottom-nav tab catapults the
  // user past the sidebar straight into a chat screen, with no clean back path.
  useEffect(() => {
    if (useUIStore.getState().isMobile) return;
    if (!spaceId || spaceId === '@me' || channelId) return;
    if (channels.length === 0) return;

    const firstChannel = channels[0];
    if (!firstChannel) return;

    // Guard: only redirect when channels belong to the target server.
    // `channels` is shared per-view state set by loadSpaceDetail (async).
    // Without this check, stale channels from a previously viewed server
    // would cause a wrong redirect during the fetch window.
    const { channelToSpaceMap } = useSpaceStore.getState();
    if (channelToSpaceMap.get(firstChannel.id) !== spaceId) return;

    const lastId = useUIStore.getState().lastChannelPerSpace[spaceId];
    const target = (lastId && channels.find((c) => c.id === lastId)) || firstChannel;
    if (target) {
      navigate(`/channels/${spaceId}/${target.id}`, { replace: true });
    }
  }, [spaceId, channelId, channels, navigate]);

  // Guard: redirect when URL channelId no longer exists (deleted, permission revoked, etc.)
  useEffect(() => {
    if (!spaceId || spaceId === '@me' || !channelId) return;
    if (channels.length === 0) return;

    const { channelToSpaceMap } = useSpaceStore.getState();
    const firstCh = channels[0];
    if (!firstCh || channelToSpaceMap.get(firstCh.id) !== spaceId) return;

    if (!channels.some(c => c.id === channelId)) {
      navigate(`/channels/${spaceId}`, { replace: true });
    }
  }, [spaceId, channelId, channels, navigate]);

  if (!user || showBootSkeleton) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base" role="status" aria-label="Sincronizando o Lume">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-20 h-20 rounded-[26px] bg-[#071216] border border-accent-primary/20 shadow-[0_0_48px_rgba(0,209,255,0.12)] flex items-center justify-center">
            <img src="/icons/logo.png" alt="" className="w-14 h-14 object-contain animate-pulse" />
          </div>
          <p className="text-xs font-semibold tracking-[0.28em] uppercase text-accent-primary">Sincronizando o Lume</p>
        </div>
      </div>
    );
  }

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <>
        <MobileShell />
        {/* Modals still render globally for both mobile and desktop */}
        <CreateSpaceModal />
        <JoinSpaceModal />
        <CreateChannelModal />
        <CreateCategoryModal />
        <InviteModal />
        {/* UserSettings is a pushed screen on mobile (MobileSettingsScreen), not a modal */}
        <SpaceSettingsModal />
        <ChannelSettingsModal />
        <CategorySettingsModal />
        <NewDmModal />
        <AddDmMemberModal />
        <GroupDmSettings />
        <UserProfileModal />
        <IncomingCallModal />
        <ImagePreview />
        {/* PictureInPicture is desktop-only. Mobile has its own purpose-built
            voice chrome (MobileVoiceMiniBar + MobileVoiceFullScreen) mounted
            inside MobileShell. Mounting PiP here too caused a "PiP-style grey
            view" to appear on top of the mobile shell whenever a voice call
            was connected but the voice-full screen was not on the stack
            (e.g. immediately after Join, or after popping voice-full back to
            the root). */}
        <SoundController />
        <GlobalAudioRenderer />
        <NotificationController />
        <UpdateToast />
        <ToastContainer />
        <ContextMenuRenderer />
        <BugReportButton />
        <BugReportModal />
      </>
    );
  }

  // ── Desktop layout ──
  return (
    <div className="lume-shell h-full flex flex-col md:grid md:grid-cols-[312px_1fr] md:grid-rows-[minmax(0,1fr)] bg-surface-base overflow-hidden">
      {/* Space sidebar - always visible on desktop */}
      <div className={`lume-navigation-shell fixed inset-y-0 left-0 z-40 flex w-[312px] transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:static md:z-auto md:w-auto md:transform-none`}>
        <SpaceSidebar />
        <ChannelSidebar />
      </div>

      {/* Main content area */}
      <div className="lume-content-stage flex-1 flex min-w-0 min-h-0 bg-surface-chat relative">
        <MainContent />
        <RightPanel />
      </div>

      {/* Modals */}
      <CreateSpaceModal />
      <JoinSpaceModal />
      <CreateChannelModal />
      <CreateCategoryModal />
      <InviteModal />
      <UserSettingsModal />
      <SpaceSettingsModal />
      <ChannelSettingsModal />
      <CategorySettingsModal />
      <NewDmModal />
      <AddDmMemberModal />
      <GroupDmSettings />
      <UserProfileModal />
      <IncomingCallModal />
      <ImagePreview />
      <PictureInPicture />
      <SoundController />
      <GlobalAudioRenderer />
      <NotificationController />
      <UpdateToast />
      <BugReportButton />
      <BugReportModal />

      {/* User Profile Popout */}
      {userProfilePopout.user && userProfilePopout.position && (
        <>
          <div
            className="fixed inset-0 z-[145]"
            onClick={closeUserProfile}
          />
          <UserProfilePopout
            user={userProfilePopout.user}
            onClose={closeUserProfile}
            position={userProfilePopout.position}
          />
        </>
      )}

      {/* Federation toasts */}
      <ToastContainer />
      <ContextMenuRenderer />
    </div>
  );
}

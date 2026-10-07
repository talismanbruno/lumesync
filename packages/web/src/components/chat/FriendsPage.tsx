import { ProfileName } from '../ui/ProfileName';
import { OrbitalIcon } from '../ui/OrbitalIcon';
import { t as uiText } from '../../i18n';
import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from 'react-router-dom';
import type { User } from '@backspace/shared';
import { useSocialStore, type TaggedFriend, type TaggedFriendRequest } from '../../stores/socialStore';
import { useAuthStore } from '../../stores/authStore';
import { mapServerErrorToMessage } from '../../utils/friendErrors';
import { useSpaceStore } from '../../stores/spaceStore';
import { useUIStore } from '../../stores/uiStore';
import { useFederationStore } from '../../stores/federationStore';
import { Avatar } from '../ui/Avatar';
import { PeopleIcon } from '../ui/PeopleIcon';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { PioneerBadge } from '../ui/PioneerBadge';
import { BetaContributorBadge } from '../ui/BetaContributorBadge';
import { isPioneer } from '../../utils/pioneer';
import { MemberListToggleButton } from '../layout/MemberListToggleButton';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { api } from '../../api/client';
import { useActivityStore } from '../../stores/activityStore';
import { ActivityCard, hasRichActivity, getActivityAccentClass } from '../ui/ActivityCard';
import { getPrimaryActivity } from '@backspace/shared/src/activities.js';
import { parseFederatedUsername, isFederationGlobeApplicable } from '../../utils/identity';
import { useCanonicalUserView } from '../../utils/userViewLookup';
import { Username } from '../ui/Username';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const statusLabel: Record<string, string> = { online: 'Disponível', working: 'Trabalhando no Lume', idle: 'Ausente', dnd: 'Não perturbe', offline: 'Offline' };

function ActivityFriendItem({
  friend,
  isOffline,
  activities,
  isRichActivity,
  accentClass,
  mobile,
  onMobileClick,
  onDmClick,
}: {
  friend: TaggedFriend;
  isOffline: boolean;
  activities: import('@backspace/shared').Activity[];
  isRichActivity: boolean;
  accentClass: string;
  mobile?: boolean;
  onMobileClick: (userId: string) => void;
  onDmClick: (id: string, homeUserId?: string, homeInstance?: string | null) => void;
}) {
  const canonical = useCanonicalUserView(friend as unknown as User);
  const { baseName } = parseFederatedUsername(canonical.username);
  const friendDisplayName = canonical.displayName ?? baseName;

  const rowClass = isRichActivity
    ? `flex items-center gap-3 px-4 py-2.5 rounded-[10px] mb-1 cursor-pointer transition-colors glass-pill border-l-2 ${accentClass}`
    : 'flex items-center gap-3 px-4 py-2.5 rounded-[4px] hover:bg-interactive-hover cursor-pointer transition-colors active:bg-interactive-hover';

  return (
    <div
      onClick={() => {
        if (mobile) {
          onMobileClick(friend.id);
        } else {
          onDmClick(friend.id, friend.homeUserId ?? undefined, friend.homeInstance);
        }
      }}
      className={rowClass}
    >
      <Avatar
        src={canonical.avatar}
        name={friendDisplayName}
        size={36}
        status={isOffline ? 'offline' : canonical.status}
        className={isOffline ? 'opacity-60' : undefined}
        userId={canonical.homeUserId ?? canonical.id}
        avatarColor={canonical.avatarColor}
      />
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-center gap-1">
          <Username user={canonical} username={friendDisplayName} className={`text-sm leading-[1.2] font-medium truncate ${isOffline ? 'text-txt-tertiary' : 'text-txt-primary'}`} />
          {canonical.isAdmin && <VerifiedBadge size={13} />}
          {isPioneer(canonical) && <PioneerBadge size={14} />}
          {canonical.isBetaContributor && !canonical.isDeleted && <BetaContributorBadge size={14} />}
        </div>
        {!isOffline && isFederationGlobeApplicable(canonical) && (
          <div className="text-[10px] leading-[1.3] text-txt-tertiary truncate opacity-60">@{parseFederatedUsername(canonical.username).domain}</div>
        )}
        {!isOffline && (
          <ActivityCard
            activities={activities}
            fallbackCustomStatus={canonical.customStatus}
          />
        )}
      </div>
    </div>
  );
}

type Tab = 'online' | 'all' | 'pending' | 'add' | 'activity';

interface FriendsPageProps {
  mobile?: boolean;
}

export function FriendsPage({ mobile }: FriendsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('online');
  const [pendingUnfriend, setPendingUnfriend] = useState<{ id: string; name: string } | null>(null);
  const tabTrackRef = useRef<HTMLDivElement>(null);
  const [tabMarker, setTabMarker] = useState({ left: 0, width: 0, visible: false });
  useLayoutEffect(() => {
    const track = tabTrackRef.current;
    if (!track) return;
    const measure = () => {
      const selected = track.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      const next = selected ? { left: selected.offsetLeft + selected.offsetWidth * .28, width: selected.offsetWidth * .44, visible: true } : { left: 0, width: 0, visible: false };
      setTabMarker(previous => previous.left === next.left && previous.width === next.width && previous.visible === next.visible ? previous : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [activeTab, mobile]);
  const navigate = useNavigate();
  const addDmChannel = useSpaceStore((s) => s.addDmChannel);

  // If the user clicked "Retry your friend request" in the Connections panel
  // and we just navigated here, the federation store carries the original
  // target. Switching to the Add tab makes the AddFriendTab mount, which then
  // consumes the prefill into its query input. We only check on mount — the
  // store value is one-shot (cleared by AddFriendTab on consume).
  useEffect(() => {
    if (useFederationStore.getState().pendingFriendAddPrefill) {
      setActiveTab('add');
    }
  }, []);

  const {
    friends,
    requests,
    isLoading,
    loadFriends,
    loadRequests,
    updateFriendRequest,
    cancelFriendRequest,
    removeFriend
  } = useSocialStore(useShallow(s => ({ friends: s.friends, requests: s.requests, isLoading: s.isLoading, loadFriends: s.loadFriends, loadRequests: s.loadRequests, updateFriendRequest: s.updateFriendRequest, cancelFriendRequest: s.cancelFriendRequest, removeFriend: s.removeFriend })));

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, [loadFriends, loadRequests]);

  const userActivities = useActivityStore((s) => activeTab === 'activity' ? s.userActivities : null);
  const pushMobileScreen = useUIStore((s) => s.pushMobileScreen);

  const onlineFriends = friends.filter(f => f.status !== 'offline');
  const pendingIncoming = requests.filter(r => r.status === 'pending' && r.user?.id === r.fromId);
  const pendingOutgoing = requests.filter(r => r.status === 'pending' && r.user?.id === r.toId);

  const handleOpenDm = useCallback(async (friendId: string, homeUserId?: string, homeInstance?: string | null) => {
    try {
      // Check if a DM already exists with this user (on any instance)
      const existing = useSpaceStore.getState().findExistingDmForUser({ id: friendId, homeUserId: homeUserId ?? undefined });
      if (existing) {
        useUIStore.getState().setShowDms(true);
        navigate(`/channels/@me/${existing.dm.id}`);
        return;
      }
      const dmChannel = await api.dm.create({
        userId: homeInstance ? undefined : friendId,
        homeUserId: homeUserId ?? undefined,
        homeInstance: homeInstance ?? undefined,
      });
      addDmChannel(dmChannel);
      navigate(`/channels/@me/${dmChannel.id}`);
    } catch (err) {
      console.error('Failed to open DM:', err);
    }
  }, [addDmChannel, navigate]);
  const handleRemoveFriend = useCallback((friend: TaggedFriend) => setPendingUnfriend({ id: friend.id, name: friend.displayName ?? parseFederatedUsername(friend.username).baseName }), []);

  const renderTabContent = () => {
    if (isLoading && friends.length === 0 && requests.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    switch (activeTab) {
      case 'online':
      case 'all': {
        const availableOnly = activeTab === 'online';
        const visibleCount = availableOnly ? onlineFriends.length : friends.length;
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-xs font-bold text-txt-tertiary mb-4 tracking-wider px-2">
              {availableOnly ? uiText("Disponíveis — ") : uiText("Todas as pessoas — ")}{visibleCount}
            </h2>
            {visibleCount === 0 && (
              <div className="flex flex-col items-center justify-center h-full opacity-80">
                <p className="text-txt-tertiary text-sm">{availableOnly ? uiText("Ninguém está disponível agora.") : uiText("Sua lista ainda está vazia — adicione alguém!")}</p>
              </div>
            )}
            {friends.map(friend => (
              <div key={`${friend.id}:${friend._instanceOrigin}`} hidden={availableOnly && friend.status === 'offline'}>
                <FriendItem friend={friend} onRemove={handleRemoveFriend} onDm={handleOpenDm} />
              </div>
            ))}
          </div>
        );
      }
      case 'pending':
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-xs font-bold text-txt-tertiary mb-4 tracking-wider px-2">
              {uiText("Pedidos — ")}{pendingIncoming.length + pendingOutgoing.length}
            </h2>
            {[...pendingIncoming, ...pendingOutgoing].length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-80">
                <p className="text-txt-tertiary text-sm">{uiText("Nenhum pedido pendente.")}</p>
              </div>
            ) : (
              <>
                {pendingIncoming.map(req => (
                  <RequestItem
                    key={`${req.id}:${req._instanceOrigin}`}
                    request={req}
                    type="incoming"
                    onAccept={() => updateFriendRequest(req.id, 'accepted')}
                    onDecline={() => updateFriendRequest(req.id, 'declined')}
                  />
                ))}
                {pendingOutgoing.map(req => (
                  <RequestItem
                    key={`${req.id}:${req._instanceOrigin}`}
                    request={req}
                    type="outgoing"
                    onCancel={() => cancelFriendRequest(req.id)}
                  />
                ))}
              </>
            )}
          </div>
        );
      case 'add':
        return (
          <AddFriendTab />
        );
      case 'activity': {
        const activeFriends: TaggedFriend[] = [];
        const idleFriends: TaggedFriend[] = [];
        const offlineActivityFriends: TaggedFriend[] = [];
        for (const f of friends) {
          if (f.status === 'offline') {
            offlineActivityFriends.push(f);
            continue;
          }
          const acts = userActivities?.get(f.homeUserId ?? f.id) ?? [];
          const primary = getPrimaryActivity(acts);
          if (primary && primary.type !== 'custom') {
            activeFriends.push(f);
          } else {
            idleFriends.push(f);
          }
        }

        const renderActivityFriend = (friend: TaggedFriend, isOffline = false) => {
          const activities = userActivities?.get(friend.homeUserId ?? friend.id) ?? [];
          const isRichActivity = !isOffline && hasRichActivity(activities);
          const primary = getPrimaryActivity(activities);
          const accentClass = primary ? getActivityAccentClass(primary.type) : '';
          return (
            <ActivityFriendItem
              key={friend.id}
              friend={friend}
              isOffline={isOffline}
              activities={activities}
              isRichActivity={isRichActivity}
              accentClass={accentClass}
              mobile={mobile}
              onMobileClick={(userId) => pushMobileScreen('user-profile', { userId })}
              onDmClick={handleOpenDm}
            />
          );
        };

        return (
          <div className="flex-1 overflow-y-auto p-4">
            {activeFriends.length === 0 && idleFriends.length === 0 && offlineActivityFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-sm text-txt-tertiary max-w-[240px]">
                  {uiText("Tudo quieto por enquanto... Quando alguém iniciar uma atividade, ela aparece aqui.")}</div>
              </div>
            ) : (
              <>
                {activeFriends.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-txt-tertiary mb-2 tracking-wider px-2">
                      {uiText("Em atividade — ")}{activeFriends.length}
                    </h2>
                    {activeFriends.map(f => renderActivityFriend(f))}
                  </div>
                )}
                {idleFriends.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-txt-tertiary mb-2 tracking-wider px-2">
                      {uiText("Disponíveis — ")}{idleFriends.length}
                    </h2>
                    {idleFriends.map(f => renderActivityFriend(f))}
                  </div>
                )}
                {offlineActivityFriends.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-txt-tertiary mb-2 tracking-wider px-2">
                      {uiText("Offline — ")}{offlineActivityFriends.length}
                    </h2>
                    {offlineActivityFriends.map(f => renderActivityFriend(f, true))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      }
    }
  };

  const popMobileScreen = useUIStore((s) => s.popMobileScreen);

  return (
    <div className="lume-friends-hub flex-1 flex flex-col bg-surface-chat h-full">
      {/* Header */}
      {mobile ? (
        <div className="h-12 px-3 flex items-center gap-2 border-b border-border-soft flex-shrink-0 z-10 bg-surface-base">
          <button onClick={popMobileScreen} className="w-8 h-8 flex items-center justify-center text-txt-secondary hover:text-txt-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="font-semibold text-sm text-txt-primary">{uiText("Amigos")}</span>
        </div>
      ) : (
        <div className="lume-friends-command min-h-16 px-5 py-3 flex flex-wrap gap-y-2 items-center border-b border-border-hard flex-shrink-0 z-10 bg-surface-chat">
          <div className="flex items-center gap-2 mr-3 shrink-0">
            <span className="lume-friends-mark">
              <PeopleIcon size={20} />
            </span>
            <span className="font-bold text-txt-primary">{uiText("Amigos")}</span>
          </div>
          <div className="w-[1px] h-6 bg-surface-elevated mx-2" />
          <div ref={tabTrackRef} className="lume-friends-tab-track flex items-center gap-1 ml-2">
            <TabButton active={activeTab === 'online'} onClick={() => setActiveTab('online')}>{uiText("Disponíveis")}</TabButton>
            <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')}>{uiText("Todos")}</TabButton>
            <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
              {uiText("Pedidos")}{(pendingIncoming.length > 0) && (
                <span className="ml-2 px-1.5 py-0.5 bg-accent-rose text-white text-[10px] rounded-full leading-none">
                  {pendingIncoming.length}
                </span>
              )}
            </TabButton>
            <span aria-hidden="true" className="lume-friends-tab-marker" style={{ transform: `translateX(${tabMarker.left}px)`, width: tabMarker.width, opacity: tabMarker.visible ? 1 : 0 }} />
          </div>
          <div className="ml-auto pl-3 flex items-center gap-3">
            <button
              onClick={() => setActiveTab('add')}
              aria-pressed={activeTab === 'add'}
              className={`lume-friends-add flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-semibold transition-colors ${activeTab === 'add' ? 'is-active' : ''}`}
            >
              <OrbitalIcon name="plus" size={16} />
              {uiText("Adicionar")}
            </button>
            <MemberListToggleButton />
          </div>
        </div>
      )}

      {/* Mobile tab bar */}
      {mobile && (
        <div ref={tabTrackRef} className="lume-friends-tab-track flex border-b border-border-soft">
          {(['online', 'all', 'pending', 'add', 'activity'] as Tab[]).map((tab) => (
            <button
              key={tab}
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-transparent text-txt-primary'
                  : 'border-transparent text-txt-secondary hover:text-txt-primary'
              }`}
            >
              {tab === 'online' ? uiText("Disponíveis") : tab === 'all' ? uiText("Todos") : tab === 'pending' ? uiText("Pedidos") : tab === 'add' ? uiText("Adicionar") : uiText("Atividade")}
              {tab === 'pending' && pendingIncoming.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-notification text-white rounded-full">
                  {pendingIncoming.length}
                </span>
              )}
            </button>
          ))}
          <span aria-hidden="true" className="lume-friends-tab-marker" style={{ transform: `translateX(${tabMarker.left}px)`, width: tabMarker.width, opacity: tabMarker.visible ? 1 : 0 }} />
        </div>
      )}

      <div className="lume-friends-panel flex flex-col flex-1 min-h-0">{renderTabContent()}</div>

      <ConfirmDialog
        isOpen={pendingUnfriend !== null}
        onClose={() => setPendingUnfriend(null)}
        onConfirm={async () => {
          if (pendingUnfriend) {
            await removeFriend(pendingUnfriend.id);
            setPendingUnfriend(null);
          }
        }}
        title={uiText("Remover contato")}
        description={uiText("Quer mesmo remover {0}? Você poderá enviar um novo pedido depois.", [pendingUnfriend?.name ?? 'esta pessoa'])}
        confirmLabel={uiText("Remover")}
        variant="danger"
      />
    </div>
  );
}

// ─── Add Friend Tab ─────────────────────────────────────────────────────────

function AddFriendTab() {
  const sendFriendRequest = useSocialStore((s) => s.sendFriendRequest);
  const addToast = useUIStore((s) => s.addToast);
  const [query, setQuery] = useState(() => useFederationStore.getState().consumePendingFriendAddPrefill() ?? '');
  const [directAddLoading, setDirectAddLoading] = useState(false);
  const trimmedQuery = query.trim();
  const showDirectAdd = /^[^\s@]+(?:@[^\s@]+)?$/.test(trimmedQuery);
  const directAddDisplay = trimmedQuery.includes('@') ? trimmedQuery : trimmedQuery + '@' + window.location.host;

  const handleDirectAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!showDirectAdd || directAddLoading) return;
    const submitted = trimmedQuery;
    setDirectAddLoading(true);
    try {
      await sendFriendRequest(submitted);
      addToast(uiText("Pedido de amizade enviado!"), 'success');
      setQuery(value => value.trim() === submitted ? '' : value);
    } catch (err) {
      const code = err instanceof Error ? err.message : undefined;
      addToast(mapServerErrorToMessage(code, code, submitted), 'warning');
    } finally {
      setDirectAddLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-2 mb-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary" aria-hidden="true">
          <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <h2 className="text-base font-bold text-txt-primary">Adicionar pessoa</h2>
      </div>
      <p className="text-sm text-txt-tertiary mb-4">Adicione alguém pelo nick completo. Para outra instância, use <span className="font-medium text-txt-secondary">usuario@instancia</span>.</p>
      <form onSubmit={handleDirectAdd}>
        <input
          type="text"
          aria-label="Nick da pessoa"
          placeholder="Digite o nick ou usuario@instancia"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="input-search w-full px-4 py-3 rounded-lg mb-4"
        />
        {showDirectAdd && (
          <div className="bg-surface-input rounded-lg p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0 text-sm text-txt-secondary break-all">
              {uiText("Enviar pedido para ")}<span className="font-semibold text-txt-primary">{directAddDisplay}</span>
            </div>
            <button
              type="submit"
              disabled={directAddLoading}
              className="px-3 py-1.5 rounded-md bg-accent-primary hover:bg-accent-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {directAddLoading ? uiText("Enviando...") : uiText("Enviar pedido")}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`lume-friends-tab px-3 py-2 text-[13px] font-semibold transition-all ${
        active ? 'is-active text-cyan-100' : 'text-txt-secondary hover:text-txt-primary'
      }`}
    >
      {children}
    </button>
  );
}

const FriendItem = memo(function FriendItem({ friend, onRemove, onDm }: { friend: TaggedFriend, onRemove: (friend: TaggedFriend) => void, onDm: (id: string, homeUserId?: string, homeInstance?: string | null) => void }) {
  const canonical = useCanonicalUserView(friend as unknown as User);
  const instanceLabel = friend._instanceOrigin ? (() => { try { return new URL(friend._instanceOrigin).host; } catch { return friend._instanceOrigin; } })() : '';
  const { baseName: friendBaseName } = parseFederatedUsername(canonical.username);
  const friendDisplayName = canonical.displayName ?? friendBaseName;
  return (
    <div className="lume-friend-row flex items-center justify-between px-3 h-[62px] rounded-[12px] hover:bg-interactive-hover group transition-colors border border-transparent mx-2">
      <div className="flex items-center gap-3">
        <Avatar src={canonical.avatar} name={friendDisplayName} size={32} status={canonical.status} userId={canonical.homeUserId ?? canonical.id} avatarColor={canonical.avatarColor} />
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-txt-primary font-semibold text-[15px]"><ProfileName user={canonical}>{friendDisplayName}</ProfileName></span>
            <span className="text-txt-tertiary text-[13px] opacity-60 group-hover:opacity-100 transition-opacity font-medium">@{friend.username}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-txt-tertiary font-medium">{statusLabel[friend.status] ?? friend.status}</span>
            {instanceLabel && (
              <span className="text-[11px] text-txt-tertiary/60 font-medium">{uiText("via ")}{instanceLabel}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity pr-2">
        <button
          onClick={(e) => { e.stopPropagation(); onDm(friend.id, friend.homeUserId ?? undefined, friend.homeInstance); }}
          className="w-9 h-9 flex items-center justify-center bg-surface-base rounded-full text-txt-tertiary hover:text-txt-primary transition-colors"
          title={uiText("Mensagem")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-5H6V7h12v2z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(friend); }}
          className="w-9 h-9 flex items-center justify-center bg-surface-base rounded-full text-txt-tertiary hover:text-txt-danger transition-colors"
          title={uiText("Remover contato")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
});

function RequestItem({ request, type, onAccept, onDecline, onCancel }: {
  request: TaggedFriendRequest;
  type: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}) {
  const rawUser = request.user;
  const _FALLBACK_USER = { id: '', username: '', createdAt: 0, isAdmin: false, replicatedInstances: [] } as unknown as User;
  const canonicalUser = useCanonicalUserView((rawUser as unknown as User | null) ?? _FALLBACK_USER);
  const user = rawUser ? canonicalUser : null;
  if (!user) return null;
  const instanceLabel = request._instanceOrigin ? (() => { try { return new URL(request._instanceOrigin).host; } catch { return request._instanceOrigin; } })() : '';
  const { baseName: reqBaseName } = parseFederatedUsername(user.username);
  const reqDisplayName = user.displayName ?? reqBaseName;

  return (
    <div className="lume-friend-row flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-interactive-hover group transition-colors border border-transparent mx-2">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatar} name={reqDisplayName} size={32} status={user.status as any} userId={user.homeUserId ?? user.id} avatarColor={user.avatarColor} />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-txt-primary font-bold text-sm"><ProfileName user={user}>{reqDisplayName}</ProfileName></span>
            <span className="text-txt-tertiary text-xs">@{user.username}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-txt-tertiary">{type === 'incoming' ? uiText("Pedido recebido") : uiText("Pedido enviado")}</span>
            {instanceLabel && (
              <span className="text-[11px] text-txt-tertiary/60 font-medium">{uiText("via ")}{instanceLabel}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {type === 'incoming' ? (
          <>
            <button
              onClick={() => onAccept?.()}
              className="p-2 bg-surface-base rounded-full text-status-online hover:bg-status-online hover:text-white transition-all"
              title={uiText("Aceitar")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </button>
            <button
              onClick={() => onDecline?.()}
              className="p-2 bg-surface-base rounded-full text-txt-danger hover:bg-accent-rose hover:text-white transition-all"
              title={uiText("Recusar")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={() => onCancel?.()}
            className="p-2 bg-surface-base rounded-full text-txt-tertiary hover:text-txt-danger transition-all"
            title={uiText("Cancelar pedido")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

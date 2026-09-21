import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useSocialStore } from '../../stores/socialStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api/client';
import type { AdminUser, Friend, User } from '@backspace/shared';
import { parseFederatedUsername } from '../../utils/identity';
import { useCanonicalUserView } from '../../utils/userViewLookup';

type SearchMode = 'friends' | 'all';

function friendToUser(friend: Friend): User {
  return {
    ...friend,
    isAdmin: false,
    replicatedInstances: [],
  };
}

function adminUserToUser(user: AdminUser): User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    banner: null,
    accentColor: null,
    avatarColor: user.avatarColor as User['avatarColor'],
    bio: null,
    status: user.status as User['status'],
    customStatus: null,
    isAdmin: user.isAdmin,
    isBetaContributor: user.isBetaContributor,
    createdAt: user.createdAt,
    homeInstance: user.homeInstance,
    homeUserId: null,
    replicatedInstances: [],
  };
}

function NewDmUserRow({
  user,
  onSelect,
}: {
  user: User;
  onSelect: (user: User) => void;
}) {
  const canonical = useCanonicalUserView(user);
  const { baseName } = parseFederatedUsername(canonical.username);
  const displayName = canonical.displayName ?? baseName;
  return (
    <button
      onClick={() => onSelect(user)}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-[4px] hover:bg-interactive-hover transition-colors text-left"
    >
      <Avatar src={canonical.avatar} name={displayName} size={36} status={canonical.status as any} userId={canonical.homeUserId ?? canonical.id} avatarColor={canonical.avatarColor} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-txt-primary truncate">
          {displayName}
        </div>
        <div className="text-[12px] text-txt-tertiary truncate">@{canonical.username}</div>
      </div>
    </button>
  );
}

export function NewDmModal() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [mode, setMode] = useState<SearchMode>('friends');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const addDmChannel = useSpaceStore((s) => s.addDmChannel);
  const currentUser = useAuthStore((s) => s.user);
  const friends = useSocialStore((s) => s.friends);
  const loadFriends = useSocialStore((s) => s.loadFriends);
  const isAdmin = currentUser?.isAdmin === true;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const isOpen = activeModal === 'newDm';

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setMode('friends');
      setError('');
      void loadFriends();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, loadFriends]);

  useEffect(() => {
    if (!isOpen || mode !== 'friends') return;
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    const filtered = friends
      .filter((friend) => {
        if (!normalizedQuery) return true;
        return friend.username.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
          || (friend.displayName ?? '').toLocaleLowerCase('pt-BR').includes(normalizedQuery);
      })
      .map(friendToUser);
    setResults(filtered);
    setIsSearching(false);
  }, [friends, isOpen, mode, query]);

  const handleSearch = (value: string) => {
    setQuery(value);
    setError('');

    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (mode === 'friends') {
      return;
    }

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.admin.listUsers({
          q: value.trim(),
          page: 1,
          pageSize: 50,
        });
        setResults(response.users
          .filter((user) => user.id !== currentUser?.id && !user.isDeleted && !user.isSuspended)
          .map(adminUserToUser));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleModeChange = (nextMode: SearchMode) => {
    if (nextMode === 'all' && !isAdmin) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setMode(nextMode);
    setQuery('');
    setResults(nextMode === 'friends' ? friends.map(friendToUser) : []);
    setError('');
    setIsSearching(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelectUser = async (user: User) => {
    setError('');
    try {
      const existing = useSpaceStore.getState().findExistingDmForUser(user);
      if (existing) {
        closeModal();
        useUIStore.getState().setShowDms(true);
        navigate(`/channels/@me/${existing.dm.id}`);
        return;
      }
      const channel = await api.dm.create(mode === 'all'
        ? { userId: user.id }
        : {
            userId: user.homeInstance ? undefined : user.id,
            homeUserId: user.homeUserId ?? undefined,
            homeInstance: user.homeInstance ?? undefined,
          });
      addDmChannel(channel);
      closeModal();
      useUIStore.getState().setShowDms(true);
      navigate(`/channels/@me/${channel.id}`);
    } catch (err) {
      setError((err as Error).message || 'Não foi possível criar a conversa');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Nova mensagem" mobileStyle="sheet">
      <div className="space-y-3">
        {isAdmin && (
          <div className="flex gap-1 rounded-[6px] bg-bg-tertiary p-1" role="tablist" aria-label="Quem pode receber a mensagem">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'friends'}
              onClick={() => handleModeChange('friends')}
              className={`flex-1 rounded-[4px] px-3 py-2 text-[13px] font-semibold transition-colors ${mode === 'friends' ? 'bg-interactive-active text-txt-primary' : 'text-txt-secondary hover:text-txt-primary'}`}
            >
              Amigos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'all'}
              onClick={() => handleModeChange('all')}
              className={`flex-1 rounded-[4px] px-3 py-2 text-[13px] font-semibold transition-colors ${mode === 'all' ? 'bg-interactive-active text-txt-primary' : 'text-txt-secondary hover:text-txt-primary'}`}
            >
              Todos os usuários
            </button>
          </div>
        )}

        {mode === 'all' && (
          <p className="text-[12px] text-txt-tertiary">
            Ferramenta de administrador: inicie uma conversa com qualquer conta sem precisar adicioná-la.
          </p>
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={mode === 'all' ? 'Buscar qualquer usuário...' : 'Buscar nos seus amigos...'}
          className="input-search w-full py-2 text-[14px]"
        />

        {error && (
          <p className="text-txt-danger text-[13px]">{error}</p>
        )}

        <div className="max-h-[300px] overflow-y-auto space-y-[2px]">
          {isSearching && (
            <div className="py-4 text-center text-txt-tertiary text-[14px]">Buscando...</div>
          )}

          {!isSearching && results.length === 0 && (mode === 'friends' || query.trim().length >= 2) && (
            <div className="py-4 text-center text-txt-tertiary text-[14px]">
              {mode === 'friends' ? 'Nenhum amigo encontrado' : 'Nenhum usuário encontrado'}
            </div>
          )}

          {!isSearching && mode === 'all' && query.trim().length < 2 && (
            <div className="py-4 text-center text-txt-tertiary text-[14px]">Digite pelo menos 2 caracteres</div>
          )}

          {results.map((user) => (
            <NewDmUserRow
              key={user.id}
              user={user}
              onSelect={handleSelectUser}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

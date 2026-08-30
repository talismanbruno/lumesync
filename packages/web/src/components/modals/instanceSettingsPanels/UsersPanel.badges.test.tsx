import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ list: vi.fn(), badge: vi.fn(), instances: vi.fn() }));
vi.mock('../../../api/client', () => ({ api: { admin: { listUsers: mocks.list, listInstances: mocks.instances, setBetaContributor: mocks.badge }, uploads: { url: (p: string) => p } } }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: 'admin' } }) }));
vi.mock('../../ui/Avatar', () => ({ Avatar: () => null }));
import { UsersPanel } from './UsersPanel';

const user = { id: 'tupac', username: 'tupac', displayName: 'Tupac', avatar: null, isAdmin: false, isDeleted: false, isBetaContributor: false, homeInstance: null, createdAt: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ users: [user], total: 1, page: 1, pageSize: 50 });
  mocks.instances.mockResolvedValue({ instances: [] });
});

describe('admin beta contributor badge', () => {
  it('grants and revokes the badge with clear feedback', async () => {
    mocks.badge.mockResolvedValueOnce({ ...user, isBetaContributor: true }).mockResolvedValueOnce(user);
    render(<UsersPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Conceder selo Colaborador Beta a @tupac' }));
    expect(await screen.findByRole('status')).toHaveTextContent('concedido a @tupac');
    expect(mocks.badge).toHaveBeenCalledWith('tupac', true);
    fireEvent.click(screen.getByRole('button', { name: 'Remover selo Colaborador Beta de @tupac' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('removido de @tupac'));
    expect(mocks.badge).toHaveBeenLastCalledWith('tupac', false);
  });
  it('does not show success or change the badge after a failed request', async () => {
    mocks.badge.mockRejectedValue(new Error('Sem permissão'));
    render(<UsersPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Conceder selo Colaborador Beta a @tupac' }));
    expect(await screen.findByText('Sem permissão')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conceder selo Colaborador Beta a @tupac' })).toBeEnabled();
  });
  it('prevents duplicate submissions while saving', async () => {
    mocks.badge.mockReturnValue(new Promise(() => {}));
    render(<UsersPanel />);
    const button = await screen.findByRole('button', { name: 'Conceder selo Colaborador Beta a @tupac' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.badge).toHaveBeenCalledTimes(1);
  });
  it.each([{ isDeleted: true }, { homeInstance: 'https://other.example' }])('does not offer recognition for ineligible accounts %j', async (overrides) => {
    mocks.list.mockResolvedValue({ users: [{ ...user, ...overrides }], total: 1, page: 1, pageSize: 50 });
    render(<UsersPanel />);
    await screen.findByText('tupac');
    expect(screen.queryByRole('button', { name: /selo Colaborador Beta/ })).not.toBeInTheDocument();
  });
});

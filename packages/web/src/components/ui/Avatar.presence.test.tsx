import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserStatus } from '@backspace/shared';
import { Avatar } from './Avatar';

beforeAll(() => vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
}));
afterAll(() => vi.unstubAllGlobals());

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: (state: any) => any) => selector({ isMobile: false, openUserProfile: vi.fn() }),
}));

describe('avatar presence tooltip', () => {
  it.each<[UserStatus, string, string | undefined]>([
    ['online', 'Disponível', undefined],
    ['working', 'Trabalhando no Lume', undefined],
    ['idle', 'Ausente', undefined],
    ['dnd', 'Não perturbe', undefined],
    ['offline', 'Offline', undefined],
    ['offline', 'Invisível', 'Invisível'],
  ])('shows %s as %s on hover and hides it on leave', async (status, label, statusLabel) => {
    const pointer = userEvent.setup();
    render(<Avatar name="Teste" status={status} statusLabel={statusLabel} />);
    const indicator = screen.getByRole('img', { name: label });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await pointer.hover(indicator);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
    await pointer.unhover(indicator);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });
});

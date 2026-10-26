import { createRef } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@backspace/shared';
import { useCustomizationStore } from '../../../stores/customizationStore';
import { ProfileCustomizationEditor } from './ProfileCustomizationEditor';
vi.mock('../../ui/Avatar', () => ({ Avatar: () => <div /> }));
vi.mock('../../ui/FlagCanvas', () => ({ ProfileBanner: () => <div /> }));
vi.mock('../../ui/ProfileCosmetics', () => ({
  ProfileFrameSpace: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Nameplate: () => null,
  ProfileCosmetics: ({ effects = true }: { effects?: boolean }) => effects ? <div data-testid="opening-effect" /> : null,
}));
const user = { id: 'preview', username: 'preview', status: 'online', createdAt: 1, customization: { profileEffectId: 'effect' } } as User;
beforeEach(() => { useCustomizationStore.setState({ loaded: true, loading: false, items: [], byId: new Map(), load: vi.fn().mockResolvedValue(undefined) }); });
afterEach(cleanup);
function editor() {
  return render(<ProfileCustomizationEditor user={user} avatarSrc={null} bannerSrc={null} bannerFallback="#111" onCustomization={vi.fn()} onNameColor={vi.fn()} onAccentColor={vi.fn()} onAvatarColor={vi.fn()} onDisplayName={vi.fn()} onBio={vi.fn()} onCustomStatus={vi.fn()} avatarInputRef={createRef()} bannerInputRef={createRef()} onAvatarSelect={vi.fn()} onBannerSelect={vi.fn()} onRemoveAvatar={vi.fn()} onRemoveBanner={vi.fn()} uploading={false} />);
}
describe('profile opening effect preview boundaries', () => {
  it.each(['Decoração de avatar', 'Moldura de perfil', 'Placa de identificação'])('does not overlay the %s picker, while the live preview keeps the effect', label => {
    editor(); fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    expect(within(screen.getByRole('dialog')).queryByTestId('opening-effect')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('opening-effect')).toHaveLength(1);
  });
  it('previews the effect in its own picker and in the live profile', () => {
    editor(); fireEvent.click(screen.getByRole('button', { name: 'Efeito de perfil', exact: true }));
    expect(within(screen.getByRole('dialog')).getByTestId('opening-effect')).toBeInTheDocument();
    expect(screen.getAllByTestId('opening-effect')).toHaveLength(2);
  });
});

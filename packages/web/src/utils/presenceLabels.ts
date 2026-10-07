import type { UserStatus } from '@backspace/shared';

const presenceLabels: Record<UserStatus, string> = {
  online: 'Disponível',
  working: 'Trabalhando no Lume',
  idle: 'Ausente',
  dnd: 'Não perturbe',
  offline: 'Offline',
};

export function getPresenceLabel(status: UserStatus): string {
  return presenceLabels[status];
}

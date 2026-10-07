import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { getOurOrigin } from './federationAuth.js';
import type { ServerEvent } from '@backspace/shared';

export function blockedIdentityKey(user: Pick<typeof schema.users.$inferSelect, 'id' | 'homeUserId' | 'homeInstance'>): string {
  const origin = user.homeInstance || getOurOrigin();
  const host = new URL(origin.includes('://') ? origin : `https://${origin}`).host.toLowerCase();
  return `${host}:${user.homeUserId || user.id}`;
}

export function hasUserBlock(blockerId: string, targetId: string): boolean {
  if (blockerId === targetId) return false;
  const db = getDb();
  const target = db.select().from(schema.users).where(eq(schema.users.id, targetId)).get();
  return !!target && !!db.select({ userId: schema.userBlocks.userId }).from(schema.userBlocks).where(and(
    eq(schema.userBlocks.userId, blockerId), eq(schema.userBlocks.targetKey, blockedIdentityKey(target)),
  )).get();
}

export function isBlockedDirectConversation(dmId: string, senderId: string): boolean {
  const db = getDb();
  const dm = db.select().from(schema.dmChannels).where(eq(schema.dmChannels.id, dmId)).get();
  if (!dm || dm.ownerId) return false;
  return db.select().from(schema.dmMembers).where(eq(schema.dmMembers.dmChannelId, dmId)).all()
    .some(member => member.userId !== senderId && (hasUserBlock(member.userId, senderId) || hasUserBlock(senderId, member.userId)));
}

// Central fan-out guard also covers events received through federation.
export function suppressBlockedContactEvent(recipientId: string, event: ServerEvent): boolean {
  switch (event.type) {
    case 'dm_message_created':
    case 'dm_message_updated': return hasUserBlock(recipientId, event.message.userId);
    case 'dm_call_incoming': return hasUserBlock(recipientId, event.callerId);
    case 'friend_request_received': return hasUserBlock(recipientId, event.request.fromId);
    default: return false;
  }
}

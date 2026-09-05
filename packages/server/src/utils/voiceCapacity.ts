import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';

export interface VoiceCapacityLimits {
  maxVoiceParticipantsPerRoom: number;
  maxConcurrentVoiceParticipants: number;
}

export interface VoiceCapacitySnapshot extends VoiceCapacityLimits {
  targetRoomId: string;
  currentRoomId: string | null;
  roomParticipants: number;
  totalParticipants: number;
  reservedForRoom: number;
  reservedTotal: number;
}

export type VoiceCapacityRejection = 'room_full' | 'instance_full';

const RESERVATION_TTL_MS = 60_000;
const reservations = new Map<string, {
  roomId: string;
  addsToRoom: boolean;
  addsToInstance: boolean;
  expiresAt: number;
}>();

export function readVoiceCapacityLimits(): VoiceCapacityLimits {
  const row = getDb().select({
    maxVoiceParticipantsPerRoom: schema.instanceSettings.maxVoiceParticipantsPerRoom,
    maxConcurrentVoiceParticipants: schema.instanceSettings.maxConcurrentVoiceParticipants,
  }).from(schema.instanceSettings).where(eq(schema.instanceSettings.id, 1)).get();
  return {
    maxVoiceParticipantsPerRoom: row?.maxVoiceParticipantsPerRoom ?? 15,
    maxConcurrentVoiceParticipants: row?.maxConcurrentVoiceParticipants ?? 20,
  };
}

export function evaluateVoiceCapacity(snapshot: VoiceCapacitySnapshot): VoiceCapacityRejection | null {
  const alreadyInTarget = snapshot.currentRoomId === snapshot.targetRoomId;
  const addsToInstance = snapshot.currentRoomId === null;
  const projectedRoom = snapshot.roomParticipants + snapshot.reservedForRoom + (alreadyInTarget ? 0 : 1);
  if (projectedRoom > snapshot.maxVoiceParticipantsPerRoom) return 'room_full';
  const projectedTotal = snapshot.totalParticipants + snapshot.reservedTotal + (addsToInstance ? 1 : 0);
  if (projectedTotal > snapshot.maxConcurrentVoiceParticipants) return 'instance_full';
  return null;
}

function pruneReservations(now = Date.now()): void {
  for (const [userId, reservation] of reservations) {
    if (reservation.expiresAt <= now) reservations.delete(userId);
  }
}

export function getVoiceReservationCounts(excludedUserId: string, roomId: string): { room: number; total: number } {
  pruneReservations();
  let room = 0;
  let total = 0;
  for (const [userId, reservation] of reservations) {
    if (userId === excludedUserId) continue;
    if (reservation.addsToInstance) total += 1;
    if (reservation.addsToRoom && reservation.roomId === roomId) room += 1;
  }
  return { room, total };
}

export function reserveVoiceCapacity(
  userId: string,
  roomId: string,
  impact: { addsToRoom: boolean; addsToInstance: boolean } = { addsToRoom: true, addsToInstance: true },
): void {
  pruneReservations();
  reservations.set(userId, { roomId, ...impact, expiresAt: Date.now() + RESERVATION_TTL_MS });
}

export function clearVoiceCapacityReservation(userId: string): void {
  reservations.delete(userId);
}

export function clearAllVoiceCapacityReservationsForTest(): void {
  reservations.clear();
}

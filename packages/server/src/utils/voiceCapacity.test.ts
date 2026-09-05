import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAllVoiceCapacityReservationsForTest,
  clearVoiceCapacityReservation,
  evaluateVoiceCapacity,
  getVoiceReservationCounts,
  reserveVoiceCapacity,
} from './voiceCapacity.js';

const base = {
  targetRoomId: 'room-a', currentRoomId: null,
  roomParticipants: 0, totalParticipants: 0,
  reservedForRoom: 0, reservedTotal: 0,
  maxVoiceParticipantsPerRoom: 15, maxConcurrentVoiceParticipants: 20,
};

afterEach(() => clearAllVoiceCapacityReservationsForTest());

describe('voice capacity guardrails', () => {
  it('rejects a join that would exceed the room limit', () => {
    expect(evaluateVoiceCapacity({ ...base, roomParticipants: 15 })).toBe('room_full');
  });

  it('rejects a join that would exceed the instance limit', () => {
    expect(evaluateVoiceCapacity({ ...base, totalParticipants: 20 })).toBe('instance_full');
  });

  it('does not double-count a re-registration or a move between rooms globally', () => {
    expect(evaluateVoiceCapacity({ ...base, currentRoomId: 'room-a', roomParticipants: 15, totalParticipants: 20 })).toBeNull();
    expect(evaluateVoiceCapacity({ ...base, currentRoomId: 'room-b', totalParticipants: 20 })).toBeNull();
  });

  it('counts reservations and excludes the requesting user', () => {
    reserveVoiceCapacity('u-1', 'room-a');
    reserveVoiceCapacity('u-2', 'room-b');
    expect(getVoiceReservationCounts('u-3', 'room-a')).toEqual({ room: 1, total: 2 });
    expect(getVoiceReservationCounts('u-1', 'room-a')).toEqual({ room: 0, total: 1 });
    clearVoiceCapacityReservation('u-2');
    expect(getVoiceReservationCounts('u-3', 'room-a')).toEqual({ room: 1, total: 1 });
  });

  it('does not reserve instance capacity for a room move or room capacity for a reconnect', () => {
    reserveVoiceCapacity('moving', 'room-a', { addsToRoom: true, addsToInstance: false });
    reserveVoiceCapacity('reconnecting', 'room-a', { addsToRoom: false, addsToInstance: false });
    expect(getVoiceReservationCounts('observer', 'room-a')).toEqual({ room: 1, total: 0 });
  });
});

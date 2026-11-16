import { isRecord } from '../../shared/types/protocol.ts';
import type { MemorySource } from './types.ts';

export function parseMemorySource(value: unknown): MemorySource | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || Object.keys(value).some(key => !['sessionId', 'seq', 'time', 'hash'].includes(key))
    || typeof value.sessionId !== 'string' || !value.sessionId || value.sessionId.length > 200
    || /[\u0000-\u001f\u007f]/.test(value.sessionId)
    || !Number.isSafeInteger(value.seq) || Number(value.seq) < 0
    || typeof value.time !== 'number' || !Number.isFinite(new Date(value.time).getTime())
    || typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash)) throw new TypeError('memoryInvalid');
  return { sessionId: value.sessionId, seq: Number(value.seq), time: value.time, hash: value.hash };
}

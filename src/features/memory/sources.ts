import { createHash } from 'node:crypto';
import { isRecord } from '../../shared/types/protocol.ts';
import type { MemorySource, MemorySourceMessage, MemorySourceResult } from './types.ts';

export interface MemorySourceQuery {
  readSurface(id: string): Promise<{ session: { id: string; cwd?: string }; events: readonly unknown[] }>;
  readSession?(id: string): Promise<{ session: { id: string; cwd?: string }; events: readonly unknown[] }>;
}
interface Caller { id: string; cwd?: string }
interface TextMessage { seq: number; time: number; role: 'user' | 'assistant'; text: string }
const hashText = (text: string) => createHash('sha256').update(text).digest('hex');

function textMessages(events: readonly unknown[]): TextMessage[] {
  return events.flatMap(event => {
    if (!isRecord(event) || !isRecord(event.data) || !Number.isSafeInteger(event.seq) || Number(event.seq) < 0
      || typeof event.time !== 'number' || !Number.isFinite(event.time)) return [];
    const role = event.type === 'user/message' ? 'user' : event.type === 'assistant/message' ? 'assistant' : null;
    if (role === 'user' && (!isRecord(event.data.source) || event.data.source.kind !== 'user')) return [];
    const blocks = role === 'user' ? event.data.content
      : role === 'assistant' && isRecord(event.data.message) ? event.data.message.content : null;
    if (!role || !Array.isArray(blocks)) return [];
    const text = blocks.flatMap((block: unknown) =>
      isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? [block.text] : []).join('\n');
    return text.trim() ? [{ seq: Number(event.seq), time: event.time, role, text }] : [];
  });
}

function page(message: TextMessage, target: boolean, offset: number): MemorySourceMessage {
  let start = target ? offset : 0;
  if (start > 0 && /[\uDC00-\uDFFF]/.test(message.text.charAt(start))
    && /[\uD800-\uDBFF]/.test(message.text.charAt(start - 1))) start--;
  let end = Math.min(message.text.length, start + (target ? 8_000 : 1_000));
  if (end < message.text.length && /[\uD800-\uDBFF]/.test(message.text.charAt(end - 1))) end--;
  return { seq: message.seq, time: message.time, role: message.role, target, text: message.text.slice(start, end),
    offset: start, nextOffset: end < message.text.length ? end : null, length: message.text.length };
}

export class MemorySources {
  private binding: { service: MemorySourceQuery; lifetime: AbortController } | null = null;

  bind(service: MemorySourceQuery) {
    this.close();
    const binding = { service, lifetime: new AbortController() };
    this.binding = binding;
    return () => { if (this.binding === binding) this.close(); };
  }

  close() {
    this.binding?.lifetime.abort();
    this.binding = null;
  }

  cancel() {
    if (!this.binding) return;
    this.binding.lifetime.abort();
    this.binding.lifetime = new AbortController();
  }

  private async observe(id: string, signal: AbortSignal, guard: () => void, original = false) {
    const binding = this.binding;
    if (!binding) throw new Error('memorySourceUnavailable');
    guard();
    const combined = AbortSignal.any([signal, binding.lifetime.signal, AbortSignal.timeout(15_000)]);
    let abort = () => {};
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new Error('memorySourceUnavailable'));
      combined.addEventListener('abort', abort, { once: true });
      if (combined.aborted) abort();
    });
    try {
      combined.throwIfAborted();
      const surface = await Promise.race([original ? binding.service.readSession!(id) : binding.service.readSurface(id), cancelled]);
      guard();
      if (this.binding !== binding || combined.aborted || surface.session.id !== id) throw new Error('memorySourceUnavailable');
      return { header: surface.session, messages: textMessages(surface.events) };
    } catch (error) {
      if (isRecord(error) && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') throw new Error('memorySourceNotFound');
      throw new Error('memorySourceUnavailable');
    }
    finally { combined.removeEventListener('abort', abort); }
  }

  async capture(caller: Caller | undefined, quote: string | undefined, signal: AbortSignal, guard: () => void): Promise<MemorySource | null> {
    if (quote !== undefined && (!quote.trim() || quote.length > 500)) throw new Error('memoryInvalid');
    if (!caller?.id || !this.binding) {
      if (quote !== undefined) throw new Error('memorySourceUnavailable');
      return null;
    }
    const snapshot = await this.observe(caller.id, signal, guard);
    if (snapshot.header.cwd !== caller.cwd) throw new Error('memorySourceUnavailable');
    const message = snapshot.messages.findLast(row => row.role === 'user' && (quote === undefined || row.text.includes(quote)));
    if (!message) {
      if (quote !== undefined) throw new Error('memorySourceNotFound');
      return null;
    }
    return { sessionId: caller.id, seq: message.seq, time: message.time, hash: hashText(message.text) };
  }

  async read(source: MemorySource | null | undefined, offset: number, signal: AbortSignal, guard: () => void,
    caller?: Caller): Promise<MemorySourceResult> {
    const absent = (reason: MemorySourceResult['reason']): MemorySourceResult => ({
      available: false, reason, source: source ?? null, messages: [],
    });
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('memoryInvalid');
    guard();
    if (!source) return absent('not-recorded');
    if (!this.binding) return absent('unavailable');
    let snapshot: Awaited<ReturnType<MemorySources['observe']>>;
    try { snapshot = await this.observe(source.sessionId, signal, guard); } catch (error) {
      if (error instanceof Error && error.message === 'memorySourceNotFound') return absent('not-found');
      throw error;
    }
    if (caller && source.sessionId !== caller.id && (!caller.cwd || snapshot.header.cwd !== caller.cwd)) return absent('workspace');
    let historical = false;
    if (!snapshot.messages.some(row => row.seq === source.seq && row.role === 'user')
      && typeof this.binding?.service.readSession === 'function') {
      try { snapshot = await this.observe(source.sessionId, signal, guard, true); } catch (error) {
        if (error instanceof Error && error.message === 'memorySourceNotFound') return absent('not-found');
        throw error;
      }
      if (caller && source.sessionId !== caller.id && (!caller.cwd || snapshot.header.cwd !== caller.cwd)) return absent('workspace');
      historical = true;
    }
    const index = snapshot.messages.findIndex(row => row.seq === source.seq && row.role === 'user');
    if (index < 0) return absent('not-found');
    const message = snapshot.messages[index]!;
    if (message.time !== source.time || hashText(message.text) !== source.hash) return absent('changed');
    if (offset >= message.text.length && offset !== 0) throw new Error('memoryInvalid');
    return { available: true, reason: '', source, historical,
      messages: snapshot.messages.slice(Math.max(0, index - 2), index + 3).map(row => page(row, row === message, offset)) };
  }
}

/**
 * Per-instance state the settings page reads: whether each configured provider
 * instance has a key, and where that key lives — never the key itself.
 *
 * Keys live in the credentials center as `power-dsh/<instance id>` records.
 * The id belongs to the INSTANCE, not the vendor: two Tavily instances with
 * different keys are two records, so re-keying one never touches the other.
 *
 * @module power-dsh/web-search/state
 */

import type { NativeContext } from '../../shared/host/native.ts';
import { backendOf } from './backends.ts';

/** One configured instance as the settings page renders it. */
export interface SlotRow {
  /** Instance id. */
  id: string;
  /** Vendor id. */
  provider: string;
  /** Whether a non-empty key is stored. */
  configured: boolean;
  /** Whether the credential store accepts a write for this instance. */
  writable: boolean;
  /** Whether the stored key resolves to a non-empty value. */
  hasKey: boolean;
}

/** The preference shape one chain persists. */
export interface SlotPreference {
  id: string;
  provider: string;
  legacyCredentialId?: string;
}

/** Structural view of the credentials service this module consumes. */
export interface Credentials {
  describeRecord(key: unknown): Promise<{ configured: boolean; writable: boolean }>;
  readRecord(key: unknown): Promise<{ kind: string; key?: string } | undefined>;
  modifyRecord(key: unknown, mutate: (current: unknown) => Promise<unknown>): Promise<unknown>;
  deleteRecord(key: unknown): Promise<void>;
}

/**
 * Build the credential key for one instance. The scope is this plugin's own
 * registered name, so records written here cannot collide with another plugin's.
 */
export function credentialKeyOf(slotId: string): string {
  return `power-dsh/${slotId}`;
}

/**
 * Read every instance's key presence. A missing credentials service reports
 * every key as unconfigured and unwritable instead of throwing, because the
 * settings page must still render and explain what is missing.
 */
export async function readSlotRows(
  credentials: Credentials | undefined,
  slots: readonly SlotPreference[],
): Promise<SlotRow[]> {
  const rows: SlotRow[] = [];
  for (const slot of slots) {
    const backend = backendOf(slot.provider);
    if (!backend) continue;
    if (!credentials) {
      rows.push({ id: slot.id, provider: slot.provider, configured: false, writable: false, hasKey: false });
      continue;
    }
    try {
      const key = credentialKeyOf(slot.legacyCredentialId ?? slot.id);
      const info = await credentials.describeRecord(key);
      const record = info.configured ? await credentials.readRecord(key) : undefined;
      const hasKey = record?.kind === 'api-key' && typeof record.key === 'string' && record.key.trim() !== '';
      rows.push({ id: slot.id, provider: slot.provider, configured: hasKey, writable: info.writable, hasKey });
    } catch {
      rows.push({ id: slot.id, provider: slot.provider, configured: false, writable: false, hasKey: false });
    }
  }
  return rows;
}

/** Resolve one instance's key for a live request; empty when unconfigured. */
export async function resolveKey(credentials: Credentials | undefined, slotId: string): Promise<string> {
  if (!credentials) return '';
  try {
    const record = await credentials.readRecord(credentialKeyOf(slotId));
    return record?.kind === 'api-key' && typeof record.key === 'string' ? record.key.trim() : '';
  } catch {
    return '';
  }
}

/** Store one instance's key; an empty value removes it. */
export async function writeKey(
  credentials: Credentials | undefined,
  slotId: string,
  value: string,
): Promise<void> {
  if (!credentials) throw new Error('webSearchCredentialsUnavailable');
  const key = credentialKeyOf(slotId);
  if (value === '') {
    await credentials.deleteRecord(key);
    return;
  }
  await credentials.modifyRecord(key, async () => ({ kind: 'api-key', key: value }));
}

/**
 * Narrow a context to the credentials surface, when the profile has it.
 *
 * The context must be one whose fiber DECLARES `credentials` in its `inject`
 * list: Cordis throws `cannot get property "credentials" without inject` on a
 * plain property read from a fiber that does not, which would fail the whole
 * settings page rather than degrade it. Callers therefore obtain the service
 * inside `ctx.inject(['credentials'], …)` and pass that child context here.
 */
export function credentialsOf(ctx: NativeContext): Credentials | undefined {
  let service: unknown;
  try {
    service = (ctx as { credentials?: unknown }).credentials;
  } catch {
    // Undeclared dependency: report absence so the page still renders.
    return undefined;
  }
  if (!service || typeof service !== 'object') return undefined;
  const candidate = service as Partial<Credentials>;
  return typeof candidate.describeRecord === 'function' && typeof candidate.readRecord === 'function'
    && typeof candidate.modifyRecord === 'function' && typeof candidate.deleteRecord === 'function'
    ? service as Credentials : undefined;
}

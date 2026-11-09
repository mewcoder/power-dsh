import type { HostFeature } from '../shared/host/feature.ts';
import type { PreferenceKey, Preferences, LivePreferences } from '../shared/types/preferences.ts';
import z from '@deepseek-ai/schemastery';
import { HOST_FEATURES } from './host-features.ts';

export function composeConfig(features: readonly HostFeature[]) {
  const ids = new Set();
  const fields: Record<string, unknown> = {};
  for (const { definition, configFields } of features) {
    if (ids.has(definition.id)) throw new Error(`Duplicate Host feature: ${definition.id}`);
    ids.add(definition.id);
    const keys = Object.keys(configFields);
    if (keys.length !== definition.keys.length || keys.some(key => !definition.keys.includes(key as PreferenceKey))) {
      throw new Error(`Configuration keys do not match feature: ${definition.id}`);
    }
    for (const [key, schema] of Object.entries(configFields)) {
      if (Object.hasOwn(fields, key)) throw new Error(`Duplicate configuration key: ${key}`);
      fields[key] = schema;
    }
  }
  return z.object(fields);
}

export const Config = composeConfig(HOST_FEATURES) as unknown as z<Partial<Preferences>, LivePreferences>;

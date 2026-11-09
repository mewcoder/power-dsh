import { locales as shared } from '../shared/client/locales.ts';
import type { ClientFeatureSelection, Locales } from '../shared/client/types.ts';
import { clientFeatures } from './client-features.ts';

export function composeDictionaries(contributions: readonly Locales[]): Locales {
  const result: Locales = { en: {}, zh: {} };
  for (const contribution of contributions) {
    for (const language of ['en', 'zh'] as const) {
      if (Object.keys(contribution.en).sort().join() !== Object.keys(contribution.zh).sort().join()) throw new Error('Locale key mismatch');
      for (const [key, value] of Object.entries(contribution[language])) {
        if (Object.hasOwn(result[language], key)) throw new Error(`Duplicate locale key: ${key}`);
        result[language][key] = value;
      }
    }
  }
  return result;
}

export function featureDictionaries(features: readonly ClientFeatureSelection[] = clientFeatures) {
  return composeDictionaries([shared, ...features.map(feature => feature.locales)]);
}

export const dictionaries = featureDictionaries();

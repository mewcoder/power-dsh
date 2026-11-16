import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

export function createClientFeature(_runtime: ClientRuntime, _env: ClientEnvironment) {
  return {
    settings: [{ field: 'historySearchEnabled', description: 'historySearchDescription' }],
  } satisfies ClientFeature;
}

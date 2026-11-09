import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { ctx } = env;
  const setSearchBlocked = async (blocked: boolean) => {
    const result = await ctx.remote.powerDsh.setSearchBlocked(blocked);
    await ctx.configForms.describe().load();
    if (!result.ok) throw new Error(result.error.message);
  };
  return { settings: [{ field: 'blockOfficialSearch', description: 'blockSearchDescription', save: next => setSearchBlocked(next === true) }], api: { setSearchBlocked } } satisfies ClientFeature;
}

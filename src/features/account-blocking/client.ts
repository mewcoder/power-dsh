import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { ctx } = env;
  const setAccountBlocked = async (blocked: boolean) => {
    const result = await ctx.remote.powerDsh.setAccountBlocked(blocked);
    await ctx.configForms.describe().load();
    if (!result.ok) throw new Error(result.error.message);
  };
  return { settings: [{ field: 'blockOfficialAccount', description: 'blockAccountDescription', save: next => setAccountBlocked(next === true) }], api: { setAccountBlocked } } satisfies ClientFeature;
}

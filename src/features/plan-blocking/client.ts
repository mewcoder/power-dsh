import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { ctx } = env;
  const setPlanBlocked = async (blocked: boolean) => {
    const result = await ctx.remote.powerDsh.setPlanBlocked(blocked);
    await ctx.configForms.describe().load();
    if (!result.ok) throw new Error(result.error.message);
  };
  return {
    settings: [{ field: 'blockPlan', description: 'blockPlanDescription', save: next => setPlanBlocked(next === true) }],
    api: { setPlanBlocked },
  } satisfies ClientFeature;
}

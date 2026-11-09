import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { ctx } = env;
  const setGoalBlocked = async (blocked: boolean) => {
    const result = await ctx.remote.powerDsh.setGoalBlocked(blocked);
    await ctx.configForms.describe().load();
    if (!result.ok) throw new Error(result.error.message);
  };
  return {
    settings: [{ field: 'blockGoal', description: 'blockGoalDescription', save: next => setGoalBlocked(next === true) }],
    api: { setGoalBlocked },
  } satisfies ClientFeature;
}

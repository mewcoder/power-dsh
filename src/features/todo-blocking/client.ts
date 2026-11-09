import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { ctx } = env;
  const setTodoBlocked = async (blocked: boolean) => {
    const result = await ctx.remote.powerDsh.setTodoBlocked(blocked);
    await ctx.configForms.describe().load();
    if (!result.ok) throw new Error(result.error.message);
  };
  return { settings: [{ field: 'blockTodo', description: 'blockTodoDescription', save: next => setTodoBlocked(next === true) }], api: { setTodoBlocked } } satisfies ClientFeature;
}

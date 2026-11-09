import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { ctx } = env;
  const setTelemetryBlocked = async (blocked: boolean) => {
    const result = await ctx.remote.powerDsh.setTelemetryBlocked(blocked);
    await ctx.configForms.describe().load();
    if (!result.ok) throw new Error(result.error.message);
  };
  return { settings: [{ field: 'blockOfficialTelemetry', description: 'blockTelemetryDescription', save: next => setTelemetryBlocked(next === true) }], api: { setTelemetryBlocked } } satisfies ClientFeature;
}

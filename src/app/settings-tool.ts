import type { NativeContext } from '../shared/host/native.ts';
import type { HostFeature, SettingsService, ToolSchema } from '../shared/host/feature.ts';
import type { LivePreferences, SettingsParameter, SettingsOutput } from '../shared/types/preferences.ts';
type ParameterFields = { [K in SettingsParameter]: { type: 'boolean' } };
type OutputFields = { [K in SettingsParameter]: { type: 'boolean'; required: true } } & {
  version: { oneOf: [{ type: 'string' }, { type: 'null' }]; required: true };
  telemetry: { type: 'object'; additionalProperties: false; required: true; properties: {
    protected: { type: 'boolean'; required: true };
    senders: { type: 'array'; required: true; items: { type: 'object'; additionalProperties: false; properties: {
      id: { type: 'string'; required: true }; enabled: { type: 'boolean'; required: true }; active: { type: 'boolean'; required: true }; available: { type: 'boolean'; required: true };
    } } };
  } };
};
import { defineTool } from '@deepseek-ai/dsh-tools';

function mergeFields(target: Partial<Record<string, ToolSchema>>, fields: Partial<Record<string, ToolSchema>> | undefined, label: string) {
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (Object.hasOwn(target, key)) throw new Error(`Duplicate settings tool ${label}: ${key}`);
    target[key] = value;
  }
}

export function createSettingsTool(ctx: NativeContext, config: LivePreferences, namespace: string, service: SettingsService, features: readonly HostFeature[]) {
  const contributions = features.flatMap(feature => feature.settingsTool ? [feature.settingsTool] : []);
  const parameters: Record<string, ToolSchema> = {};
  const properties: Record<string, ToolSchema> = {};
  for (const contribution of contributions) {
    mergeFields(parameters, contribution.parameters, 'parameter');
    mergeFields(properties, contribution.output, 'output');
  }
  const mutations = contributions.flatMap(contribution => contribution.mutations ?? [])
    .sort((a, b) => a.order - b.order);
  const reads = contributions.flatMap(contribution => contribution.reads ?? [])
    .sort((a, b) => a.order - b.order);
  for (const { field, method } of mutations) {
    if (!Object.hasOwn(parameters, field) || method && typeof service[method] !== 'function') {
      throw new Error(`Invalid settings tool mutation: ${field}`);
    }
  }
  return defineTool({
    name: 'power_dsh_settings',
    description: 'Read or change Mod preferences and report the DSH version.',
    parameters: parameters as ParameterFields,
    output: {
      schema: { type: 'object', additionalProperties: false, properties: properties as Partial<OutputFields> },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted();
      for (const { field, method } of mutations) {
        if (args[field] === undefined) continue;
        if (method) await service[method](args[field]);
        else await ctx.settings.mutate(namespace, [{ op: 'set', path: [field], value: args[field] }]);
      }
      const result: Partial<SettingsOutput> = {};
      for (const { read } of reads) {
        const value = read({ ctx, config, service });
        Object.assign(result, value instanceof Promise ? await value : value);
      }
      return result;
    },
  });
}

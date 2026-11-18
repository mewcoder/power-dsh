import { isRecord } from '../../shared/types/protocol.ts';

import type { TaskModelSelection, TaskModelOption } from '../../shared/types/wire.ts';
export type { TaskModelSelection, TaskModelOption, TaskModelRow, TaskModelCatalog } from '../../shared/types/wire.ts';

export function parseSelection(value: unknown): TaskModelSelection {
  if (!isRecord(value) || Object.keys(value).some(key => !['provider', 'model', 'reasoningEffort'].includes(key))
    || typeof value.provider !== 'string' || !value.provider || value.provider.length > 200
    || typeof value.model !== 'string' || !value.model || value.model.length > 200
    || value.reasoningEffort !== undefined && (typeof value.reasoningEffort !== 'string' || !value.reasoningEffort || value.reasoningEffort.length > 100)) {
    throw new Error('taskModelsInvalid');
  }
  return { provider: value.provider, model: value.model,
    ...(value.reasoningEffort === undefined ? {} : { reasoningEffort: value.reasoningEffort }) };
}

export function parseBindings(text: string): Map<string, TaskModelSelection> {
  if (text.length > 1_000_000) throw new Error('taskModelsInvalid');
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || Array.isArray(value) || Object.keys(value).length > 1000) throw new Error('taskModelsInvalid');
  return new Map(Object.entries(value).map(([id, selection]) => {
    if (!id || id.length > 200) throw new Error('taskModelsInvalid');
    return [id, parseSelection(selection)];
  }));
}

export function parseModels(value: unknown): TaskModelOption[] {
  if (!isRecord(value) || !Array.isArray(value.groups)) throw new Error('taskModelsUnavailable');
  const models: TaskModelOption[] = [];
  for (const group of value.groups) {
    if (!isRecord(group) || typeof group.id !== 'string' || !Array.isArray(group.models)) throw new Error('taskModelsUnavailable');
    for (const model of group.models) {
      if (!isRecord(model) || typeof model.id !== 'string' || typeof model.name !== 'string') throw new Error('taskModelsUnavailable');
      const reasoning = isRecord(model.reasoning) ? model.reasoning : null;
      const efforts = Array.isArray(reasoning?.efforts) ? reasoning.efforts.map(effort => {
        if (!isRecord(effort) || typeof effort.id !== 'string') throw new Error('taskModelsUnavailable');
        return { id: effort.id, label: typeof effort.name === 'string' ? effort.name : effort.id };
      }) : [];
      models.push({ provider: group.id, model: model.id, label: `${typeof group.name === 'string' ? group.name : group.id} · ${model.name}`, efforts });
    }
  }
  if (models.length > 1000) throw new Error('taskModelsUnavailable');
  return models;
}

export function requireModel(selection: TaskModelSelection, models: readonly TaskModelOption[]) {
  const model = models.find(row => row.provider === selection.provider && row.model === selection.model);
  if (!model || selection.reasoningEffort !== undefined && !model.efforts.some(effort => effort.id === selection.reasoningEffort)) {
    throw new Error('taskModelsModelUnavailable');
  }
}

export function reminderTaskId(message: unknown): string | null {
  if (!isRecord(message) || !isRecord(message.source) || message.source.kind !== 'schedule'
    || !Array.isArray(message.content) || message.content.length !== 1) return null;
  const block: unknown = message.content[0];
  if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') return null;
  const lines = block.text.split('\n', 4);
  if (lines[0] !== '[SCHEDULE REMINDER]' || lines[1] !== 'This is a scheduled message from the user'
    || !lines[2]?.startsWith('schedule_id_json: ')) return null;
  try {
    const id: unknown = JSON.parse(lines[2].slice('schedule_id_json: '.length));
    return typeof id === 'string' && id.length > 0 && id.length <= 200 ? id : null;
  } catch { return null; }
}

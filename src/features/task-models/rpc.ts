import { isRecord, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import { stringCodec } from '../../shared/rpc/codecs.ts';
import { parseSelection, type TaskModelCatalog } from './types.ts';

const catalogCodec: Codec<TaskModelCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#TaskModelCatalog',
  create: () => ({ parse(value: unknown): TaskModelCatalog {
    if (!isRecord(value) || typeof value.revision !== 'string' || value.revision.length > 1_000_000
      || !Array.isArray(value.tasks) || !Array.isArray(value.models) || value.tasks.length > 10000 || value.models.length > 1000) throw new TypeError('taskModelsInvalid');
    const tasks = value.tasks.map(task => {
      if (!isRecord(task) || typeof task.id !== 'string' || typeof task.title !== 'string'
        || !['session', 'new', 'new_once'].includes(String(task.target)) || typeof task.status !== 'string'
        || typeof task.error !== 'string') throw new TypeError('taskModelsInvalid');
      return { id: task.id, title: task.title, target: task.target as 'session' | 'new' | 'new_once', status: task.status,
        error: task.error, selection: task.selection === null ? null : parseSelection(task.selection) };
    });
    const models = value.models.map(model => {
      const selection = parseSelection(isRecord(model) ? { provider: model.provider, model: model.model } : model);
      if (!isRecord(model) || typeof model.label !== 'string' || !Array.isArray(model.efforts) || model.efforts.length > 100) throw new TypeError('taskModelsInvalid');
      return { ...selection, label: model.label, efforts: model.efforts.map(effort => {
        if (!isRecord(effort) || typeof effort.id !== 'string' || typeof effort.label !== 'string') throw new TypeError('taskModelsInvalid');
        return { id: effort.id, label: effort.label };
      }) };
    });
    return { revision: value.revision, tasks, models };
  } }),
};

function descriptor<M extends string>(method: M, fields: string[]): RpcDescriptor<M, TaskModelCatalog> {
  return { id: `power-dsh#powerDsh/${method}`, service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' }, parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: stringCodec })), result: catalogCodec };
}
export const rpc = [descriptor('readTaskModels', []), descriptor('saveTaskModel', ['id', 'selection', 'revision'])];

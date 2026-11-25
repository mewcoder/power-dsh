import type { ClientRuntime, ClientEnvironment, ClientFeature } from '../../shared/client/types.ts';
import type { TaskModelCatalog, TaskModelRow, TaskModelSelection } from './types.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';

const styles = `
.power-dsh-task-models{max-width:720px}
.power-dsh-task-models .power-dsh-task-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.power-dsh-task-models-list{margin-top:24px}
.power-dsh-task-models-empty{display:flex;align-items:center;flex-direction:column;padding:48px 20px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:1.6}
.power-dsh-task-models-empty>svg{flex:none;margin-bottom:12px;color:var(--dsw-alias-label-caption)}
.power-dsh-task-models-empty h3{margin:0;font-size:14px;line-height:1.6;font-weight:400}
.power-dsh-task-model{padding:16px 0;border-bottom:0.5px solid var(--dsw-alias-border-l2);min-width:0}
.power-dsh-task-model:first-child{padding-top:0}
.power-dsh-task-model:last-child{border-bottom:0}
.power-dsh-task-model-row{display:flex;flex-direction:column;align-items:stretch;gap:10px;min-width:0}
.power-dsh-task-model-row[data-session]{flex-direction:row;align-items:center;justify-content:space-between;gap:12px}
.power-dsh-task-model-copy{flex:1;min-width:0}
.power-dsh-task-model h3{margin:0;font-size:14px;line-height:22px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.power-dsh-task-model p{margin:4px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.power-dsh-task-model-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,128px);align-items:center;gap:8px;min-width:0}
.power-dsh-task-model-picker{min-width:0}
.power-dsh-task-model-picker:only-child{grid-column:1/-1}
.power-dsh-task-menu{width:100%;min-width:0;max-width:100%}
.power-dsh-task-select{box-sizing:border-box;display:inline-flex;align-items:center;gap:12px;justify-content:space-between;width:100%;height:36px;max-width:100%;min-width:0;padding:0 14px;border:0;border-radius:var(--dsw-radius-md);font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform);text-align:left;cursor:pointer}
.power-dsh-task-select span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.power-dsh-task-select svg{flex:none}
.power-dsh-task-select:disabled{opacity:.5;cursor:default}
.power-dsh-task-select:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
@media (hover:hover){.power-dsh-task-select:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}}
`;

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment): ClientFeature {
  const { React, h, Menu, Button, NativeIcon, useSnapshot, errorFeedback, loadingFeedback } = runtime;
  const { ctx, t, source, preferenceSlot, namespace } = env;
  const message = (error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    const key = ['taskModelsUnavailable', 'taskModelsModelUnavailable', 'taskModelsConflict', 'taskModelsMissing', 'taskModelsExistingSession', 'taskModelsInvalid'].find(key => text.includes(key));
    return t(key ?? 'taskModelsFailed');
  };

  function TaskModelsPage() {
    const form = useSnapshot(source);
    const [catalog, setCatalog] = React.useState<TaskModelCatalog | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState<string | null>(null);
    const [error, setError] = React.useState('');
    const [menu, setMenu] = React.useState<string | null>(null);
    const generation = React.useRef(0);
    const pending = React.useRef(false);
    const mounted = React.useRef(true);
    const load = async () => {
      if (pending.current) return;
      const token = ++generation.current;
      setLoading(true); setError('');
      try {
        const reply = await ctx.remote.powerDsh.readTaskModels();
        if (!reply.ok) throw new Error(reply.error.message);
        if (mounted.current && token === generation.current) setCatalog(reply.value);
      } catch (failure) { if (mounted.current && token === generation.current) setError(message(failure)); }
      finally { if (mounted.current && token === generation.current) setLoading(false); }
    };
    React.useEffect(() => {
      mounted.current = true;
      void load();
      const refresh = () => { void load(); };
      window.addEventListener('focus', refresh);
      return () => { mounted.current = false; generation.current++; window.removeEventListener('focus', refresh); };
    }, []);
    const save = async (task: TaskModelRow, selection: TaskModelSelection | null) => {
      if (pending.current || !catalog || !form.writable || loading) return;
      pending.current = true;
      const token = ++generation.current;
      setSaving(task.id); setError('');
      try {
        const reply = await ctx.remote.powerDsh.saveTaskModel(task.id, selection ? JSON.stringify(selection) : '', catalog.revision);
        if (!reply.ok) throw new Error(reply.error.message);
        if (mounted.current && token === generation.current) setCatalog(reply.value);
      } catch (failure) { if (mounted.current && token === generation.current) setError(message(failure)); }
      finally { pending.current = false; if (mounted.current) setSaving(null); }
    };
    const select = (id: string, label: string, value: string, items: { id: string; label: string }[], onSelect: (id: string) => void, title: string) => {
      const open = menu === id;
      const selectedLabel = items.find(item => item.id === value)?.label ?? t('taskModelsModelUnavailable');
      return h('div', { key: id, className: 'power-dsh-task-model-picker' }, h(Menu, {
        open, items, selectedId: value, portal: true, align: 'end', autoFocus: true, minWidthFromAnchor: true, className: 'power-dsh-task-menu',
        onClose: () => setMenu(null), onSelect: next => { setMenu(null); onSelect(next); },
        anchor: h('button', { type: 'button', className: 'power-dsh-task-select', disabled: loading || saving !== null || !form.writable,
          'aria-label': `${label} · ${title}`, 'aria-haspopup': 'menu', 'aria-expanded': open, title: `${label} · ${selectedLabel}`,
          onClick: () => setMenu(open ? null : id) }, h('span', null, selectedLabel),
          h(NativeIcon, { glyph: 'chevron-down-outline', weight: 'regular' })),
      }));
    };
    const renderTask = (task: TaskModelRow) => {
      const selected = task.selection;
      const modelIndex = selected ? catalog?.models.findIndex(model => model.provider === selected.provider && model.model === selected.model) ?? -1 : -1;
      const model = modelIndex >= 0 ? catalog?.models[modelIndex] : null;
      return h('article', { key: task.id, className: 'power-dsh-task-model', 'aria-busy': saving === task.id },
        h('div', { className: 'power-dsh-task-model-row', 'data-session': task.target === 'session' || undefined },
          h('div', { className: 'power-dsh-task-model-copy' }, h('h3', { title: task.title }, task.title),
            task.target === 'session' && h('p', null, t(selected ? 'taskModelsApplied' : 'taskModelsExisting'))),
          task.target === 'session' ?
            selected && h(Button, { variant: 'ghost', size: 'sm', disabled: saving !== null || loading || !form.writable,
              onClick: () => save(task, null) }, t('taskModelsReset'))
            : h('div', { className: 'power-dsh-task-model-controls' },
              select(`${task.id}-model`, t('taskModelsModel'), selected ? String(modelIndex) : '',
                [{ id: '', label: t('taskModelsDefault') }, ...(catalog?.models.map((model, index) => ({ id: String(index), label: model.label })) ?? [])],
                next => { const model = next === '' ? null : catalog?.models[Number(next)];
                  void save(task, model ? { provider: model.provider, model: model.model } : null); }, task.title),
              model && model.efforts.length > 0 && select(`${task.id}-effort`, t('taskModelsEffort'), selected?.reasoningEffort ?? '',
                [{ id: '', label: t('taskModelsEffortDefault') }, ...model.efforts],
                next => { if (selected) void save(task, { provider: selected.provider, model: selected.model, ...(next ? { reasoningEffort: next } : {}) }); }, task.title))),
        task.error && errorFeedback({ t, message: message(task.error), code: 'PD-TASK-MODEL-UNAVAILABLE', operation: 'taskModels.delivery' }));
    };
    return h('section', { className: 'power-dsh-page power-dsh-task-models', 'aria-label': t('taskModelsTitle') },
      h('style', null, shellStyles + styles),
      h('header', null, h('div', { className: 'power-dsh-task-heading' },
        h('h2', { className: 'power-dsh-title' }, t('taskModelsTitle')),
        h(Button, { variant: 'ghost', size: 'sm', disabled: loading || saving !== null, onClick: load }, t('taskModelsReload'))),
      h('p', { className: 'power-dsh-description' }, t('taskModelsHelp'))),
      loading && loadingFeedback({ label: t('loading') }),
      error && errorFeedback({ t, message: error, code: 'PD-TASK-MODELS', operation: 'taskModels.configure', retry: load }),
      !loading && !error && catalog?.tasks.length === 0 && h('div', { className: 'power-dsh-task-models-empty', role: 'status' },
        h(NativeIcon, { glyph: 'clock-outline', weight: 'regular', size: 24 }),
        h('h3', null, t('taskModelsEmpty'))),
      Boolean(catalog?.tasks.length) && h('div', { className: 'power-dsh-task-models-list' }, catalog?.tasks.map(renderTask)));
  }
  function Icon() {
    return h(NativeIcon, { glyph: 'clock-outline', weight: 'regular' });
  }
  preferenceSlot('taskModelsEnabled', 'settings.section', { id: 'power-dsh-task-models', order: 59, locale: namespace, label: () => t('taskModelsTitle') }, TaskModelsPage);
  preferenceSlot('taskModelsEnabled', 'settings.section.icon', { id: 'power-dsh-task-models', order: 59 }, Icon);
  return { settings: [
    { field: 'taskModelsEnabled', description: 'taskModelsDescription', save: value => env.savePreference('taskModelsEnabled', value === true) },
    { field: 'taskModelBindings', hidden: true },
  ] };
}

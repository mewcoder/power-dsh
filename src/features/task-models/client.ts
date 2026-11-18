import type { ClientRuntime, ClientEnvironment, ClientFeature } from '../../shared/client/types.ts';
import type { TaskModelCatalog, TaskModelRow, TaskModelSelection } from './types.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';

const styles = `
.power-dsh-task-models .power-dsh-task-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.power-dsh-task-models-list{display:grid;gap:12px;margin-top:20px}
.power-dsh-task-model{border:0.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-settings-card-fill);padding:14px;min-width:0}
.power-dsh-task-model h3{margin:0 0 10px;font-size:14px;font-weight:500;overflow-wrap:anywhere}
.power-dsh-task-model p{margin:6px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.power-dsh-task-model label{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,60%);align-items:center;gap:16px;margin-top:10px;font-size:13px}
.power-dsh-task-select{display:flex;align-items:center;gap:8px;justify-content:space-between;width:100%;min-width:0;font:inherit;color:inherit;background:var(--dsw-alias-bg-module-platform);border:0.5px solid var(--dsw-alias-settings-card-stroke);border-radius:8px;padding:6px 10px;text-align:left}
.power-dsh-task-select span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.power-dsh-task-select svg{flex-shrink:0}
.power-dsh-task-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
`;

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment): ClientFeature {
  const { React, h, Menu, Button, useSnapshot, errorFeedback, loadingFeedback } = runtime;
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
      return h('label', { key: id }, label, h(Menu, {
        open, items, selectedId: value, portal: true, align: 'end', autoFocus: true, minWidthFromAnchor: true,
        onClose: () => setMenu(null), onSelect: next => { setMenu(null); onSelect(next); },
        anchor: h('button', { type: 'button', className: 'power-dsh-task-select', disabled: loading || saving !== null || !form.writable,
          'aria-label': `${label} · ${title}`, 'aria-haspopup': 'menu', 'aria-expanded': open,
          onClick: () => setMenu(open ? null : id) }, h('span', null, items.find(item => item.id === value)?.label ?? t('taskModelsModelUnavailable')),
          h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4' }))),
      }));
    };
    const renderTask = (task: TaskModelRow) => {
      const selected = task.selection;
      const modelIndex = selected ? catalog?.models.findIndex(model => model.provider === selected.provider && model.model === selected.model) ?? -1 : -1;
      const model = modelIndex >= 0 ? catalog?.models[modelIndex] : null;
      return h('article', { key: task.id, className: 'power-dsh-task-model', 'aria-busy': saving === task.id },
        h('h3', null, task.title),
        task.target === 'session' ? h(React.Fragment, null,
          h('p', null, t(selected ? 'taskModelsApplied' : 'taskModelsExisting')),
          selected && h(Button, { variant: 'ghost', size: 'sm', disabled: saving !== null || loading || !form.writable,
            onClick: () => save(task, null) }, t('taskModelsReset')))
          : h(React.Fragment, null,
            select(`${task.id}-model`, t('taskModelsModel'), selected ? String(modelIndex) : '',
              [{ id: '', label: t('taskModelsDefault') }, ...(catalog?.models.map((model, index) => ({ id: String(index), label: model.label })) ?? [])],
              next => { const model = next === '' ? null : catalog?.models[Number(next)];
                void save(task, model ? { provider: model.provider, model: model.model } : null); }, task.title),
            model && model.efforts.length > 0 && select(`${task.id}-effort`, t('taskModelsEffort'), selected?.reasoningEffort ?? '',
              [{ id: '', label: t('taskModelsEffortDefault') }, ...model.efforts],
              next => { if (selected) void save(task, { provider: selected.provider, model: selected.model, ...(next ? { reasoningEffort: next } : {}) }); }, task.title)),
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
      !loading && catalog?.tasks.length === 0 && h('p', { className: 'power-dsh-description' }, t('taskModelsEmpty')),
      h('div', { className: 'power-dsh-task-models-list' }, catalog?.tasks.map(renderTask)));
  }
  function Icon() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, 'aria-hidden': true },
      h('rect', { x: 2.5, y: 3, width: 11, height: 11, rx: 2 }), h('path', { d: 'M5 1v4m6-4v4M3 7h10M6 10l1.5 1.5L10 9' }));
  }
  preferenceSlot('taskModelsEnabled', 'settings.section', { id: 'power-dsh-task-models', order: 59, locale: namespace, label: () => t('taskModelsTitle') }, TaskModelsPage);
  preferenceSlot('taskModelsEnabled', 'settings.section.icon', { id: 'power-dsh-task-models', order: 59 }, Icon);
  return { settings: [
    { field: 'taskModelsEnabled', description: 'taskModelsDescription', save: value => env.savePreference('taskModelsEnabled', value === true) },
    { field: 'taskModelBindings', hidden: true },
  ] };
}

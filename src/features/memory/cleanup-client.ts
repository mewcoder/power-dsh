import type { ClientEnvironment, ClientRuntime, SnapshotSource } from '../../shared/client/types.ts';
import type { MemoryCleanupPreview, MemoryModel, MemoryModels, MemoryScope } from './types.ts';
import { MEMORY_ERRORS } from './types.ts';

interface ModelDirectories {
  directoryFor(id: string): { store: SnapshotSource<{ current: MemoryModel | null }>; load(): Promise<unknown> };
}

export function createCleanupDialog(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Button, Modal, Menu, NativeIcon, useMounted, useSnapshot, errorFeedback, loadingFeedback } = runtime;
  const { ctx, source } = env;
  let directories: ModelDirectories | null = null;
  let sessions: ClientEnvironment['ctx']['sessions'] | null = null;
  ctx.inject(['modelDirectories', 'sessions'], child => {
    const service: unknown = Reflect.get(child, 'modelDirectories');
    if (!service || typeof service !== 'object' || typeof Reflect.get(service, 'directoryFor') !== 'function') return;
    directories = service as ModelDirectories;
    sessions = child.sessions;
    child.effect(() => () => { directories = null; sessions = null; });
  });

  function Choice({ label, options, value, disabled, onChange }: {
    label: string; options: { id: string; label: string }[]; value: string; disabled: boolean; onChange(id: string): void;
  }) {
    const [open, setOpen] = React.useState(false);
    return h('div', { className: 'power-dsh-memory-choice' }, h('span', null, label),
      h(Menu, { open: open && !disabled, portal: true, autoFocus: true, minWidthFromAnchor: true,
        selectedId: value, items: options, onClose: () => setOpen(false),
        onSelect: id => { setOpen(false); onChange(id); },
        anchor: h(Button, { variant: 'outline', disabled, 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': open && !disabled,
          onClick: () => setOpen(previous => !previous) },
        options.find(option => option.id === value)?.label ?? label, h(NativeIcon, { glyph: 'chevron-down-outline', size: 16 })) }));
  }

  return function MemoryCleanupDialog({ scopes, initialScope, t, onClose, onApplied }: {
    scopes: MemoryScope[]; initialScope: string; t(key: string): string; onClose(): void; onApplied(): Promise<void>;
  }) {
    const settings = useSnapshot(source);
    const mounted = useMounted();
    const [scope, setScope] = React.useState(initialScope);
    const [models, setModels] = React.useState<MemoryModels | null>(null);
    const [selected, setSelected] = React.useState('');
    const [preferred, setPreferred] = React.useState<{ model: MemoryModel; current: boolean } | null>(null);
    const [busy, setBusy] = React.useState<'models' | 'generate' | 'apply' | null>('models');
    const [error, setError] = React.useState('');
    const [preview, setPreview] = React.useState<MemoryCleanupPreview | null>(null);
    const [done, setDone] = React.useState('');
    const pending = React.useRef(false);
    const token = React.useRef('');
    const sequence = React.useRef(0);
    const writable = settings.status === 'ready' && settings.writable && settings.value?.memoryEnabled === true;
    const live = (version: number) => mounted.current && version === sequence.current && source.getSnapshot().writable
      && source.getSnapshot().status === 'ready' && source.getSnapshot().value?.memoryEnabled === true;
    const fail = (failure: unknown) => {
      const text = failure instanceof Error ? failure.message : '';
      return t(MEMORY_ERRORS.find(key => text.includes(key)) ?? 'memoryCleanupFailed');
    };
    const cancel = () => {
      sequence.current++;
      if (token.current) void ctx.remote.powerDsh.cancelMemoryCleanup(token.current).catch(() => {});
      token.current = '';
    };
    const modelId = (model: MemoryModel) => JSON.stringify([model.provider, model.model]);
    async function loadModels() {
      const version = ++sequence.current;
      setBusy('models');
      setError('');
      try {
        const result = await ctx.remote.powerDsh.memoryCleanupModels();
        if (!result.ok) throw new Error(result.error.message);
        const retained = Object.entries(sessions?.list.getSnapshot().byId ?? {}).filter(([, row]) => (row?.retainedBy?.mainView ?? 0) > 0);
        let current: MemoryModel | null = null;
        if (retained.length === 1 && directories) {
          try {
            const directory = directories.directoryFor(retained[0]![0]);
            await directory.load();
            current = directory.store.getSnapshot().current;
          } catch { current = null; }
        }
        if (!live(version)) return;
        const available = (model: MemoryModel | null): model is MemoryModel => model !== null && result.value.models.some(row => modelId(row) === modelId(model));
        const choice = available(current) ? current : result.value.default;
        setModels(result.value);
        setPreferred(choice ? { model: choice, current: available(current) } : null);
        setSelected(choice ? modelId(choice) : result.value.models[0] ? modelId(result.value.models[0]) : '');
      } catch (failure) { if (live(version)) setError(fail(failure)); }
      finally { if (live(version)) setBusy(null); }
    }
    React.useEffect(() => { void loadModels(); return cancel; }, []);
    React.useEffect(() => { if (!writable) { cancel(); onClose(); } }, [writable]);

    async function generate() {
      if (!writable || pending.current || !selected) return;
      const selectedModel = models?.models.find(row => modelId(row) === selected);
      if (!selectedModel) return;
      pending.current = true;
      cancel();
      const version = sequence.current;
      setBusy('generate');
      setError('');
      setPreview(null);
      setDone('');
      const model = preferred && modelId(preferred.model) === selected ? preferred.model : selectedModel;
      try {
        const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
        const id = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
        token.current = id;
        const result = await ctx.remote.powerDsh.prepareMemoryCleanup(scope, JSON.stringify(model), id);
        if (!live(version)) return;
        if (!result.ok) throw new Error(result.error.message);
        setPreview(result.value);
      } catch (failure) { if (live(version)) setError(fail(failure)); }
      finally {
        pending.current = false;
        if (live(version)) setBusy(null);
      }
    }
    async function apply() {
      if (!writable || pending.current || !preview?.changes.length) return;
      pending.current = true;
      const version = sequence.current;
      setBusy('apply');
      setError('');
      try {
        const result = await ctx.remote.powerDsh.applyMemoryCleanup(preview.token);
        if (!live(version)) return;
        if (!result.ok) throw new Error(result.error.message);
        token.current = '';
        setPreview(null);
        setDone(t('memoryCleanupDone').replace('{path}', () => result.value.backup));
        if (!result.value.indexUpdated) setError(t('memoryIndexStale'));
        await onApplied();
      } catch (failure) {
        if (live(version)) { setError(fail(failure)); setPreview(null); }
      } finally { pending.current = false; if (live(version)) setBusy(null); }
    }
    const scopeOptions = scopes.filter(row => row.complete && row.entries.length > 0 && row.entries.every(entry => !entry.invalid)).map(row => ({ id: row.id,
      label: row.id === 'global' ? t('memoryGlobalEnabled') : row.cwd.split(/[\\/]/).filter(Boolean).at(-1) || row.cwd }));
    const modelOptions = models?.models.map(model => ({ id: modelId(model), label: preferred && modelId(preferred.model) === modelId(model)
      ? `${t(preferred.current ? 'memoryCurrentModel' : 'memoryDefaultModel')} · ${model.label}` : model.label })) ?? [];
    const reset = () => { cancel(); setPreview(null); setDone(''); setError(''); };
    const plain = (text: string) => h('pre', { className: 'power-dsh-memory-cleanup-text' }, text);
    return h(Modal, { open: true, className: 'power-dsh-memory-detail', title: t('memoryCleanup'), closeLabel: t('close'),
      description: t('memoryCleanupDescription'), onClose: () => { cancel(); onClose(); },
      footer: h(React.Fragment, null,
        h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: () => { cancel(); onClose(); } }, t('cancel')),
        h(Button, { variant: 'outline', disabled: !writable || busy !== null || !selected || !scopeOptions.some(option => option.id === scope) || preview !== null && !preview.changes.length,
          onClick: preview?.changes.length ? apply : generate }, t(preview?.changes.length ? 'memoryCleanupApply' : 'memoryCleanupGenerate'))) },
    h('div', { className: 'power-dsh-memory-detail-body', tabIndex: 0 },
      h(Choice, { label: t('memoryCleanupScope'), value: scope, options: scopeOptions, disabled: busy !== null || !writable,
        onChange: id => { reset(); setScope(id); } }),
      h(Choice, { label: t('memoryCleanupModel'), value: selected, options: modelOptions, disabled: busy !== null || !writable,
        onChange: id => { reset(); setSelected(id); } }),
      busy && loadingFeedback({ label: t(busy === 'generate' ? 'memoryCleanupGenerating' : busy === 'apply' ? 'memoryCleanupApplying' : 'loading') }),
      error && errorFeedback({ t, message: error, code: 'PD-MEMORY-CLEANUP', operation: 'memoryCleanup', placement: 'modal',
        ...(models === null ? { retry: loadModels } : {}) }),
      done && h('p', { role: 'status', className: 'power-dsh-memory-meta' }, done),
      preview?.changes.length === 0 && h('p', { role: 'status' }, t('memoryCleanupUnchanged')),
      preview?.changes.map(change => h('section', { className: 'power-dsh-memory-cleanup-change', key: change.before.id },
        h('strong', null, `${change.before.name}.md`), h('p', { className: 'power-dsh-description' }, change.reason),
        h('div', null, h('h3', null, t('memoryCleanupBefore')), plain(`${change.before.description}\n\n${change.before.content}`)),
        ...change.removed.map(entry => h('div', { key: entry.id }, h('h3', { className: 'power-dsh-memory-cleanup-remove' },
          `${t('memoryCleanupRemove')} · ${entry.name}.md`), plain(`${entry.description}\n\n${entry.content}`))),
        h('div', null, h('h3', null, t('memoryCleanupAfter')), plain(`${change.description}\n\n${change.content}`))))));
  };
}

import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FormSnapshot, SettingsViewContext, SnapshotSource } from '../../shared/client/types.ts';
import { styles as feedbackStyles } from '../../shared/client/error-feedback.ts';
import { watchBackground } from './attachment.ts';
import type { AttachmentFailure } from './attachment.ts';
import { presentFailure, sameFailure } from './diagnostics.ts';
import { panelStyles, settingsStyles } from './styles.ts';
import type { WallpaperAsset } from './rpc.ts';

const KINDS = ['pattern', 'wallpaper'] as const;
type BackgroundKind = typeof KINDS[number];
const MAX_WALLPAPER_BYTES = 25 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'] as const;

function resolveKind(value: unknown): BackgroundKind {
  return value === 'wallpaper' ? 'wallpaper' : 'pattern';
}
/** Clamp a numeric preference, falling back when it is missing or malformed. */
function resolveNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
/** Keeps the lifecycle controller renderable in environments without a live form source. */
const EMPTY_SNAPSHOT: FormSnapshot = { status: 'ready', writable: false, value: {} };
const EMPTY_SOURCE: SnapshotSource<FormSnapshot> = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY_SNAPSHOT,
};

/** Read a picked image as a data URL without leaving the renderer. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/.test(result)) resolve(result);
      else reject(new Error('read failed'));
    };
    reader.readAsDataURL(file);
  });
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, Button, Tooltip, observable, useSnapshot, errorFeedback } = runtime;
  const { ctx, t, source } = env;
  let fault: { issue: AttachmentFailure; observedAt: string } | null = null;
  const attachment = observable(() => fault);
  // The wallpaper binary belongs to the Host profile; the Client only mirrors
  // the loaded asset so the settings row and the layer share one source.
  let wallpaper: { status: 'idle' | 'loading' | 'ready' | 'error'; value: WallpaperAsset | null; error: string } =
    { status: 'idle', value: null, error: '' };
  const wallpaperSource = observable(() => wallpaper);
  let generation = 0;
  let active = true;
  // Structural harnesses without a live context still render the controller.
  ctx?.effect?.(() => () => { active = false; generation++; });
  const publishWallpaper = (patch: Partial<typeof wallpaper>) => {
    wallpaper = { ...wallpaper, ...patch };
    wallpaperSource.notify();
  };
  const loadWallpaper = async () => {
    const current = ++generation;
    if (wallpaper.status !== 'ready') publishWallpaper({ status: 'loading', error: '' });
    try {
      const reply = await ctx.remote.powerDsh.readWallpaper();
      if (!active || current !== generation) return;
      if (!reply.ok) throw new Error(reply.error.message);
      publishWallpaper({ status: 'ready', value: reply.value, error: '' });
    } catch (failure) {
      if (!active || current !== generation) return;
      publishWallpaper({ status: 'error', error: errorMessage(failure) || t('flowingBackgroundWallpaperReadFailed') });
    }
  };
  const saveWallpaper = async (dataUrl: string, name: string) => {
    const current = ++generation;
    const reply = await ctx.remote.powerDsh.saveWallpaper(dataUrl, name);
    if (!active || current !== generation) return;
    if (!reply.ok) throw new Error(reply.error.message || t('flowingBackgroundWallpaperSaveFailed'));
    publishWallpaper({ status: 'ready', value: reply.value, error: '' });
  };
  const clearWallpaper = async () => {
    const current = ++generation;
    const reply = await ctx.remote.powerDsh.clearWallpaper();
    if (!active || current !== generation) return;
    if (!reply.ok) throw new Error(reply.error.message || t('flowingBackgroundWallpaperSaveFailed'));
    publishWallpaper({ status: 'ready', value: null, error: '' });
  };
  // The layer needs the asset as soon as the preference selects a wallpaper, not
  // only while the settings page happens to be open.
  ctx?.effect?.(() => {
    const sync = () => {
      const snapshot = source.getSnapshot();
      if (snapshot.status !== 'ready') return;
      if (snapshot.value?.flowingBackgroundEnabled !== true) return;
      if (resolveKind(snapshot.value?.flowingBackgroundKind) !== 'wallpaper') return;
      if (wallpaper.status === 'idle') void loadWallpaper();
    };
    sync();
    return source.subscribe(sync);
  });

  const readStyle = (snapshot: FormSnapshot) => ({
    kind: resolveKind(snapshot.value?.flowingBackgroundKind),
    opacity: resolveNumber(snapshot.value?.flowingBackgroundOpacity, 100, 0, 100),
    blur: resolveNumber(snapshot.value?.flowingBackgroundBlur, 0, 0, 40),
  });

  function BackgroundController() {
    const snapshot = useSnapshot(source ?? EMPTY_SOURCE);
    const asset = useSnapshot(wallpaperSource);
    const { kind } = readStyle(snapshot);
    const dataUrl = kind === 'wallpaper' ? asset.value?.dataUrl : undefined;
    const name = kind === 'wallpaper' ? asset.value?.name : undefined;
    // Only the artwork identity re-attaches; opacity and blur are read live so the
    // homepage preview panel can drag them without rebuilding the layer or GPU chain.
    React.useLayoutEffect(() => {
      let firstReport = true;
      const read = () => {
        const current = readStyle(source?.getSnapshot() ?? EMPTY_SOURCE.getSnapshot());
        return { opacity: panelState.open ? panelState.opacity : current.opacity,
          blur: panelState.open ? panelState.blur : current.blur,
          wallpaper: dataUrl ? { dataUrl, name: name ?? '' } : null };
      };
      return watchBackground(status => {
        if (status.state === 'attached') {
          if (fault) { fault = null; attachment.notify(); }
        } else if (firstReport || !fault || !sameFailure(fault.issue, status)) {
          fault = { issue: status, observedAt: new Date().toISOString() };
          attachment.notify();
        }
        firstReport = false;
      }, undefined, undefined, undefined, read(), read, listener => {
        const offForm = (source ?? EMPTY_SOURCE).subscribe(listener);
        const offPanel = panelStore.subscribe(listener);
        return () => { offForm(); offPanel(); };
      });
    }, [dataUrl, name]);
    return null;
  }
  function Background() {
    return h(BackgroundController);
  }
  env.preferenceSlot('flowingBackgroundEnabled', 'shell.overlay', {
    id: 'power-dsh-flowing-background', order: -100, locale: env.namespace,
  }, Background);

  let panelState = { open: false, opacity: 100, blur: 0, saving: false, error: '' };
  const panelStore = observable(() => panelState);
  const publishPanel = (patch: Partial<typeof panelState>) => {
    if (Object.entries(patch).every(([key, value]) => panelState[key as keyof typeof panelState] === value)) return;
    panelState = { ...panelState, ...patch };
    panelStore.notify();
  };
  const openPanel = (leave: (() => void) | undefined) => {
    const snapshot = source.getSnapshot();
    if (!leave || panelState.open || snapshot.status !== 'ready' || !snapshot.writable) return;
    const { kind, opacity, blur } = readStyle(snapshot);
    publishPanel({ open: true, opacity, blur, saving: false, error: '' });
    leave();
    if (kind === 'wallpaper' && wallpaper.status === 'idle') void loadWallpaper();
  };
  const finishPanel = () => publishPanel({ open: false, error: '' });
  const savePanel = async (): Promise<boolean> => {
    if (!active || !panelState.open || panelState.saving) return false;
    const snapshot = source.getSnapshot();
    if (snapshot.status !== 'ready' || !snapshot.writable) return false;
    const { opacity, blur } = panelState;
    publishPanel({ saving: true, error: '' });
    try {
      const saved = readStyle(source.getSnapshot());
      if (opacity !== saved.opacity) await env.savePreference('flowingBackgroundOpacity', opacity, undefined, 'number');
      if (blur !== saved.blur) await env.savePreference('flowingBackgroundBlur', blur, undefined, 'number');
      return true;
    } catch (failure) {
      if (active) publishPanel({ ...readStyle(source.getSnapshot()),
        error: errorMessage(failure) || t('saveFailed') });
      return false;
    } finally {
      if (active) publishPanel({ saving: false });
    }
  };
  let panelCommit: Promise<boolean> | undefined;
  const commitPanel = () => {
    if (panelCommit) return panelCommit;
    const task = savePanel();
    panelCommit = task;
    void task.then(() => { if (panelCommit === task) panelCommit = undefined; });
    return task;
  };
  const closePanel = async () => {
    if (pickingState.picking) return;
    if (await commitPanel()) finishPanel();
  };

  ctx?.effect?.(() => {
    const off = source.subscribe(() => {
      const snapshot = source.getSnapshot();
      if (panelState.open && (snapshot.status !== 'ready' || !snapshot.writable || snapshot.value?.flowingBackgroundEnabled !== true)) finishPanel();
    });
    return () => { off(); if (panelState.open) finishPanel(); };
  });

  function TuningPanel() {
    const state = useSnapshot(panelStore);
    const asset = useSnapshot(wallpaperSource);
    const operation = useSnapshot(pickingStore);
    const snapshot = useSnapshot(source);
    const { kind } = readStyle(snapshot);
    const title = t(kind === 'wallpaper' ? 'flowingBackgroundTuneWallpaperTitle' : 'flowingBackgroundTunePatternTitle');
    if (!state.open) return null;
    return h('div', { className: 'power-dsh-background-panel', role: 'dialog', 'aria-label': title,
      'aria-busy': state.saving,
      onKeyDown: (event: import('react').KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void closePanel(); }
      } },
      h('style', null, settingsStyles + panelStyles + feedbackStyles),
      h('div', { className: 'power-dsh-background-panel-material', 'aria-hidden': true }),
      h('div', { className: 'power-dsh-background-panel-head' },
        h('h2', { className: 'power-dsh-background-panel-title' }, title),
        h(Button, {
          type: 'button', variant: 'ghost', size: 'sm', className: 'power-dsh-background-panel-close',
          'aria-label': t('flowingBackgroundTuneDone'), title: t('flowingBackgroundTuneDone'),
          disabled: state.saving || operation.picking, onClick: closePanel,
        }, h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true, focusable: false },
          h('path', { d: 'm3 3 8 8M11 3l-8 8' })))),
      h('div', { className: 'power-dsh-background-panel-body' },
      panelSlider('flowingBackgroundOpacity', 'flowingBackgroundOpacity', 100 - state.opacity, 0, 100, 5, '%'),
      panelSlider('flowingBackgroundBlur', 'flowingBackgroundBlur', state.blur, 0, 40, 4, 'px'),
      kind === 'wallpaper' && wallpaperRow(asset, operation, state.saving),
      state.error && errorFeedback({ t, message: state.error, code: 'PD-BACKGROUND-STYLE-SAVE',
        operation: 'background.tune', retry: async () => { await commitPanel(); } })));
  }
  function panelSlider(field: 'flowingBackgroundOpacity' | 'flowingBackgroundBlur', labelKey: string,
    value: number, min: number, max: number, step: number, unit: string) {
    const control = `power-dsh-tune-${field}`;
    return h('div', { className: 'power-dsh-background-panel-slider', key: field },
      h('div', { className: 'power-dsh-background-panel-row' },
        h('label', { htmlFor: control, className: 'power-dsh-background-panel-label' }, t(labelKey)),
        h('span', { className: 'power-dsh-background-panel-value' }, `${value}${unit}`)),
      h('input', {
        key: field, id: control, type: 'range', className: 'power-dsh-slider',
        min, max, step, value, disabled: panelState.saving,
        'aria-label': t(labelKey), 'aria-valuetext': `${value}${unit}`,
        onChange: (event: import('react').ChangeEvent<HTMLInputElement>) => {
          if (!panelState.open || panelState.saving) return;
          const next = Math.min(max, Math.max(min, Number(event.currentTarget.value)));
          // Keep persisted CSS opacity compatible; expose its inverse as transparency.
          if (Number.isFinite(next)) publishPanel(field === 'flowingBackgroundOpacity' ? { opacity: 100 - next } : { blur: next });
        },
        onPointerUp: () => commitPanel(),
        onKeyUp: (event: import('react').KeyboardEvent<HTMLInputElement>) => {
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return commitPanel();
        },
        onBlur: () => commitPanel(),
      }));
  }
  // Frame-wide, click-through overlay; the panel itself opts back into pointer events.
  ctx?.slots?.inject?.('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'power-dsh-background-tune', order: -99, locale: env.namespace,
  }, TuningPanel));

  // Menu open state is feature-scoped so the row can be a plain render function.
  let menuOpen = false;
  const menuStore = observable(() => menuOpen);
  const setMenu = (next: boolean) => { if (menuOpen !== next) { menuOpen = next; menuStore.notify(); } };
  // Wallpaper row state is feature-scoped for the same reason: the settings row
  // is authored as a plain render function, not a component with hooks.
  // The snapshot object is replaced, never rebuilt per call: useSyncExternalStore
  // compares snapshots by identity and would loop forever on a fresh object.
  let pickingState: { picking: boolean; error: string } = { picking: false, error: '' };
  const pickingStore = observable(() => pickingState);
  const publishPicking = (patch: Partial<typeof pickingState>) => {
    if (patch.picking === pickingState.picking && patch.error === pickingState.error) return;
    pickingState = { ...pickingState, ...patch };
    pickingStore.notify();
  };
  const setPicking = (next: boolean) => publishPicking({ picking: next });
  const setWallpaperError = (message: string) => publishPicking({ error: message });
  let fileInput: HTMLInputElement | null = null;
  const kindLabel = (kind: BackgroundKind) =>
    t(kind === 'wallpaper' ? 'flowingBackgroundKindWallpaper' : 'flowingBackgroundKindPattern');

  const mainSetting = { field: 'flowingBackgroundEnabled', description: 'flowingBackgroundDescription' } as const;
  const kindSetting = {
    field: 'flowingBackgroundKind', description: 'flowingBackgroundKindDescription', hidden: true,
    save: async (next: unknown) => {
      if (next !== 'pattern' && next !== 'wallpaper') throw new Error(t('saveFailed'));
      try {
        await env.savePreference('flowingBackgroundKind', next, undefined, 'string');
        if (next === 'pattern') {
          const saved = readStyle(source.getSnapshot());
          if (saved.opacity !== 100) await env.savePreference('flowingBackgroundOpacity', 100, undefined, 'number');
          if (saved.blur !== 0) await env.savePreference('flowingBackgroundBlur', 0, undefined, 'number');
        }
      } finally {
        if (active && panelState.open) {
          const { opacity, blur } = readStyle(source.getSnapshot());
          publishPanel({ opacity, blur });
        }
      }
    },
  } as const;
  const opacitySetting = { field: 'flowingBackgroundOpacity', description: 'flowingBackgroundOpacityDescription', hidden: true } as const;
  const blurSetting = { field: 'flowingBackgroundBlur', description: 'flowingBackgroundBlurDescription', hidden: true } as const;

  const canEditWallpaper = () => {
    const snapshot = source.getSnapshot();
    return active && panelState.open && snapshot.status === 'ready' && snapshot.writable
      && snapshot.value?.flowingBackgroundEnabled === true && readStyle(snapshot).kind === 'wallpaper';
  };
  function wallpaperRow(asset: typeof wallpaper, operation: typeof pickingState, disabled: boolean) {
    const control = 'power-dsh-tune-wallpaper';
    const busy = operation.picking || asset.status === 'loading';
    const failure = operation.error || asset.error;
    const choose = () => { if (!disabled && !busy && canEditWallpaper()) fileInput?.click(); };
    async function picked(event: import('react').ChangeEvent<HTMLInputElement>) {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = '';
      if (!file || disabled || !canEditWallpaper() || pickingState.picking) return;
      setWallpaperError('');
      if (!(ACCEPTED as readonly string[]).includes(file.type)) { setWallpaperError(t('flowingBackgroundWallpaperUnsupported')); return; }
      if (file.size > MAX_WALLPAPER_BYTES) { setWallpaperError(t('flowingBackgroundWallpaperTooLarge')); return; }
      setPicking(true);
      try {
        const dataUrl = await readImage(file);
        if (!canEditWallpaper()) return;
        await saveWallpaper(dataUrl, file.name);
      } catch (failure) {
        setWallpaperError(errorMessage(failure) || t('flowingBackgroundWallpaperSaveFailed'));
      } finally {
        setPicking(false);
      }
    }
    async function remove() {
      if (disabled || busy || !canEditWallpaper()) return;
      setWallpaperError('');
      setPicking(true);
      try { await clearWallpaper(); }
      catch (failure) { setWallpaperError(errorMessage(failure) || t('flowingBackgroundWallpaperSaveFailed')); }
      finally { setPicking(false); }
    }
    return h('div', { className: 'power-dsh-setting-row', key: 'flowingBackgroundWallpaper' },
      h('div', { className: 'power-dsh-setting-copy' },
        h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t('flowingBackgroundWallpaper')),
        h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t('flowingBackgroundWallpaperDescription')),
        failure && errorFeedback({ t, id: `${control}-error`, message: failure,
          code: 'PD-BACKGROUND-WALLPAPER', operation: 'saveWallpaper',
          retry: asset.status === 'error' ? loadWallpaper : undefined })),
      h('div', { className: 'power-dsh-wallpaper-field' },
        h('div', { className: 'power-dsh-wallpaper-details' },
        asset.value && h('img', {
          className: 'power-dsh-wallpaper-preview', src: asset.value.dataUrl, alt: '',
          'aria-hidden': true, draggable: false,
        }),
        h('span', { className: 'power-dsh-wallpaper-name', title: asset.value?.name },
          asset.value ? asset.value.name : t('flowingBackgroundWallpaperEmpty'))),
        h('div', { className: 'power-dsh-wallpaper-actions', role: 'group', 'aria-labelledby': `${control}-label` },
        h(Button, {
          type: 'button', variant: 'outline', size: 'sm', className: 'power-dsh-wallpaper-action', disabled: disabled || busy,
          'aria-describedby': `${control}-description${failure ? ` ${control}-error` : ''}`,
          'aria-busy': busy, onClick: choose,
        }, t(asset.value ? 'flowingBackgroundWallpaperReplace' : 'flowingBackgroundWallpaperChoose')),
        asset.value && h(Button, {
          type: 'button', variant: 'outline', size: 'sm', className: 'power-dsh-wallpaper-action', disabled: disabled || busy,
          onClick: remove,
        }, t('flowingBackgroundWallpaperRemove'))),
        h('input', {
          ref: (element: HTMLInputElement | null) => { fileInput = element; },
          type: 'file', className: 'power-dsh-wallpaper-input', tabIndex: -1,
          accept: ACCEPTED.join(','), 'aria-hidden': true, disabled: disabled || busy, onChange: picked,
        })));
  }

  function useSettings({ snapshot, disabled, saving, error, save, id, leaveSettings }: SettingsViewContext) {
    const failed = useSnapshot(attachment);
    const opened = useSnapshot(menuStore);
    const tuneState = useSnapshot(panelStore);
    const openedTune = tuneState.open;
    const enabled = snapshot.value?.flowingBackgroundEnabled === true;
    const { kind } = readStyle(snapshot);
    const main = !failed || !enabled ? mainSetting
      : { ...mainSetting, failure: presentFailure(failed.issue, failed.observedAt, t) };

    function kindRow() {
      if (!enabled) return null;
      const field = 'flowingBackgroundKind';
      const control = `${id}-${field}`;
      const busy = saving?.field === field;
      const fieldError = error?.field === field ? error.message : '';
      const adjustment = h(Tooltip, { label: t('flowingBackgroundTuneOpen'), side: 'top', portal: true },
        h(Button, {
          type: 'button', variant: 'ghost', size: 'sm', className: 'power-dsh-background-tune-trigger',
          id: `${id}-flowingBackgroundTune`, disabled: disabled || !leaveSettings,
          'aria-label': t('flowingBackgroundTuneOpen'),
          'aria-haspopup': 'dialog', 'aria-expanded': openedTune,
          onClick: () => { if (!disabled) { setMenu(false); openPanel(leaveSettings); } },
        }, h('svg', {
          width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true, focusable: false,
        }, h('path', { d: 'M2 4h3m4 0h5M2 12h5m4 0h3' }),
        h('circle', { cx: 7, cy: 4, r: 2 }), h('circle', { cx: 9, cy: 12, r: 2 }))));
      const selector = h(Menu, {
        open: opened && !disabled, onClose: () => setMenu(false), selectedId: kind,
        align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
        items: KINDS.map(item => ({ id: item, label: kindLabel(item) })),
        onSelect: next => { setMenu(false); return save(field, next); },
        anchor: h(Button, {
          type: 'button', variant: 'ghost', size: 'md',
          className: 'power-dsh-background-style-select', disabled: disabled || busy,
          'aria-label': t('flowingBackgroundKind'), 'aria-describedby': `${control}-description${fieldError ? ` ${control}-error` : ''}`,
          'aria-invalid': Boolean(fieldError),
          'aria-haspopup': 'menu', 'aria-expanded': opened && !disabled, 'aria-busy': busy,
          onClick: () => { if (!disabled) setMenu(!opened); },
        }, kindLabel(kind), h('svg', {
          width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
          strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
        }, h('path', { d: 'm4 6 4 4 4-4' }))),
      });
      return h('div', { className: 'power-dsh-setting-row', key: field },
        h('div', { className: 'power-dsh-setting-copy' },
          h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t('flowingBackgroundKind')),
          h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t('flowingBackgroundKindDescription')),
          fieldError && errorFeedback({ t, id: `${control}-error`, message: fieldError,
            code: 'PD-BACKGROUND-KIND-SAVE', operation: `settings.${field}` })),
        h('div', { className: 'power-dsh-background-controls' }, adjustment, selector));
    }

    return [
      main,
      { ...kindSetting, hidden: false, render: kindRow },
    ];
  }

  return {
    settings: [mainSetting, kindSetting, opacitySetting, blurSetting],
    useSettings,
    styles: settingsStyles + panelStyles,
    api: { wallpaperSource, loadWallpaper, saveWallpaper, clearWallpaper },
  } satisfies ClientFeature;
}

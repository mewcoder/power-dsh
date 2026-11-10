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
  const { React, h, Button, Tooltip, observable, useSnapshot, errorFeedback } = runtime;
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

  let panelState = { open: false, kind: 'pattern' as BackgroundKind, opacity: 100, blur: 0, saving: false, error: '' };
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
    publishPanel({ open: true, kind, opacity, blur, saving: false, error: '' });
    leave();
    if (kind === 'wallpaper' && wallpaper.status === 'idle') void loadWallpaper();
  };
  const finishPanel = () => publishPanel({ open: false, error: '' });
  const savePanel = async (): Promise<boolean> => {
    if (!active || !panelState.open || panelState.saving) return false;
    const snapshot = source.getSnapshot();
    if (snapshot.status !== 'ready' || !snapshot.writable) return false;
    const { kind, opacity, blur } = panelState;
    publishPanel({ saving: true, error: '' });
    try {
      const saved = readStyle(source.getSnapshot());
      // Type first: the appearance below applies to whichever background is now
      // selected, so the built-in flow is tunable too.
      if (kind !== saved.kind) await env.savePreference('flowingBackgroundKind', kind, undefined, 'string');
      const after = readStyle(source.getSnapshot());
      if (opacity !== after.opacity) await env.savePreference('flowingBackgroundOpacity', opacity, undefined, 'number');
      if (blur !== after.blur) await env.savePreference('flowingBackgroundBlur', blur, undefined, 'number');
      return true;
    } catch (failure) {
      if (active) {
        const restored = readStyle(source.getSnapshot());
        publishPanel({ kind: restored.kind, opacity: restored.opacity, blur: restored.blur,
          error: errorMessage(failure) || t('saveFailed') });
      }
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
    const title = t('flowingBackgroundTuneTitle');
    if (!state.open) return null;
    const wallpaper = state.kind === 'wallpaper';
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
      // 1. Background type first: everything below depends on this choice.
      kindChoice(state.kind, state.saving || operation.picking),
      // 2. Wallpaper picking lives here rather than in a separate settings row.
      wallpaper && wallpaperRow(asset, operation, state.saving),
      // 3. Appearance tuning, only meaningful once a background exists.
      h('div', { className: 'power-dsh-background-panel-section' },
        h('div', { className: 'power-dsh-background-panel-section-title' }, t('flowingBackgroundTuneAppearance')),
        panelSlider('flowingBackgroundOpacity', 'flowingBackgroundOpacity', state.opacity, 0, 100, 5, '%',
          'flowingBackgroundOpacityDescription'),
        panelSlider('flowingBackgroundBlur', 'flowingBackgroundBlur', state.blur, 0, 40, 1, 'px',
          'flowingBackgroundBlurDescription')),
      state.error && errorFeedback({ t, message: state.error, code: 'PD-BACKGROUND-STYLE-SAVE',
        operation: 'background.tune', retry: async () => { await commitPanel(); } })));
  }

  /**
   * Background type as two radios in the panel. Choosing a type only previews;
   * the panel saves it on close. Arrow keys move between the two options, which
   * is what a native radio group does.
   */
  function kindChoice(current: BackgroundKind, disabled: boolean) {
    const control = 'power-dsh-background-kind';
    const choose = (next: BackgroundKind) => {
      if (disabled || !panelState.open || panelState.saving || panelState.kind === next) return;
      publishPanel({ kind: next });
      // Loading the asset is a preview concern: switching types must not write.
      if (next === 'wallpaper' && wallpaper.status === 'idle') void loadWallpaper();
    };
    return h('fieldset', { className: 'power-dsh-background-panel-section power-dsh-background-kind' },
      h('legend', { className: 'power-dsh-background-panel-section-title' }, t('flowingBackgroundKind')),
      ...KINDS.map(kind => h('label', {
        key: kind, className: 'power-dsh-background-radio',
      },
        h('input', {
          type: 'radio', name: control, value: kind, id: `${control}-${kind}`,
          checked: current === kind, disabled,
          onChange: () => choose(kind),
        }),
        h('span', { className: 'power-dsh-background-radio-label' }, kindLabel(kind)))));
  }

  /**
   * One labelled slider. The control is a native `range`, so arrows, Home/End and
   * Page Up/Down all work; it stays enabled while a save is in flight and only
   * blocks new writes, so dragging never loses focus or the keyboard.
   */
  function panelSlider(field: 'flowingBackgroundOpacity' | 'flowingBackgroundBlur', labelKey: string,
    value: number, min: number, max: number, step: number, unit: string, descriptionKey: string) {
    const control = `power-dsh-tune-${field}`;
    const description = `${control}-description`;
    return h('div', { className: 'power-dsh-background-panel-slider', key: field },
      h('div', { className: 'power-dsh-background-panel-row' },
        h('label', { htmlFor: control, className: 'power-dsh-background-panel-label' }, t(labelKey)),
        h('span', { className: 'power-dsh-background-panel-value', 'aria-hidden': true }, `${value}${unit}`)),
      h('input', {
        id: control, type: 'range', className: 'power-dsh-slider',
        min, max, step, value,
        'aria-label': t(labelKey), 'aria-describedby': description, 'aria-valuetext': `${value}${unit}`,
        onChange: (event: import('react').ChangeEvent<HTMLInputElement>) => {
          if (!panelState.open) return;
          const next = Math.min(max, Math.max(min, Number(event.currentTarget.value)));
          if (Number.isFinite(next)) publishPanel(field === 'flowingBackgroundOpacity' ? { opacity: next } : { blur: next });
        },
        // Commit when the gesture ends or focus leaves, never on every key repeat.
        onPointerUp: () => commitPanel(),
        onKeyUp: (event: import('react').KeyboardEvent<HTMLInputElement>) => {
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return commitPanel();
        },
        onBlur: () => commitPanel(),
      }),
      h('p', { id: description, className: 'power-dsh-background-panel-hint' }, t(descriptionKey)));
  }
  // Frame-wide, click-through overlay; the panel itself opts back into pointer events.
  ctx?.slots?.inject?.('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'power-dsh-background-tune', order: -99, locale: env.namespace,
  }, TuningPanel));

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
  // The panel owns the type, opacity and blur writes; these rows stay hidden so the
  // feature still owns every key it persists.
  const kindSetting = { field: 'flowingBackgroundKind', description: 'flowingBackgroundKindDescription', hidden: true } as const;
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
    // One row: thumbnail, name and a small caption on the left; compact icon
    // actions on the right. The format hint is a caption, never a heading.
    return h('div', { className: 'power-dsh-wallpaper-row', key: 'flowingBackgroundWallpaper' },
      h('div', { className: 'power-dsh-wallpaper-details' },
        h('span', { className: 'power-dsh-wallpaper-thumb', 'aria-hidden': true },
          asset.value && h('img', {
            className: 'power-dsh-wallpaper-preview', src: asset.value.dataUrl, alt: '', draggable: false,
          })),
        h('span', { className: 'power-dsh-wallpaper-copy' },
          h('span', { id: `${control}-label`, className: 'power-dsh-wallpaper-name', title: asset.value?.name },
            asset.value ? asset.value.name : t('flowingBackgroundWallpaperEmpty')),
          h('span', { id: `${control}-description`, className: 'power-dsh-wallpaper-hint' },
            t('flowingBackgroundWallpaperDescription')))),
      h('div', { className: 'power-dsh-wallpaper-actions', role: 'group', 'aria-labelledby': `${control}-label` },
        h(Tooltip, { label: t(asset.value ? 'flowingBackgroundWallpaperReplace' : 'flowingBackgroundWallpaperChoose'), side: 'top', portal: true },
          h(Button, {
            type: 'button', variant: 'ghost', size: 'sm', className: 'power-dsh-wallpaper-icon', disabled: disabled || busy,
            'aria-label': t(asset.value ? 'flowingBackgroundWallpaperReplace' : 'flowingBackgroundWallpaperChoose'),
            'aria-describedby': `${control}-description${failure ? ` ${control}-error` : ''}`,
            'aria-busy': busy, onClick: choose,
          }, h('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
            strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
            h('path', { d: 'M2.5 11.5V13h1.5l7-7-1.5-1.5-7 7Z' }),
            h('path', { d: 'M11.5 3.5 12 3a1.06 1.06 0 0 1 1.5 1.5l-.5.5-1.5-1.5Z' })))),
        asset.value && h(Tooltip, { label: t('flowingBackgroundWallpaperRemove'), side: 'top', portal: true },
          h(Button, {
            type: 'button', variant: 'ghost', size: 'sm', className: 'power-dsh-wallpaper-icon is-danger',
            'aria-label': t('flowingBackgroundWallpaperRemove'),
            disabled: disabled || busy, onClick: remove,
          }, h('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
            strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
            h('path', { d: 'M2.5 4h11M6 4V2.5h4V4M4 4l.6 9a1 1 0 0 0 1 1h4.8a1 1 0 0 0 1-1L12 4' })))),
        h('input', {
          ref: (element: HTMLInputElement | null) => { fileInput = element; },
          type: 'file', className: 'power-dsh-wallpaper-input', tabIndex: -1,
          accept: ACCEPTED.join(','), 'aria-hidden': true, disabled: disabled || busy, onChange: picked,
        })),
      failure && errorFeedback({ t, id: `${control}-error`, message: failure,
        code: 'PD-BACKGROUND-WALLPAPER', operation: 'saveWallpaper',
        retry: asset.status === 'error' ? loadWallpaper : undefined }));
  }

  function useSettings({ snapshot, disabled, saving, error, save, id, leaveSettings }: SettingsViewContext) {
    const failed = useSnapshot(attachment);
    const tuneState = useSnapshot(panelStore);
    const openedTune = tuneState.open;
    const enabled = snapshot.value?.flowingBackgroundEnabled === true;
    const main = !failed || !enabled ? mainSetting
      : { ...mainSetting, failure: presentFailure(failed.issue, failed.observedAt, t) };
    const failure = 'failure' in main ? main.failure : undefined;

    /**
     * The adjustment entry sits on the main row itself: there is no separate
     * "background type" row any more, because the panel owns that choice.
     */
    function mainRow() {
      const control = `${id}-flowingBackgroundEnabled`;
      return h('div', { className: 'power-dsh-setting-row', key: 'flowingBackgroundMain' },
        h('div', { className: 'power-dsh-setting-copy' },
          h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t('flowingBackgroundEnabled')),
          h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t('flowingBackgroundDescription')),
          failure && errorFeedback({ t, id: `${control}-error`, message: failure.message,
            code: failure.code, operation: failure.operation,
            context: failure.context, observedAt: failure.observedAt })),
        h('div', { className: 'power-dsh-background-controls' },
          // The adjustment entry only exists once a background is chosen; the
          // switch itself must always stay reachable.
          enabled && h(Tooltip, { label: t('flowingBackgroundTuneOpen'), side: 'top', portal: true },
            h(Button, {
              type: 'button', variant: 'ghost', size: 'sm', className: 'power-dsh-background-tune-trigger',
              id: `${id}-flowingBackgroundTune`, disabled: disabled || !leaveSettings,
              'aria-label': t('flowingBackgroundTuneOpen'), 'aria-describedby': `${control}-description`,
              'aria-haspopup': 'dialog', 'aria-expanded': openedTune,
              onClick: () => { if (!disabled) openPanel(leaveSettings); },
            }, h('svg', {
              width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
              strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true, focusable: false,
            }, h('path', { d: 'M2 4h3m4 0h5M2 12h5m4 0h3' }),
            h('circle', { cx: 7, cy: 4, r: 2 }), h('circle', { cx: 9, cy: 12, r: 2 })))),
          h('button', {
            type: 'button', role: 'switch', className: 'power-dsh-switch', id: control,
            'aria-checked': enabled, 'aria-labelledby': `${control}-label`,
            'aria-describedby': `${control}-description`, 'aria-busy': saving?.field === 'flowingBackgroundEnabled',
            disabled: disabled || saving?.field === 'flowingBackgroundEnabled',
            onClick: () => save('flowingBackgroundEnabled', !enabled),
          }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))));
    }

    // `hidden` short-circuits `render` in the settings shell, so the main row is
    // replaced by a render contribution rather than hidden.
    return [
      { ...main, render: mainRow },
    ];
  }

  return {
    settings: [mainSetting, kindSetting, opacitySetting, blurSetting],
    useSettings,
    styles: settingsStyles + panelStyles,
    api: { wallpaperSource, loadWallpaper, saveWallpaper, clearWallpaper },
  } satisfies ClientFeature;
}

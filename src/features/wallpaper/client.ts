import type { ChangeEvent, CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { ClientEnvironment, ClientFeature, ClientRuntime, SettingsViewContext } from '../../shared/client/types.ts';
import type { WallpaperAsset } from './rpc.ts';
import { watchBackground } from '../../shared/client/background/attachment.ts';
import { wallpaperAppearance, wallpaperEnabled, wallpaperChoice, WALLPAPER_CHOICES, type WallpaperChoice } from '../../shared/client/background/selection.ts';
import { styles } from './styles.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import { FLOW_PREVIEW, PRESET_IMAGES } from './presets.ts';
import { temporarilyHideSettings } from './preview.ts';

type Field = 'wallpaperVisibility' | 'wallpaperBlur';
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const NAVIGATION = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
const PREVIEW_HOLD_MS = 200;
const PREVIEW_DRAG_PX = 4;
const readImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read failed'));
  reader.onload = () => typeof reader.result === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/.test(reader.result)
    ? resolve(reader.result) : reject(new Error('read failed'));
  reader.readAsDataURL(file);
});

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, observable, useSnapshot, Button, Tooltip, NativeIcon, errorFeedback, loadingFeedback } = runtime;
  const { ctx, source, t } = env;
  let active = true;
  let generation = 0;
  let queue = Promise.resolve();
  let pending: { id: number; field: Field; value: number }[] = [];
  let pendingChoices: { id: number; choice: WallpaperChoice }[] = [];
  let nextId = 0;
  let preview: Partial<Record<Field, number>> = {};
  const previewRestorers = new Set<() => void>();
  let state: { status: 'idle' | 'loading' | 'ready' | 'error'; asset: WallpaperAsset | null;
    picking: boolean; error: string; saveError: string; layoutError: boolean; previewError: boolean; revision: number } = {
    status: 'idle', asset: null, picking: false, error: '', saveError: '', layoutError: false, previewError: false, revision: 0,
  };
  const store = observable(() => state);
  const publish = (patch: Partial<typeof state> = {}) => {
    state = { ...state, ...patch, revision: state.revision + 1 };
    store.notify();
  };
  const editable = () => {
    const snapshot = source.getSnapshot();
    return active && snapshot.status === 'ready' && snapshot.writable && wallpaperEnabled(snapshot.value);
  };
  const choice = () => pendingChoices.at(-1)?.choice ?? wallpaperChoice(source.getSnapshot().value);
  const preserveLegacyAppearance = async () => {
    for (const field of ['wallpaperVisibility', 'wallpaperBlur'] as const) {
      const snapshot = source.getSnapshot();
      const saved = snapshot.value;
      if (!active || snapshot.status !== 'ready' || !snapshot.writable
        || saved?.wallpaperSelection !== undefined || saved?.flowingBackgroundEnabled !== true) return;
      const legacy = wallpaperAppearance(saved);
      const value = field === 'wallpaperVisibility' ? legacy.visibility : legacy.blur;
      if (saved[field] === undefined && !await env.form.set(field, value)) throw new Error('save failed');
    }
  };
  const choose = (next: WallpaperChoice) => {
    if (!editable() || next === choice()) return Promise.resolve();
    const id = ++nextId;
    pendingChoices.push({ id, choice: next });
    preview = {};
    publish({ saveError: '' });
    queue = queue.catch(() => {}).then(async () => {
      if (!active) return;
      try {
        if (!editable()) return;
        await preserveLegacyAppearance();
        if (!active || !editable()) return;
        if (!await env.form.set('wallpaperSelection', next)) throw new Error('save failed');
        if (active) publish({ saveError: '' });
      } catch {
        if (active) publish({ saveError: t('saveFailed') });
      } finally {
        pendingChoices = pendingChoices.filter(item => item.id !== id);
        if (active) publish();
      }
    });
    return queue;
  };
  const appearance = () => {
    const saved = wallpaperAppearance(source.getSnapshot().value);
    for (const item of pending) saved[item.field === 'wallpaperVisibility' ? 'visibility' : 'blur'] = item.value;
    return { visibility: preview.wallpaperVisibility ?? saved.visibility, blur: preview.wallpaperBlur ?? saved.blur };
  };
  const cancel = (field?: Field) => {
    if (field) delete preview[field];
    else preview = {};
    publish();
  };
  const commit = (field: Field) => {
    if (!editable() || choice() === 'none' || preview[field] === undefined) return Promise.resolve();
    const value = preview[field];
    delete preview[field];
    const saved = wallpaperAppearance(source.getSnapshot().value);
    const last = pending.filter(item => item.field === field).at(-1)?.value ?? saved[field === 'wallpaperVisibility' ? 'visibility' : 'blur'];
    if (last === value) { publish(); return Promise.resolve(); }
    const id = ++nextId;
    pending.push({ id, field, value });
    publish({ saveError: '' });
    queue = queue.catch(() => {}).then(async () => {
      if (!active) return;
      if (!editable()) { pending = pending.filter(item => item.id !== id); publish(); return; }
      try {
        if (!await env.form.set(field, value)) throw new Error('save failed');
        if (active) publish({ saveError: '' });
      } catch {
        if (active) publish({ saveError: t('saveFailed') });
      } finally {
        pending = pending.filter(item => item.id !== id);
        if (active) publish();
      }
    });
    return queue;
  };
  const load = async () => {
    const token = ++generation;
    publish({ status: 'loading', error: '' });
    try {
      const reply = await ctx.remote.powerDsh.readWallpaper();
      if (!active || token !== generation) return;
      if (!reply.ok) throw new Error('read failed');
      publish({ status: 'ready', asset: reply.value });
    } catch {
      if (active && token === generation) publish({ status: 'error', error: t('wallpaperReadFailed') });
    }
  };
  ctx.effect(() => {
    const sync = () => {
      if (!editable()) preview = {};
      const snapshot = source.getSnapshot();
      if (snapshot.status === 'ready' && wallpaperEnabled(snapshot.value) && wallpaperChoice(snapshot.value) === 'custom' && state.status === 'idle') void load();
      publish();
    };
    sync();
    return source.subscribe(sync);
  });
  ctx.effect(() => () => {
    active = false; generation++; preview = {}; pending = []; pendingChoices = [];
    for (const restore of previewRestorers) restore();
    previewRestorers.clear();
  });

  function Background() {
    const asset = useSnapshot(store).asset;
    useSnapshot(source);
    const selected = choice();
    const dataUrl = selected === 'custom' ? asset?.dataUrl : PRESET_IMAGES[selected];
    React.useLayoutEffect(() => {
      if (selected === 'none' || selected !== 'flow' && !dataUrl) return;
      const read = () => {
        const current = appearance();
        return { opacity: current.visibility, blur: current.visibility === 0 ? 0 : current.blur,
          wallpaper: dataUrl ? { dataUrl, name: selected === 'custom' ? asset?.name ?? '' : selected } : null };
      };
      return watchBackground(status => {
        const failed = status.state !== 'attached';
        if (state.layoutError !== failed) publish({ layoutError: failed });
      }, undefined, undefined, undefined, read(), read, listener => {
        const offForm = source.subscribe(listener);
        const offState = store.subscribe(listener);
        return () => { offForm(); offState(); };
      });
    }, [selected, dataUrl]);
    return null;
  }
  ctx.slots.inject('shell.overlay', () => {
    let release: (() => void) | undefined;
    const sync = () => {
      const snapshot = source.getSnapshot();
      const enabled = snapshot.status === 'ready' && wallpaperEnabled(snapshot.value) && choice() !== 'none';
      if (enabled && !release) release = ctx.slots.register({ name: 'shell.overlay', id: 'power-dsh-wallpaper', order: -100,
        locale: env.namespace }, Background);
      else if (!enabled && release) { release(); release = undefined; }
    };
    sync();
    const off = source.subscribe(sync);
    const offState = store.subscribe(sync);
    return () => { off(); offState(); release?.(); };
  });

  function Slider({ field, disabled }: { field: Field; disabled: boolean }) {
    useSnapshot(store);
    const gesture = React.useRef<{ active: {
      id: number; choice: WallpaperChoice; input: HTMLInputElement; startedAt: number; startX: number;
      attempted: boolean; restore: (() => void) | null;
    } | null }>({ active: null });
    const mounted = React.useRef(true);
    const ignored = React.useRef(false);
    const [pressed, setPressed] = React.useState(false);
    const visibility = field === 'wallpaperVisibility';
    const value = appearance()[visibility ? 'visibility' : 'blur'];
    const max = visibility ? 100 : 20;
    const blocked = disabled || choice() === 'none' || !visibility && appearance().visibility === 0;
    const hint = visibility ? 'wallpaperVisibilityHint' : 'wallpaperBlurHint';
    const id = `power-dsh-${field}`;
    const unit = visibility ? '%' : 'px';
    const restore = () => {
      const current = gesture.current.active;
      gesture.current.active = null;
      if (current?.restore) { previewRestorers.delete(current.restore); current.restore(); }
    };
    const discard = () => {
      if (!mounted.current) return;
      if (gesture.current.active) ignored.current = true;
      restore(); setPressed(false); cancel(field);
    };
    const validateGesture = () => {
      const current = gesture.current.active;
      if (current && (!editable() || choice() !== current.choice)) { discard(); return false; }
      return true;
    };
    const matches = (event?: PointerEvent<HTMLInputElement>) => !event || !gesture.current.active || event.pointerId === gesture.current.active.id;
    React.useEffect(() => {
      mounted.current = true;
      window.addEventListener('blur', discard);
      const off = source.subscribe(() => {
        if (!editable() || choice() === 'none') discard();
        else validateGesture();
      });
      const offState = store.subscribe(() => { validateGesture(); });
      return () => {
        mounted.current = false; ignored.current = true;
        off(); offState(); window.removeEventListener('blur', discard); restore(); cancel(field);
      };
    }, []);
    return h('div', { className: 'power-dsh-wallpaper-field' },
      h('div', { className: 'power-dsh-wallpaper-slider', 'data-power-dsh-wallpaper-slider': '' },
        h('label', { htmlFor: id }, t(field)),
        h('input', { id, type: 'range', min: 0, max, step: 1, value, disabled: blocked,
          'data-pressed': pressed || undefined,
          style: { '--power-dsh-slider-position': `${value / max * 100}%` } as CSSProperties,
          'aria-label': t(field), 'aria-describedby': `${id}-hint`, 'aria-valuetext': `${value}${unit}`,
          onPointerDown: (event: PointerEvent<HTMLInputElement>) => {
            if (!mounted.current || blocked || !editable() || gesture.current.active || event.button !== 0 || event.isPrimary === false) return;
            ignored.current = false;
            try { event.currentTarget.setPointerCapture(event.pointerId); }
            catch { publish({ previewError: true }); return; }
            gesture.current.active = { id: event.pointerId, choice: choice(), input: event.currentTarget,
              startedAt: event.timeStamp, startX: event.clientX, attempted: false, restore: null };
            setPressed(true);
          },
          onPointerMove: (event: PointerEvent<HTMLInputElement>) => {
            if (!validateGesture()) return;
            const current = gesture.current.active;
            if (!mounted.current || blocked || !editable() || !current || current.attempted
              || !matches(event) || event.isPrimary === false) return;
            if (event.timeStamp - current.startedAt < PREVIEW_HOLD_MS || Math.abs(event.clientX - current.startX) < PREVIEW_DRAG_PX) return;
            current.attempted = true;
            const release = temporarilyHideSettings(current.input);
            current.restore = release;
            if (release) previewRestorers.add(release);
            publish({ previewError: !release });
          },
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            if (!mounted.current || blocked || ignored.current || !editable() || !validateGesture()) return;
            const next = Number(event.currentTarget.value);
            if (!Number.isFinite(next)) return;
            preview[field] = Math.round(Math.min(max, Math.max(0, next)));
            publish();
          },
          onPointerUp: (event?: PointerEvent<HTMLInputElement>) => {
            if (!mounted.current || !matches(event) || event?.isPrimary === false || !validateGesture()) return;
            restore(); setPressed(false);
            if (ignored.current) return;
            return blocked ? undefined : commit(field);
          },
          onPointerCancel: (event?: PointerEvent<HTMLInputElement>) => { if (matches(event)) discard(); },
          onLostPointerCapture: (event?: PointerEvent<HTMLInputElement>) => { if (matches(event)) discard(); },
          onBlur: discard,
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => { if (mounted.current && NAVIGATION.includes(event.key)) ignored.current = false; },
          onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => {
            if (mounted.current && !blocked && NAVIGATION.includes(event.key)) return commit(field);
          },
        }),
        h('span', { className: 'power-dsh-wallpaper-value', 'aria-hidden': true }, `${value}${unit}`)),
      h('p', { id: `${id}-hint`, className: 'power-dsh-wallpaper-caption' }, t(hint)));
  }

  function PresetPicker({ disabled, asset, pick, remove }: { disabled: boolean; asset: WallpaperAsset | null; pick(): void; remove(): Promise<void> }) {
    useSnapshot(store);
    const selected = choice();
    const buttons = React.useRef(new Map<WallpaperChoice, HTMLButtonElement>());
    const [focused, setFocused] = React.useState<WallpaperChoice | null>(null);
    const activate = (next: WallpaperChoice) => {
      if (disabled || !editable()) return;
      if (next === 'custom' && !asset) { pick(); return; }
      return choose(next);
    };
    return h('div', { className: 'power-dsh-wallpaper-presets', role: 'radiogroup', 'aria-label': t('wallpaperSelect'),
      onBlur: (event: import('react').FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
      } },
      ...WALLPAPER_CHOICES.map((id, index) => {
        const dataUrl = id === 'custom' ? asset?.dataUrl : PRESET_IMAGES[id];
        const backgroundImage = id === 'flow' ? FLOW_PREVIEW : dataUrl ? `url("${dataUrl}")` : undefined;
        const radio = h('button', {
          type: 'button', role: 'radio', className: 'power-dsh-wallpaper-preset',
          ref: (element: HTMLButtonElement | null) => { if (element) buttons.current.set(id, element); else buttons.current.delete(id); },
          'aria-checked': selected === id, 'aria-label': t(`wallpaperPreset_${id}`), disabled,
          tabIndex: !disabled && id === (focused ?? selected) ? 0 : -1,
          onFocus: () => setFocused(id), onClick: () => activate(id),
          onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
            if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
            const nextIndex = ({ ArrowLeft: index - 1, ArrowRight: index + 1, ArrowUp: index - 1,
              ArrowDown: index + 1, Home: 0, End: WALLPAPER_CHOICES.length - 1 } as Record<string, number>)[event.key];
            if (nextIndex === undefined) return;
            event.preventDefault();
            const next = WALLPAPER_CHOICES[(nextIndex + WALLPAPER_CHOICES.length) % WALLPAPER_CHOICES.length];
            setFocused(next);
            buttons.current.get(next)?.focus();
            if (next !== 'custom' || asset) return activate(next);
          },
        }, h('span', { className: 'power-dsh-wallpaper-preset-preview', style: { backgroundImage }, 'data-empty': !backgroundImage || undefined, 'aria-hidden': true },
          !backgroundImage && (id === 'custom' ? '+' : h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 },
            h('circle', { cx: 10, cy: 10, r: 7 }), h('path', { d: 'm5 5 10 10' })))),
        h('span', { className: 'power-dsh-wallpaper-preset-label' }, t(`wallpaperPreset_${id}`)));
        return h('div', { className: 'power-dsh-wallpaper-tile', key: id, 'data-selected': selected === id || undefined, 'data-has-actions': id === 'custom' && Boolean(asset) || undefined },
          id === 'custom' && asset?.path ? h(Tooltip, { label: asset.path, portal: true, maxWidth: 520 }, radio) : radio,
          id === 'custom' && asset && h('div', { className: 'power-dsh-wallpaper-tile-actions' },
            h(Tooltip, { label: t('wallpaperReplace'), portal: true },
              h(Button, { type: 'button', variant: 'ghost', size: 'sm', className: 'power-dsh-wallpaper-tile-action', disabled,
                'aria-label': t('wallpaperReplace'), onClick: () => { if (!disabled && editable()) pick(); } }, h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
                  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
                  h('path', { d: 'M3 5h10m-2.5-2.5L13 5l-2.5 2.5M13 11H3m2.5-2.5L3 11l2.5 2.5' })))),
            h(Tooltip, { label: t('wallpaperRemove'), portal: true },
              h(Button, { type: 'button', variant: 'ghost', size: 'sm', className: 'power-dsh-wallpaper-tile-action', disabled,
                'aria-label': t('wallpaperRemove'), onClick: remove }, h(NativeIcon, { glyph: 'trash-outline', size: 14 })))));
      }));
  }

  function Controls({ disabled }: { disabled: boolean }) {
    const current = useSnapshot(store);
    const input = React.useRef<HTMLInputElement | null>(null);
    const mounted = React.useRef(true);
    React.useEffect(() => {
      mounted.current = true;
      if (state.status === 'idle') void load();
      return () => { mounted.current = false; cancel(); };
    }, []);
    const allowed = () => mounted.current && !disabled && editable();
    const pick = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file || !allowed() || state.picking) return;
      if (!ACCEPTED.includes(file.type)) { publish({ error: t('wallpaperUnsupported') }); return; }
      if (file.size > 25 * 1024 * 1024) { publish({ error: t('wallpaperTooLarge') }); return; }
      const token = ++generation;
      publish({ picking: true, error: '' });
      try {
        const dataUrl = await readImage(file);
        if (!allowed() || token !== generation) return;
        const reply = await ctx.remote.powerDsh.saveWallpaper(dataUrl, file.name);
        if (!active || token !== generation) return;
        if (!reply.ok) throw new Error('save failed');
        publish({ status: 'ready', asset: reply.value });
        await choose('custom');
      } catch {
        if (active && token === generation) publish({ error: t('wallpaperSaveFailed') });
      } finally {
        if (active && token === generation) publish({ picking: false });
      }
    };
    const remove = async () => {
      if (!allowed() || state.picking) return;
      const token = ++generation;
      publish({ picking: true, error: '' });
      try {
        const reply = await ctx.remote.powerDsh.clearWallpaper();
        if (!active || token !== generation) return;
        if (!reply.ok) throw new Error('clear failed');
        publish({ status: 'ready', asset: null, layoutError: false });
        if (choice() === 'custom') await choose('none');
      } catch {
        if (active && token === generation) publish({ error: t('wallpaperSaveFailed') });
      } finally {
        if (active && token === generation) publish({ picking: false });
      }
    };
    const busy = disabled || current.picking || current.status === 'loading';
    return h('div', { className: 'power-dsh-wallpaper-settings' },
      h('div', { className: 'power-dsh-wallpaper-picker-group' },
        h(PresetPicker, { disabled: busy, asset: current.asset, pick: () => input.current?.click(), remove }),
        h('p', { className: 'power-dsh-wallpaper-caption' }, t('wallpaperFormats'))),
      h('input', { ref: input, type: 'file', className: 'power-dsh-wallpaper-file', tabIndex: -1,
        'aria-hidden': true, accept: ACCEPTED.join(','), disabled: busy, onChange: pick }),
      current.status === 'loading' && loadingFeedback({ label: t('loading'), compact: true }),
      current.error && errorFeedback({ t, message: current.error, code: 'PD-WALLPAPER-ASSET', operation: 'wallpaper.asset',
        retry: current.status === 'error' ? load : undefined }),
      current.layoutError && choice() !== 'none' && errorFeedback({ t, message: t('wallpaperLayoutFailed'),
        code: 'PD-WALLPAPER-LAYOUT', operation: 'wallpaper.attach' }),
      h(Slider, { field: 'wallpaperVisibility', disabled }),
      h(Slider, { field: 'wallpaperBlur', disabled }),
      current.previewError && errorFeedback({ t, message: t('wallpaperPreviewUnavailable'), code: 'PD-WALLPAPER-PREVIEW', operation: 'wallpaper.preview' }),
      current.saveError && errorFeedback({ t, message: current.saveError, code: 'PD-WALLPAPER-SAVE', operation: 'wallpaper.appearance' }));
  }
  function WallpaperPage() {
    const snapshot = useSnapshot(source);
    const ready = snapshot.status === 'ready';
    const disabled = !ready || !snapshot.writable || !wallpaperEnabled(snapshot.value);
    return h('section', { className: 'power-dsh-page power-dsh-wallpaper-page', 'aria-label': t('wallpaperTab') },
      h('style', null, shellStyles + styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('wallpaperTab')),
        h('p', { className: 'power-dsh-description' }, t('wallpaperPageDescription'))),
      !ready ? snapshot.status === 'loading' ? loadingFeedback({ label: t('loading') })
        : errorFeedback({ t, message: t('unavailable'), code: 'PD-WALLPAPER-LOAD', operation: 'wallpaper.settings', placement: 'page' })
        : h(React.Fragment, null,
          !snapshot.writable && h('p', { className: 'power-dsh-notice', role: 'status' }, t('readOnly')),
          h(Controls, { disabled })));
  }
  function WallpaperIcon({ size = 16 }: { size?: number }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
      h('rect', { x: 2, y: 2.5, width: 12, height: 11, rx: 2 }),
      h('circle', { cx: 5.5, cy: 6, r: 1 }),
      h('path', { d: 'm2.5 11 3-3 2.5 2 2.5-3 3 4' }));
  }
  for (const name of ['settings.section', 'settings.section.icon']) ctx.slots.inject(name, () => {
    let release: (() => void) | undefined;
    const sync = () => {
      const snapshot = source.getSnapshot();
      const enabled = snapshot.status === 'ready' && wallpaperEnabled(snapshot.value);
      if (enabled && !release) release = ctx.slots.register({ name, id: 'power-dsh-wallpaper', order: 50.5,
        locale: env.namespace, ...(name === 'settings.section' ? { label: () => t('wallpaperTab') } : {}) },
      name === 'settings.section' ? WallpaperPage : WallpaperIcon);
      else if (!enabled && release) { release(); release = undefined; }
    };
    sync();
    const off = source.subscribe(sync);
    return () => { off(); release?.(); };
  });
  const main = { field: 'wallpaperEnabled', description: 'wallpaperDescription',
    save: async (next: unknown) => {
      if (next === true && source.getSnapshot().value?.wallpaperSelection === undefined) {
        const selected = wallpaperChoice(source.getSnapshot().value);
        await preserveLegacyAppearance();
        const snapshot = source.getSnapshot();
        if (!active || snapshot.status !== 'ready' || !snapshot.writable) throw new Error(t('saveFailed'));
        if (!await env.form.set('wallpaperSelection', selected)) throw new Error(t('saveFailed'));
      }
      const snapshot = source.getSnapshot();
      if (!active || snapshot.status !== 'ready' || !snapshot.writable) throw new Error(t('saveFailed'));
      if (!await env.form.set('wallpaperEnabled', next === true)) throw new Error(t('saveFailed'));
    } } as const;
  const selection = { field: 'wallpaperSelection', hidden: true } as const;
  const visibility = { field: 'wallpaperVisibility', hidden: true } as const;
  const blur = { field: 'wallpaperBlur', hidden: true } as const;
  function switchRow({ snapshot, disabled, saving, error, save, id }: SettingsViewContext) {
    const enabled = wallpaperEnabled(snapshot.value);
      const control = `${id}-wallpaperEnabled`;
      const busy = saving?.field === 'wallpaperEnabled';
      return h(React.Fragment, null,
        h('div', { className: 'power-dsh-setting-row' },
          h('div', { className: 'power-dsh-setting-copy' },
            h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t('wallpaperEnabled')),
            h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t('wallpaperDescription')),
            error?.field === 'wallpaperEnabled' && errorFeedback({ t, message: error.message, code: 'PD-SETTINGS-SAVE', operation: 'settings.wallpaperEnabled' })),
          h('button', { id: control, type: 'button', role: 'switch', className: 'power-dsh-switch', disabled: disabled || busy,
            'aria-checked': busy ? saving.value === true : enabled, 'aria-busy': busy,
            'aria-labelledby': `${control}-label`, 'aria-describedby': `${control}-description`,
            onClick: () => save('wallpaperEnabled', !enabled) }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))),
      );
  }
  return { settings: [main, selection, visibility, blur], styles,
    useSettings: context => [{ ...main, render: () => switchRow(context) }, selection, visibility, blur],
  } satisfies ClientFeature;
}

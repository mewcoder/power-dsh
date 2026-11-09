import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientContext, ClientEnvironment, ClientFeature, ClientRuntime, ComposerSlotProps, SettingContribution, SettingsViewContext, SnapshotSource } from '../../shared/client/types.ts';
import { arcGeometry, barGeometry, currentChoiceIndex, effortChoices, litBars, type DirectoryLike, type DirectorySnapshot, type ModelDirectories } from './levels.ts';
import { settingsStyles, styles } from './styles.ts';

const EMPTY_SNAPSHOT: DirectorySnapshot = { current: null, groups: [], status: 'idle', error: null };
const GLYPHS = ['signal', 'arc'] as const;
type Glyph = typeof GLYPHS[number];

function resolveGlyph(value: unknown): Glyph {
  return value === 'signal' ? 'signal' : 'arc';
}

function resolveDirectory(service: ModelDirectories | null, sessionId: string | undefined): DirectoryLike | null {
  if (!service || !sessionId) return null;
  try { return service.directoryFor(sessionId); }
  catch { return null; }
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Tooltip, Menu, observable, useSnapshot, errorFeedback } = runtime;
  const { ctx, t, savePreference, preferenceSlot, source } = env;
  // A stable empty snapshot keeps hook order fixed when the native service is absent.
  const emptyStore: SnapshotSource<DirectorySnapshot> = observable(() => EMPTY_SNAPSHOT);
  let directories: ModelDirectories | null = null;
  const availability = observable(() => directories !== null);

  // Optional service: a missing model directory silently hides the button instead of breaking the Client.
  ctx.inject(['modelDirectories'], child => {
    const service = (child as ClientContext & { modelDirectories?: ModelDirectories }).modelDirectories;
    if (!service || typeof service.directoryFor !== 'function') return;
    child.effect(() => {
      directories = service;
      availability.notify();
      return () => { directories = null; availability.notify(); };
    });
  });

  function renderGraphic(glyph: Glyph, count: number, active: number, rotation: number) {
    if (glyph === 'arc') {
      const geometry = arcGeometry(count, active);
      return h('svg', {
        className: 'power-dsh-effort-bars', width: 20, height: 20, viewBox: '0 0 16 16',
        'aria-hidden': true, focusable: false,
      },
        h('path', { className: 'power-dsh-effort-arc-track', d: geometry.track, fill: 'none', strokeLinecap: 'round' }),
        ...geometry.ticks.map((tick, index) => h('line', {
          key: `tick-${index}`, className: 'power-dsh-effort-arc-tick',
          x1: tick.x1, y1: tick.y1, x2: tick.x2, y2: tick.y2, strokeLinecap: 'round',
        })),
        geometry.needle && h('line', {
          className: `power-dsh-effort-arc-needle${geometry.auto ? ' power-dsh-effort-arc-auto' : ''}`,
          x1: geometry.needle.x1, y1: geometry.needle.y1, x2: geometry.needle.x2, y2: geometry.needle.y2,
          strokeLinecap: 'round', style: { transform: `rotate(${rotation}deg)` },
        }),
        h('circle', {
          className: `power-dsh-effort-arc-hub${geometry.auto ? ' power-dsh-effort-arc-auto' : ''}`,
          cx: geometry.hub.cx, cy: geometry.hub.cy, r: geometry.hub.r,
        }));
    }
    return h('svg', {
      className: 'power-dsh-effort-bars', width: 20, height: 14, viewBox: '0 0 20 14',
      'aria-hidden': true, focusable: false,
    }, ...barGeometry(count, active, 20).map(bar => h('rect', {
      className: bar.filled ? 'power-dsh-effort-bar-on' : 'power-dsh-effort-bar-off',
      x: bar.x, y: bar.y, width: bar.width, height: bar.height, rx: bar.width / 2, ry: bar.width / 2,
      opacity: bar.filled ? 1 : 0.3,
    })));
  }

  function ThinkingEffortButton(props: ComposerSlotProps) {
    const available = useSnapshot(availability);
    const preferences = useSnapshot(source);
    const glyph = resolveGlyph(preferences.value?.thinkingEffortGlyph);
    const [error, setError] = React.useState('');
    const [pending, setPending] = React.useState(false);
    const [needleMotion, setNeedleMotion] = React.useState({ target: -180, rotation: -180 });
    const directory = available ? resolveDirectory(directories, props.sessionId) : null;
    const snapshot = useSnapshot(directory?.store ?? emptyStore);
    React.useEffect(() => {
      if (directory) void directory.load().catch(() => { /* directory exposes its own error */ });
    }, [directory]);
    if (!directory || !snapshot.current) return null;
    const current = snapshot.current;
    const group = snapshot.groups.find(candidate => candidate.id === current.provider);
    const model = group?.models.find(candidate => candidate.id === current.model);
    const reasoning = model?.reasoning;
    const choices = effortChoices(reasoning, t('effortDefault'));
    if (choices.length === 0) return null;
    const index = currentChoiceIndex(choices, current.reasoningEffort ?? reasoning?.defaultEffort);
    const selected = choices[index] ?? choices[0];
    const next = choices[(index + 1) % choices.length];
    const busy = pending || snapshot.status === 'loading' || snapshot.status === 'selecting';
    const hint = error || `${t('effortLabel')}：${selected.label} · ${t('effortSwitchTo')} ${next.label}`;
    const count = reasoning?.efforts.length ?? 0;
    const active = litBars(choices, index);
    const target = arcGeometry(count, active).needle?.rotation ?? -180;
    let rotation = needleMotion.rotation;
    if (target !== needleMotion.target) {
      let delta = target - needleMotion.target;
      // Cross the bottom gap by the short path; real levels still follow the full scale.
      if (active === 0 || needleMotion.target === -180) delta = ((delta + 540) % 360) - 180;
      rotation += delta;
      setNeedleMotion({ target, rotation });
    }
    const graphic = renderGraphic(glyph, count, active, rotation);
    const button = h('button', {
      type: 'button', className: 'power-dsh-effort-button',
      'aria-label': hint, 'aria-busy': busy ? true : undefined, disabled: busy,
      onClick: (event: import('react').MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (busy) return;
        setError('');
        setPending(true);
        const selection = {
          provider: current.provider, model: current.model,
          ...(next.id === undefined ? {} : { reasoningEffort: next.id }),
        };
        return directory.select(selection).then(result => {
          if (!result.ok) setError(`${t('effortSwitchFailed')} ${result.error?.message ?? ''}`.trim());
        }, (failure: unknown) => {
          setError(`${t('effortSwitchFailed')} ${errorMessage(failure) ?? ''}`.trim());
        }).finally(() => { setPending(false); });
      },
    }, graphic);
    return h(React.Fragment, null,
      h('style', null, styles),
      h(Tooltip, { label: hint, side: 'top', portal: true, delayMs: 0, maxWidth: 400 }, button));
  }

  preferenceSlot('showThinkingEffortSwitcher', 'conversation.input.right',
    { id: 'power-dsh-thinking-effort', order: 100 }, ThinkingEffortButton);

  const mainSetting: SettingContribution = {
    field: 'showThinkingEffortSwitcher', description: 'thinkingEffortDescription',
    save: next => savePreference('showThinkingEffortSwitcher', next === true),
  };
  const glyphSetting: SettingContribution = {
    field: 'thinkingEffortGlyph', hidden: true,
    canSave: () => source.getSnapshot().value?.showThinkingEffortSwitcher === true,
    save: next => {
      if (typeof next === 'string' && (GLYPHS as readonly string[]).includes(next)) {
        return savePreference('thinkingEffortGlyph', next, undefined, 'string');
      }
      return Promise.resolve();
    },
  };

  function useSettings({ snapshot, disabled, saving, error, save, id }: SettingsViewContext): SettingContribution[] {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const enabled = snapshot.value?.showThinkingEffortSwitcher === true;
    React.useEffect(() => { if (!enabled) setMenuOpen(false); }, [enabled]);
    const currentGlyph = resolveGlyph(snapshot.value?.thinkingEffortGlyph);
    const glyphLabel = (glyph: Glyph) => t(glyph === 'arc' ? 'glyphArc' : 'glyphSignal');
    function styleRow() {
      if (!enabled) return null;
      const field = 'thinkingEffortGlyph';
      const control = `${id}-${field}`;
      const busy = saving?.field === field;
      const fieldError = error?.field === field ? error.message : '';
      return h('div', { className: 'power-dsh-setting-row', key: field },
        h('div', { className: 'power-dsh-setting-copy' },
          h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t('thinkingEffortGlyph')),
          h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t('thinkingEffortGlyphDescription')),
          fieldError && errorFeedback({ t, id: `${control}-error`, message: fieldError,
             code: 'PD-EFFORT-STYLE-SAVE', operation: 'settings.thinkingEffortGlyph' })),
        h(Menu, {
          open: menuOpen && !disabled, onClose: () => setMenuOpen(false), selectedId: currentGlyph,
          align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
          items: GLYPHS.map(glyph => ({ id: glyph, label: glyphLabel(glyph) })),
          onSelect: next => { setMenuOpen(false); return save(field, next); },
          anchor: h('button', {
            type: 'button', className: 'power-dsh-effort-style-select', disabled: disabled || busy,
            'aria-label': t('thinkingEffortGlyph'), 'aria-describedby': `${control}-description${fieldError ? ` ${control}-error` : ''}`,
            'aria-invalid': Boolean(fieldError),
            'aria-haspopup': 'menu', 'aria-expanded': menuOpen && !disabled, 'aria-busy': busy,
            onClick: () => { if (!disabled) setMenuOpen(value => !value); },
          }, glyphLabel(currentGlyph), h('svg', {
            width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
            strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
          }, h('path', { d: 'm4 6 4 4 4-4' }))),
        }));
    }
    return [mainSetting, { ...glyphSetting, hidden: false, render: styleRow }];
  }

  return {
    settings: [mainSetting, glyphSetting],
    useSettings,
    styles: settingsStyles,
  } satisfies ClientFeature;
}

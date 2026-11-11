import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FormSnapshot, SettingsForm, SlotProps, SnapshotSource, ThemeService } from '../../shared/client/types.ts';
import { styles } from './styles.ts';
interface AppearanceProps extends SlotProps { source: SnapshotSource<FormSnapshot>; themeSource: SnapshotSource<ReturnType<ThemeService['getTheme']> | null>; themeForm: SnapshotSource<FormSnapshot>; setTheme(id: string): void; footerBusy: SnapshotSource<boolean>; }

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, observable, useSnapshot, NativeIcon, errorFeedback } = runtime;
  const { ctx, source, t } = env;
  const themeChoices = [
    { id: 'light', key: 'themeLight', glyph: 'light-outline' },
    { id: 'dark', key: 'themeDark', glyph: 'dark-outline' },
    { id: 'system', key: 'themeSystem', glyph: 'followsystem-outline' },
  ];
  function AppearanceButton({ wide, source, t, themeSource, themeForm, setTheme, footerBusy }: AppearanceProps) {
    const config = useSnapshot(source);
    const theme = useSnapshot(themeSource);
    const writable = useSnapshot(themeForm);
    const busy = useSnapshot(footerBusy);
    const [error, setError] = React.useState('');
    const [position, setPosition] = React.useState<number | null>(null);
    const seat = React.useRef<HTMLSpanElement | null>(null);
    const visible = wide && !busy && config.status === 'ready' && config.value?.showThemeSwitcher === true && theme !== null;
    React.useLayoutEffect(() => {
      if (!visible || !seat.current) return;
      const element = seat.current;
      const measure = () => setPosition(Math.max(0, element.getBoundingClientRect().right - 40));
      measure();
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
      observer?.observe(element);
      window.addEventListener('resize', measure);
      window.visualViewport?.addEventListener('resize', measure);
      return () => {
        observer?.disconnect();
        window.removeEventListener('resize', measure);
        window.visualViewport?.removeEventListener('resize', measure);
      };
    }, [visible]);
    if (!visible) return null;
    const currentIndex = themeChoices.findIndex(choice => choice.id === theme!.preference);
    const current = themeChoices[currentIndex] || themeChoices[2];
    const next = themeChoices[(currentIndex + 1) % themeChoices.length];
    const title = `${t('appearance')} · ${t(current.key)} · ${t('switchTo')} ${t(next.key)}`;
    // Native connection and update indicators have priority in this shared space.
    return h('span', { className: 'power-dsh-appearance-seat', ref: seat },
      h('style', null, styles),
      h('button', {
        type: 'button', className: 'power-dsh-appearance-button', title: error || title,
        style: position === null ? { visibility: 'hidden' } : { left: position },
        'aria-label': title, disabled: writable.status !== 'ready' || !writable.writable,
        onClick: (event: import('react').MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          try { setTheme(next.id); setError(''); }
          catch (failure) { setError(errorMessage(failure) || t('saveFailed')); }
        },
      }, h(NativeIcon, { glyph: current.glyph })),
      error && errorFeedback({ t, message: error, code: 'PD-APPEARANCE-SAVE', operation: 'theme.setTheme',
        placement: 'compact', className: 'power-dsh-theme-error',
        style: position === null ? { visibility: 'hidden' } : { left: Math.max(8, position - 208) } }));
  }
  const footerBusy = env.footerBusy;
  let themeBinding: { theme: ThemeService; form: SettingsForm } | null = null;
  const unavailableForm: FormSnapshot = { status: 'unavailable', writable: false };
  const themeSource = observable(() => themeBinding?.theme.getTheme() ?? null);
  const themeForm = observable(() => themeBinding?.form.getSnapshot() ?? unavailableForm);
  const setTheme = (id: string) => {
    if (!themeBinding) throw new Error(t('unavailable'));
    themeBinding.theme.setTheme(id);
  };
  // Only the appearance button depends on theme; the version badge remains registered.
  ctx.inject(['theme'], child => {
    const binding = { theme: child.theme, form: child.configForms.get('ui-theme') };
    const notify = () => { themeSource.notify(); themeForm.notify(); };
    child.effect(() => {
      themeBinding = binding;
      notify();
      return () => { themeBinding = null; notify(); };
    });
    child.on('theme/change', themeSource.notify);
    child.effect(() => binding.form.subscribe(themeForm.notify));
  });
  return { settings: [{ field: 'showThemeSwitcher', description: 'themeSwitcherDescription' }], sidebar: props => h(AppearanceButton, { ...props, source, themeSource, themeForm, setTheme, footerBusy }) } satisfies ClientFeature;
}

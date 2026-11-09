import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, FormSnapshot, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { PersonalizationFile } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
interface PersonalizationPageProps extends PageSlotProps { source: SnapshotSource<FormSnapshot>; instructionsSource: SnapshotSource<FeatureState<PersonalizationFile>>; loadInstructions(): Promise<void>; saveInstructions(text: string, revision: string): Promise<void>; }

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, observable, useSnapshot, useMounted, errorFeedback } = runtime;
  const { ctx, source, t, savePreference, preferenceSlot, namespace } = env;
  const styles = shellStyles + featureStyles;
  function PersonalizationIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
      stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round',
      'aria-hidden': true, focusable: false,
    }, h('circle', { cx: 8, cy: 4.5, r: 2.5 }),
    h('path', { d: 'M3 14v-1a5 5 0 0 1 10 0v1' }));
  }
  function PersonalizationPage({ t, source, instructionsSource, loadInstructions, saveInstructions }: PersonalizationPageProps) {
    const snapshot = useSnapshot(source);
    const instructions = useSnapshot(instructionsSource);
    const settingsPath = instructions.value?.path ?? '';
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [draft, setDraft] = React.useState<{ text: string; base: string | undefined } | null>(null);
    const pending = React.useRef(false);
    const mounted = useMounted();
    const id = React.useId();
    const savedPrompt = instructions.value?.text ?? '';
    const prompt = draft?.text ?? savedPrompt;
    const dirty = prompt !== savedPrompt;
    const conflict = draft !== null && draft.base !== instructions.value?.revision && dirty;
    const tooLong = prompt.length > 20000;
    const ready = snapshot.status === 'ready' && instructions.status === 'ready';
    const disabled = !ready || !snapshot.writable || saving || !snapshot.value?.personalizationEnabled;
    const noticeError = Boolean(instructions.error) || snapshot.status === 'unavailable' || instructions.status === 'error';
    const notice = instructions.error || (snapshot.status === 'unavailable' ? t('unavailable')
      : !ready ? t(snapshot.status === 'loading' || instructions.status === 'loading' ? 'loading' : 'unavailable')
      : !snapshot.writable ? t('readOnly') : null);
    React.useEffect(() => {
      void loadInstructions();
      const refresh = () => { void loadInstructions(); };
      window.addEventListener('focus', refresh);
      return () => window.removeEventListener('focus', refresh);
    }, []);
    async function savePrompt() {
      if (disabled || pending.current || conflict || tooLong || !dirty) return;
      pending.current = true;
      setSaving(true);
      setError(null);
      try {
        await saveInstructions(prompt, instructions.value!.revision);
        if (mounted.current) setDraft(null);
      } catch (failure) {
        if (mounted.current) setError(errorMessage(failure) || t('saveFailed'));
      } finally {
        pending.current = false;
        if (mounted.current) setSaving(false);
      }
    }
    return h('section', { className: 'power-dsh-page', 'aria-label': t('personalizationTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('personalizationTab')),
        h('p', { id: `${id}-prompt-description`, className: 'power-dsh-description' },
          settingsPath && t('settingsLocation').replace('{path}', () => settingsPath))),
      notice && (noticeError ? errorFeedback({ t, message: notice, code: 'PD-PERSONALIZATION-LOAD',
        operation: 'readPersonalization', placement: 'page', retry: loadInstructions }) : h('p', {
        className: 'power-dsh-notice', role: 'status', 'data-tone': 'neutral',
      }, notice)),
      h('div', { className: 'power-dsh-prompt-editor' },
          h('textarea', {
            id: `${id}-globalPrompt`, className: 'power-dsh-prompt-input', value: prompt,
            'aria-label': t('globalPrompt'), placeholder: t('globalPromptPlaceholder'), disabled,
            'aria-describedby': `${id}-prompt-description${conflict || tooLong || error ? ` ${id}-prompt-error` : ''}`,
            'aria-invalid': Boolean(conflict || tooLong || error),
            onChange: (event: import('react').ChangeEvent<HTMLTextAreaElement>) => {
              setDraft({ text: event.target.value, base: draft?.base ?? instructions.value?.revision });
              setError(null);
            },
          }),
          (conflict || tooLong || error) && errorFeedback({ t,
            id: `${id}-prompt-error`, message: conflict ? t('promptConflict') : tooLong ? t('promptTooLong') : error!,
             code: conflict ? 'PD-PERSONALIZATION-CONFLICT' : tooLong ? 'PD-PERSONALIZATION-LIMIT' : 'PD-PERSONALIZATION-SAVE',
             operation: 'savePersonalization',
          }),
          h('div', { className: 'power-dsh-prompt-actions' },
            h('button', {
              type: 'button', className: 'power-dsh-prompt-action', disabled: disabled || draft === null,
              onClick: () => { setDraft(null); setError(null); void loadInstructions(); },
            }, t('cancel')),
            h('button', {
              type: 'button', className: 'power-dsh-prompt-action', 'data-primary': true,
              disabled: disabled || !dirty || conflict || tooLong, 'aria-busy': saving,
              onClick: savePrompt,
            }, t(saving ? 'saving' : 'save')))));
  }
  let active = true;
  let instructions: FeatureState<PersonalizationFile> = { status: 'loading', value: null, error: '' };
  const instructionsSource = observable(() => instructions);
  let fileGeneration = 0;
  ctx.effect(() => () => { active = false; fileGeneration++; });
  const loadInstructions = async () => {
    const generation = ++fileGeneration;
    try {
      const result = await ctx.remote.powerDsh.readPersonalization();
      if (!active || generation !== fileGeneration) return;
      if (!result.ok) throw new Error(result.error.message);
      instructions = { status: 'ready', value: result.value, error: '' };
    } catch (failure) {
      if (!active || generation !== fileGeneration) return;
      instructions = { ...instructions, status: 'error', error: errorMessage(failure) || t('unavailable') };
    }
    instructionsSource.notify();
  };
  const saveInstructions = async (text: string, revision: string) => {
    ++fileGeneration;
    const result = await ctx.remote.powerDsh.savePersonalization(text, revision);
    if (!result.ok) {
      await loadInstructions();
      throw new Error(result.error.message);
    }
    if (!active) return;
    ++fileGeneration;
    instructions = { status: 'ready', value: result.value, error: '' };
    instructionsSource.notify();
  };
  preferenceSlot('personalizationEnabled', 'settings.section', {
    id: 'power-dsh-personalization', order: 51, locale: namespace,
    label: () => t('personalizationTab'),
  }, (props: PageSlotProps) => h(PersonalizationPage, { ...props, source, instructionsSource, loadInstructions, saveInstructions }));
  preferenceSlot('personalizationEnabled', 'settings.section.icon', { id: 'power-dsh-personalization' }, PersonalizationIcon);
  return { settings: [{ field: 'personalizationEnabled', description: 'personalizationDescription', save: next => savePreference('personalizationEnabled', next === true, 'settingsOutdated'), hideError: true }], api: { instructionsSource, loadInstructions, saveInstructions } } satisfies ClientFeature;
}

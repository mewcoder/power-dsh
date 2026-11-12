import type { KeyboardEvent } from 'react';
import { errorMessage } from './runtime.ts';
import { styles } from './shell-styles.ts';
import type { ClientFeature, ClientFeatureDefinition, ClientRuntime, FormSnapshot, PageSlotProps, PreferenceKey, PreferenceValue, SavePreference, SavingSetting, SettingContribution, SettingError, SettingsForm, SnapshotSource } from './types.ts';
interface SettingsPageProps extends PageSlotProps { source: SnapshotSource<FormSnapshot>; form: SettingsForm; version: string | null; savePreference: SavePreference; features: (ClientFeature & { definition: ClientFeatureDefinition })[]; }

export function createSettingsPage(runtime: ClientRuntime) {
  const { React, h, useSnapshot, useMounted, loadingFeedback, errorFeedback } = runtime;
  function SettingsPage({ t, source, form, version, features, close }: SettingsPageProps) {
    const snapshot = useSnapshot(source);
    const [activeTab, setActiveTab] = React.useState('general');
    const tabs = ['general', 'interface', 'enhancements', 'simplify', 'other'].map(id => ({ id }));
    const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
    const [saving, setSaving] = React.useState<SavingSetting | null>(null);
    const [error, setError] = React.useState<SettingError | null>(null);
    const pending = React.useRef(false);
    const mounted = useMounted();
    const id = React.useId();
    const ready = snapshot.status === 'ready';
    // A save in flight must not disable the whole page: only the row being saved
    // shows its busy state, and `pending` already serializes writes. Genuine
    // read-only or unavailable states still disable every control.
    const disabled = !ready || !snapshot.writable;
    const notice = !ready ? t(snapshot.status === 'loading' ? 'loading' : 'unavailable')
      : !snapshot.writable ? t('readOnly') : !version ? t('versionUnavailable') : null;
    const noticeError = snapshot.status === 'unavailable';
    async function save(field: PreferenceKey, next: PreferenceValue) {
      if (disabled || pending.current) return;
      const setting = fields.find(setting => setting.field === field);
      if (!setting || setting.canSave && !setting.canSave(next)) return;
      pending.current = true;
      setSaving({ field, value: next });
      setError(null);
      try {
        if (setting.save) await setting.save(next, { mounted });
        else if (!await form.set(field, next)) throw new Error(t('saveFailed'));
      } catch (failure) {
        if (mounted.current && !setting.hideError) setError({ field, message: errorMessage(failure) || t('saveFailed') });
      } finally {
        pending.current = false;
        if (mounted.current) setSaving(null);
      }
    }
    function selectTab(tab: string, focus = false) {
      if (saving || pending.current) return;
      setActiveTab(tab);
      if (focus) tabRefs.current[tab]?.focus();
    }
    function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
      const nextIndex = ({ ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 } as Record<string, number>)[event.key];
      if (nextIndex === undefined) return;
      event.preventDefault();
      selectTab(tabs[nextIndex].id, true);
    }
    const viewContext = { snapshot, disabled, saving, error, save, id, leaveSettings: close };
    const fields = features.flatMap(feature => feature.useSettings ? feature.useSettings(viewContext) : feature.settings || []);
    const footers = features.map(feature => feature.useSettingsFooter?.(viewContext));
    const allSettings = features.flatMap(feature => feature.settings || []);
    // Hidden operation descriptors can still be called by a feature-owned custom row.
    for (const setting of allSettings) if (!fields.some(field => field.field === setting.field)) fields.push(setting);
    function row(setting: SettingContribution) {
      if (setting.hidden) return null;
      if (setting.render) return setting.render();
      const { field, description: descriptionKey } = setting;
      const control = `${id}-${field}`;
      const busy = saving?.field === field;
      const checked = busy ? saving.value === true : snapshot.value?.[field] === true;
      const saveError = error?.field === field ? error.message : undefined;
      const failure = saveError ? undefined : setting.failure;
      const fieldError = saveError ?? failure?.message ?? setting.error;
      return h('div', { className: 'power-dsh-setting-row', key: field },
        h('div', { className: 'power-dsh-setting-copy' },
          h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t(field)),
          h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t(descriptionKey ?? '')),
          fieldError && errorFeedback({ t, id: `${control}-error`, message: fieldError,
             code: saveError ? 'PD-SETTINGS-SAVE' : failure?.code ?? 'PD-SETTINGS-RUNTIME',
             operation: failure?.operation ?? `settings.${field}`,
             context: failure?.context, observedAt: failure?.observedAt })),
        h('button', {
          id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
          'aria-checked': checked,
          'aria-labelledby': `${control}-label`, 'aria-describedby': `${control}-description${fieldError ? ` ${control}-error` : ''}`,
          'aria-invalid': Boolean(fieldError),
          'aria-busy': busy, disabled: disabled || busy,
          onClick: () => save(field, !checked),
        }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true })));
    }
    return h('section', { className: 'power-dsh-page', 'aria-label': t('title') },
      h('style', null, styles + features.map(feature => feature.styles || '').join('')),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('title')),
        h('p', { className: 'power-dsh-description' }, t('description'))),
      notice && (noticeError ? errorFeedback({ t, message: notice, code: 'PD-SETTINGS-LOAD',
        operation: 'settings.load', placement: 'page' }) : snapshot.status === 'loading'
        ? loadingFeedback({ label: notice, compact: Boolean(snapshot.value) }) : h('p', {
        className: 'power-dsh-notice', role: 'status', 'data-tone': 'neutral',
      }, notice)),
      h('div', { className: 'power-dsh-tabs', role: 'tablist', 'aria-label': t('title') },
        ...tabs.map((tab, index) => h('button', {
          id: `${id}-tab-${tab.id}`, type: 'button', role: 'tab', className: 'power-dsh-tab',
          ref: (element: HTMLButtonElement | null) => { tabRefs.current[tab.id] = element; },
          'aria-selected': activeTab === tab.id, 'aria-controls': `${id}-panel-${tab.id}`,
          tabIndex: activeTab === tab.id ? 0 : -1, 'aria-disabled': Boolean(saving) || undefined,
          onClick: () => selectTab(tab.id), onKeyDown: event => onTabKeyDown(event, index),
        }, t(`${tab.id}Tab`)))),
      h('div', {
        id: `${id}-panel-${activeTab}`, className: 'power-dsh-fields', role: 'tabpanel',
        'aria-labelledby': `${id}-tab-${activeTab}`,
      }, ...fields.filter(field => field.category === activeTab).map(row)), ...footers);
  }
  return SettingsPage;
}

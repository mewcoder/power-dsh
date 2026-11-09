import type { ClientContext, Dispose, Listener, PreferenceKey, PreferenceValue, SavePreference, SettingsForm, SlotComponent, SlotOptions, Translate } from './types.ts';
export function createSettingsForm(ctx: ClientContext, namespace: string): SettingsForm {
  const canonicalForm = ctx.configForms.get(namespace);
  // Existing managed installs keep their legacy entry ID; never migrate preferences here.
  // get() returns cached controllers even for missing IDs; use snapshot availability.
  const legacyForms = ['dsh-x-mod', 'dsh-mod'].map(id => ctx.configForms.get(id));
  const selectedForm = () => canonicalForm.getSnapshot().status !== 'unavailable' ? canonicalForm
    : legacyForms.find(candidate => candidate.getSnapshot().status !== 'unavailable') ?? canonicalForm;
  const form = {
    getSnapshot: () => selectedForm().getSnapshot(),
    set: (field: PreferenceKey, value: PreferenceValue) => selectedForm().set(field, value),
    subscribe(listener: Listener) {
      const unsubscribe = [canonicalForm, ...legacyForms].map(candidate => candidate.subscribe(listener));
      return () => unsubscribe.forEach(off => off());
    },
  };
  return form;
}

export function createPreferenceSaver(ctx: ClientContext, form: SettingsForm, t: Translate): SavePreference {
  return async (field, value, unavailable = 'settingsOutdated', type = 'boolean') => {
    await ctx.configForms.describe().load();
    if (typeof form.getSnapshot().value?.[field] !== type) throw new Error(t(unavailable));
    if (!await form.set(field, value)) throw new Error(t('saveFailed'));
  };
}

export function preferenceSlot(ctx: ClientContext, form: SettingsForm, field: PreferenceKey, name: string, options: SlotOptions, component: SlotComponent) {
  ctx.slots.inject(name, () => {
    let release: Dispose | null = null;
    const sync = () => {
      const snapshot = form.getSnapshot();
      const enabled = snapshot.status === 'ready' && snapshot.value?.[field] === true;
      if (enabled && !release) release = ctx.slots.register({ name, ...options }, component);
      else if (!enabled && release) { release(); release = null; }
    };
    sync();
    const unsubscribe = form.subscribe(sync);
    return () => { unsubscribe(); release?.(); };
  });
}

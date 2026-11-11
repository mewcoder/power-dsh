import { createRuntime } from '../shared/client/runtime.ts';
import { createPreferenceSaver, createSettingsForm, preferenceSlot as registerPreferenceSlot } from '../shared/client/settings-form.ts';
import { createSettingsPage } from '../shared/client/settings-shell.ts';
import { createHeaderActions } from '../shared/client/sidebar-shell.ts';
import { createFooterBusySource } from '../shared/client/footer-availability.ts';
import type { ClientContext, ClientEnvironment, ClientFeatureSelection, IconProps, Listener, PageSlotProps, PreferenceKey, PublicPrimitives, ReactModule, SlotProps } from '../shared/client/types.ts';
import { clientFeatures } from './client-features.ts';
import { featureDictionaries } from './locales.ts';
import { MOD_RPC, composeRpc } from './rpc.ts';

export function createClient(React: ReactModule, primitives: PublicPrimitives, selectedFeatures: readonly ClientFeatureSelection[] = clientFeatures) {
  const runtime = createRuntime(React, primitives);
  const { h } = runtime;
  const SettingsPage = createSettingsPage(runtime);
  const HeaderActions = createHeaderActions(runtime);
  const dictionaries = featureDictionaries(selectedFeatures);
  const selectedRpc = composeRpc(selectedFeatures.flatMap(feature => feature.rpc));
  const rpcIds = new Set(selectedRpc.map(descriptor => descriptor.id));
  const descriptors = MOD_RPC.filter(descriptor => rpcIds.has(descriptor.id));
  if (descriptors.length !== selectedRpc.length) throw new Error('Unregistered Client RPC contribution');
  // Lucide Puzzle, ISC licensed; see docs/third-party-notices.md.
  function Icon({ size = 16 }: IconProps) {
    return h('svg', {
      viewBox: '0 0 24 24', width: size, height: size,
      fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', {
      d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z',
    }));
  }
  return {
    inject: ['slots', 'locale', 'configForms', 'remote', 'typert'],
    async apply(ctx: ClientContext) {
      await ctx.remote.$mount({ package: 'power-dsh', descriptors });
      // The mount creates this namespace before its child declares the dependency.
      ctx.inject(descriptors.length ? ['remote.powerDsh'] : [], ctx => {
        const namespace = 'power-dsh';
        for (const [language, dictionary] of Object.entries(dictionaries)) ctx.effect(() => ctx.locale.register(namespace, language, dictionary));
        const t = ctx.locale.bind(namespace);
        const form = createSettingsForm(ctx, namespace);
        const source = { subscribe: (listener: Listener) => form.subscribe(listener), getSnapshot: () => form.getSnapshot() };
        const rawVersion = window.__DSH_BOOT__?.release?.version;
        const version = typeof rawVersion === 'string' && rawVersion.trim() ? rawVersion.trim() : null;
        const savePreference = createPreferenceSaver(ctx, form, t);
        const preferenceSlot: ClientEnvironment['preferenceSlot'] = (field, name, options, component) => registerPreferenceSlot(ctx, form, field, name, options, component);
        let footerBusy: ClientEnvironment['footerBusy'] | undefined;
        const ids = new Set();
        const fields = new Set<PreferenceKey>();
        const features = [...selectedFeatures].sort((a, b) => a.definition.order - b.definition.order).map(({ definition, create }) => {
          if (ids.has(definition.id)) throw new Error(`Duplicate Client feature: ${definition.id}`);
          ids.add(definition.id);
          const feature = create(runtime, { ctx, form, source, t, version, namespace, savePreference, preferenceSlot,
            get footerBusy() { return footerBusy ??= createFooterBusySource(ctx, runtime.observable); },
          });
          for (const setting of feature.settings || []) {
            if (fields.has(setting.field)) throw new Error(`Duplicate Client setting: ${setting.field}`);
            if (!definition.keys.includes(setting.field)) throw new Error(`Unowned Client setting: ${setting.field}`);
            fields.add(setting.field);
            setting.category = definition.category === 'enhance' ? 'enhancements' : definition.category;
          }
          return { ...feature, definition };
        });
        const api = features.reduce<Record<string, unknown>>((result, feature) => ({ ...result, ...feature.api }), {});
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: namespace, order: 50, locale: namespace, label: () => t('title'),
        }, (props: PageSlotProps) => h(SettingsPage, { ...props, source, form, version, savePreference, features, ...api })));
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({ name: 'settings.section.icon', id: namespace }, Icon));
        const sidebar = features.filter(feature => feature.sidebar);
        const actions = features.flatMap(feature => feature.headerAction ? [feature.headerAction] : []);
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'power-dsh-footer', order: 50, locale: namespace,
        }, (props: SlotProps) => h('span', {
          className: 'power-dsh-footer-seat',
          style: { display: 'block', flex: '1 1 100%', minWidth: 0, width: '100%', height: 0, alignSelf: 'flex-end' },
        }, ...sidebar.map(feature => feature.sidebar!(props)), h(HeaderActions, { ...props, source, actions }))));
      });
    },
  };
}

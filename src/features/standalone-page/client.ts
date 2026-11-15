import { styles } from './styles.ts';
import type { ClientEnvironment, ClientFeature, ClientPageContribution, ClientRuntime, FormSnapshot, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';

export const STANDALONE_PANEL_ID = 'power-dsh';
export const STANDALONE_PANEL_ORDER = 2;

export interface StandalonePageOptions {
  source: SnapshotSource<FormSnapshot>;
  pages: readonly ClientPageContribution[];
}

// Lucide Puzzle, ISC licensed; see docs/third-party-notices.md.
export function createStandalonePanelIcon(runtime: ClientRuntime) {
  const { h } = runtime;
  return function StandalonePanelIcon({ size = 16 }: { size?: number; active?: boolean }) {
    return h('svg', {
      viewBox: '0 0 24 24', width: size, height: size,
      fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', {
      d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.014 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z',
    }));
  };
}

export function createStandalonePage(runtime: ClientRuntime, options: StandalonePageOptions) {
  const { React, h, useSnapshot, SegmentedTabs } = runtime;
  let selectedPageId = '';
  return function StandalonePage({ t, close }: PageSlotProps) {
    const snapshot = useSnapshot(options.source);
    const pages = options.pages.filter(page => page.available(snapshot));
    const tabs = pages.map(page => ({ id: page.id, label: page.label, icon: page.icon }));
    const [requestedTab, setRequestedTab] = React.useState(selectedPageId);
    const activePage = pages.find(page => page.id === requestedTab) ?? pages[0] ?? null;
    const activeTab = activePage?.id ?? '';
    const [sideNavigation, setSideNavigation] = React.useState(false);
    const rootRef = React.useRef<HTMLElement | null>(null);
    const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
    const stripRef = React.useRef<HTMLDivElement | null>(null);
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const id = React.useId();
    React.useEffect(() => {
      const root = rootRef.current;
      if (!root || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(entries => {
        const entry = entries.find(candidate => candidate.target === root);
        if (entry) setSideNavigation(entry.contentRect.width >= 960);
      });
      observer.observe(root);
      return () => observer.disconnect();
    }, []);
    React.useEffect(() => {
      selectedPageId = activeTab;
      if (requestedTab !== activeTab) setRequestedTab(activeTab);
    }, [activeTab, requestedTab]);
    React.useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [activeTab]);
    React.useEffect(() => {
      const selected = tabRefs.current[activeTab] ?? stripRef.current?.querySelector?.<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      selected?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [activeTab, sideNavigation]);
    function selectTab(tab: string, focus = false) {
      if (!tabs.some(candidate => candidate.id === tab)) return;
      setRequestedTab(tab);
      if (focus) tabRefs.current[tab]?.focus();
    }
    function onTabKeyDown(event: import('react').KeyboardEvent<HTMLButtonElement>, index: number) {
      const previous = (index + tabs.length - 1) % tabs.length;
      const next = (index + 1) % tabs.length;
      const nextIndex = ({ ArrowLeft: previous, ArrowRight: next, ...(sideNavigation ? { ArrowUp: previous, ArrowDown: next } : {}), Home: 0, End: tabs.length - 1 } as Record<string, number>)[event.key];
      if (nextIndex === undefined) return;
      event.preventDefault();
      selectTab(tabs[nextIndex].id, true);
    }
    const panelId = `${id}-panel-${activeTab}`;
    const tabLabel = (tab: typeof tabs[number]) => h('span', { className: 'power-dsh-standalone-tab-label' },
      h(tab.icon, { size: 16 }), h('span', { className: 'power-dsh-standalone-tab-text' }, t(tab.label)));
    const items = tabs.map(tab => ({ value: tab.id, label: tabLabel(tab), id: `${id}-tab-${tab.id}`, panelId: `${id}-panel-${tab.id}` }));
    return h('section', { className: 'power-dsh-standalone', 'aria-label': t('title'), ref: rootRef, 'data-navigation': sideNavigation ? 'side' : 'top', 'data-page': activeTab },
      h('style', null, styles),
      h('div', { className: 'power-dsh-standalone-layout' },
      h('div', { className: 'power-dsh-standalone-topbar' },
        h('div', { className: 'power-dsh-standalone-inner power-dsh-standalone-navigation' },
        items.length > 0 && h('div', { className: 'power-dsh-standalone-tab-strip', ref: stripRef },
          SegmentedTabs && !sideNavigation ? h(SegmentedTabs, {
            items: [items[0], ...items.slice(1)], value: activeTab, onChange: selectTab,
            label: t('title'), className: 'power-dsh-standalone-native-tabs',
          }) : h('div', {
            className: 'power-dsh-standalone-tabs', role: 'tablist', 'aria-label': t('title'),
            'aria-orientation': sideNavigation ? 'vertical' : 'horizontal',
            style: { gridTemplateColumns: sideNavigation ? 'minmax(0,1fr)' : `repeat(${tabs.length},minmax(0,1fr))` },
          },
          ...tabs.map((tab, index) => h('button', {
            id: `${id}-tab-${tab.id}`, type: 'button', role: 'tab', className: 'power-dsh-standalone-tab',
            ref: (element: HTMLButtonElement | null) => { tabRefs.current[tab.id] = element; },
            'aria-selected': activeTab === tab.id, 'aria-controls': `${id}-panel-${tab.id}`,
            tabIndex: activeTab === tab.id ? 0 : -1,
            onClick: () => selectTab(tab.id), onKeyDown: event => onTabKeyDown(event, index),
          }, tabLabel(tab))))))),
      h('div', { className: 'power-dsh-standalone-scroll', ref: scrollRef },
        activePage ? h('div', { id: panelId, className: 'power-dsh-standalone-inner power-dsh-standalone-panel', role: 'tabpanel', 'aria-labelledby': `${id}-tab-${activeTab}` },
          activePage.render({ t, close })) : h('div', { className: 'power-dsh-standalone-empty' },
          h('p', null, t('standaloneEmpty')),
          h('p', null, t('standaloneEmptyHint'))))));
  };
}

export function createClientFeature(_runtime: ClientRuntime, _env: ClientEnvironment) {
  return {
    settings: [{ field: 'standalonePageEnabled', description: 'standalonePageDescription' }],
  } satisfies ClientFeature;
}

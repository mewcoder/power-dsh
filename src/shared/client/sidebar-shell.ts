import { styles } from './sidebar-styles.ts';
import type { ClientFeature, ClientRuntime, FormSnapshot, SlotProps, SnapshotSource } from './types.ts';
interface HeaderActionsProps extends SlotProps { source: SnapshotSource<FormSnapshot>; actions: NonNullable<ClientFeature['headerAction']>[]; }

export function createHeaderActions(runtime: ClientRuntime) {
  const { React, h, Menu, useMounted, NativeIcon, errorFeedback } = runtime;
  function useHeaderPosition(visible: boolean, offset = 0) {
    const [position, setPosition] = React.useState<number | null>(null);
    const seat = React.useRef<HTMLSpanElement | null>(null);
    React.useLayoutEffect(() => {
      if (!visible || !seat.current) return;
      const element = seat.current;
      const measure = () => {
        const windows = document.documentElement.hasAttribute('data-windows-titlebar');
        // The Windows toggle starts at 12px and occupies 28px; leave a 4px gap.
        const next = windows ? 44 : Math.max(8, element.getBoundingClientRect().right - 60 - offset);
        setPosition(previous => previous === next ? previous : next);
      };
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
      observer?.observe(element);
      const chromeObserver = typeof MutationObserver === 'function' ? new MutationObserver(measure) : null;
      chromeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-windows-titlebar'] });
      measure();
      window.addEventListener('resize', measure);
      window.visualViewport?.addEventListener('resize', measure);
      return () => {
        observer?.disconnect();
        chromeObserver?.disconnect();
        window.removeEventListener('resize', measure);
        window.visualViewport?.removeEventListener('resize', measure);
      };
    }, [visible, offset]);
    return { seat, position };
  }
  function HeaderActions({ wide, source, t, actions }: HeaderActionsProps) {
    const latestWide = React.useRef(wide);
    latestWide.current = wide;
    const mounted = useMounted();
    const contributions = actions.map(action => action({ wide, latestWide, mounted, source, t }));
    const visibleActions = contributions.filter(action => action.visible);
    const visible = visibleActions.length > 0;
    const { seat, position } = useHeaderPosition(visible);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const menuRequest = React.useRef<object | false>(false);
    const closeMenu = () => { menuRequest.current = false; setMenuOpen(false); };
    React.useEffect(() => { closeMenu(); }, contributions.flatMap(action => [action.visible, action.disabled]));
    React.useEffect(() => { if (position === null) closeMenu(); }, [position]);
    const menu = menuRequest.current;
    const select = (id: string) => {
      if (!menu || menuRequest.current !== menu || !mounted.current || !latestWide.current) return;
      closeMenu();
      const action = contributions.find(action => action.id === id);
      if (action?.canUse()) action.select();
    };
    if (!visible) return null;
    const message = visibleActions.find(action => action.error)?.error;
    return h('span', { className: 'power-dsh-header-seat', ref: seat },
      h('style', null, styles),
      h('span', { className: 'power-dsh-header-menu', style: position === null ? { visibility: 'hidden' } : { left: position } },
        h(Menu, { open: menuOpen && position !== null, onClose: closeMenu, onSelect: select,
          align: 'end', portal: true, autoFocus: true,
          items: visibleActions.map(({ id, label, disabled }) => ({ id, label, ...(disabled ? { disabled } : {}) })),
          anchor: h('button', { type: 'button', className: 'power-dsh-header-button',
            title: t('moreActions'), 'aria-label': t('moreActions'), 'aria-haspopup': 'menu', 'aria-expanded': menuOpen && position !== null,
            onClick: event => {
              event.stopPropagation();
              if (position === null || !mounted.current || !latestWide.current || contributions.some(action => action.isConfirming?.())) return;
              if (menuRequest.current) closeMenu(); else { menuRequest.current = {}; setMenuOpen(true); }
            },
          }, h(NativeIcon, { glyph: 'ellipsis-outline' })),
        })),
      message && errorFeedback({ t, message, code: 'PD-HEADER-ACTION', operation: visibleActions.find(action => action.error)!.id,
        placement: 'compact', className: 'power-dsh-header-error',
        style: position === null ? { visibility: 'hidden' } : { left: Math.max(8, position - 200) } }),
      ...contributions.map(action => action.dialog));
  }
  return HeaderActions;
}

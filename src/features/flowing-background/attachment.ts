import { startAnimation } from './animation.ts';
import { styles } from './styles.ts';

export type AttachmentStatus = 'attached' | 'unavailable';
interface NativeClasses { frame: string; sidebarCol: string; centerCol: string; sidebarRoot: string; scrollFade: string | null; }

/** CSS-module hashes differ between npm and Desktop builds of the same version. */
function nativeClasses(doc: Document): NativeClasses | null {
  const read = (module: string, name: string) => {
    const sheets = doc.querySelectorAll<HTMLStyleElement>(`style[data-plugin-css="${module}"]`);
    if (sheets.length !== 1) return null;
    const pattern = new RegExp(`\\.([A-Za-z0-9_-]+_${name})(?![A-Za-z0-9_-])`, 'g');
    const names = [...new Set([...(sheets[0].textContent ?? '').matchAll(pattern)].map(match => match[1]))];
    return names.length === 1 ? names[0] : null;
  };
  const layout = '@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css';
  const frame = read(layout, 'frame');
  const sidebarCol = read(layout, 'sidebarCol');
  const centerCol = read(layout, 'centerCol');
  const sidebarRoot = read('@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css', 'root');
  const scrollFade = read('@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css', 'scrollFade');
  return frame && sidebarCol && centerCol && sidebarRoot
    ? { frame, sidebarCol, centerCol, sidebarRoot, scrollFade } : null;
}

/** Restore a declaration only while it still belongs to this attachment. */
function change(element: HTMLElement, property: string, value: string, priority = 'important') {
  const before = element.style.getPropertyValue(property);
  const beforePriority = element.style.getPropertyPriority(property);
  element.style.setProperty(property, value, priority);
  return () => {
    if (element.style.getPropertyValue(property) !== value
      || element.style.getPropertyPriority(property) !== priority) return;
    if (before) element.style.setProperty(property, before, beforePriority);
    else element.style.removeProperty(property);
  };
}

/** User-requested global preview: one canvas underneath the verified app frame. */
export function watchBackground(
  report: (status: AttachmentStatus) => void,
  doc: Document = document,
  win: Window & typeof globalThis = window,
  animate = startAnimation,
): () => void {
  let current: { target: HTMLElement; layer: HTMLDivElement; refresh(classes: NativeClasses): void; dispose(): void } | null = null;
  let disposed = false;
  let failedTarget: HTMLElement | null = null;
  const frames = (classes: NativeClasses) => [...new Set([...doc.querySelectorAll<HTMLElement>('[data-shell-overlay]')]
    .map(overlay => overlay.parentElement).filter((target): target is HTMLElement => target !== null
      && target.isConnected && target.clientWidth > 0 && target.clientHeight > 0
      && win.getComputedStyle(target).position === 'relative'
      && win.getComputedStyle(target).display === 'grid'
      && target.querySelector(':scope > [data-shell-bottom]') !== null
      && target.querySelector(':scope > [data-rightbar-col]') !== null
      && target.matches(`.${classes.frame}`)
      && target.querySelector(`:scope > .${classes.sidebarCol}`) !== null
      && target.querySelector(`:scope > .${classes.centerCol}`) !== null))];
  const clear = () => { current?.dispose(); current = null; };
  const sync = () => {
    if (disposed) return;
    const classes = nativeClasses(doc);
    const candidates = classes ? frames(classes) : [];
    const target = candidates.length === 1 ? candidates[0] : null;
    if (current?.target === target && current?.layer.parentElement === target) {
      try {
        if (!target || !classes || win.getComputedStyle(target).isolation !== 'isolate') throw new Error('Frame changed');
        current.refresh(classes);
        return;
      } catch {
        clear(); failedTarget = target; report('unavailable'); return;
      }
    }
    if (target && target === failedTarget) return;
    failedTarget = null;
    clear();
    if (!target || !classes) { report('unavailable'); return; }
    const restores: Array<() => void> = [];
    const surfaces = new Map<HTMLElement, () => void>();
    const fades = new Map<HTMLElement, () => void>();
    const refresh = (names: NativeClasses) => {
      // Scope Windows chrome overrides to the verified frame owning this layer.
      const css = `${styles}
html[data-windows-titlebar] .${names.frame}:has(> .power-dsh-flowing-background)::before { background: transparent !important; }
html[data-windows-titlebar] .${names.frame}:not([data-sidebar-drawer]):has(> .power-dsh-flowing-background) > .${names.sidebarCol} { border-right: 0.5px solid var(--dsw-alias-border-l3) !important; }`;
      if (sheet.textContent !== css) sheet.textContent = css;
      // Some released builds omit this decoration; it must not gate the background.
      const nextFades = new Set(names.scrollFade
        ? [...target.querySelectorAll<HTMLElement>(`.${names.sidebarRoot}`)]
          .flatMap(root => [...root.querySelectorAll<HTMLElement>(`.${names.scrollFade}[aria-hidden="true"]`)])
        : []);
      for (const [element, restore] of fades) {
        if (!nextFades.has(element)) { restore(); fades.delete(element); }
      }
      for (const element of nextFades) {
        if (!fades.has(element)) fades.set(element, change(element, 'display', 'none'));
      }
      const drawer = target.hasAttribute('data-sidebar-drawer');
      const selectors = `.${names.sidebarCol}, .${names.centerCol}, .${names.sidebarRoot}`;
      const next = new Set([...target.querySelectorAll<HTMLElement>(selectors)].filter(element =>
        !drawer || !element.matches(`.${names.sidebarCol}, .${names.sidebarRoot}`)));
      for (const content of target.querySelectorAll<HTMLElement>('[data-conversation-content]')) {
        const root = content.parentElement;
        if (!root?.matches('[data-phase]')) continue;
        next.add(root);
        // The seat's bg-base fade otherwise paints a solid rectangle around the card.
        for (const seat of content.querySelectorAll<HTMLElement>('[data-composer-seat][data-conversation-region="composer"]')) next.add(seat);
      }
      for (const [element, restore] of surfaces) {
        if (!next.has(element)) { restore(); surfaces.delete(element); }
      }
      for (const element of next) {
        if (surfaces.has(element)) continue;
        const color = change(element, 'background-color', 'transparent');
        const image = change(element, 'background-image', 'none');
        surfaces.set(element, () => { image(); color(); });
      }
    };
    const layer = doc.createElement('div');
    layer.className = 'power-dsh-flowing-background';
    layer.setAttribute('aria-hidden', 'true');
    const sheet = doc.createElement('style');
    sheet.textContent = styles;
    const canvas = doc.createElement('canvas');
    layer.append(sheet, canvas);
    let stop = () => {};
    const dispose = () => {
      stop(); layer.remove();
      for (const restore of surfaces.values()) restore();
      surfaces.clear();
      for (const restore of fades.values()) restore();
      fades.clear();
      restores.reverse().forEach(restore => restore());
    };
    try {
      restores.push(change(target, 'isolation', 'isolate', ''));
      restores.push(change(target, 'background-color', 'var(--dsw-alias-bg-base)'));
      refresh(classes);
      target.appendChild(layer);
      stop = animate(canvas, win, doc, target);
      current = { target, layer, refresh, dispose };
      report('attached');
    } catch {
      // Partial attachment never leaves a front layer or a retry driven by rollback mutations.
      dispose(); failedTarget = target; report('unavailable');
    }
  };
  if (!doc.body || typeof win.MutationObserver !== 'function') {
    report('unavailable'); return () => {};
  }
  const observer = new win.MutationObserver(sync);
  if (doc.head) observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-phase', 'data-shell-overlay', 'data-shell-bottom', 'data-rightbar-col', 'data-sidebar-drawer', 'hidden', 'class', 'style'] });
  sync();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    clear();
  };
}

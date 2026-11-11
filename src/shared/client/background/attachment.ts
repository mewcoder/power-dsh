import { startAnimation } from './animation.ts';
import { styles } from './styles.ts';

interface FailureResults {
  styles: 'missing' | 'ambiguous';
  frame: 'missing' | 'ambiguous' | 'hidden' | 'unsupported' | 'changed';
  initialization: 'failed';
  environment: 'missing' | 'unsupported';
}
export type AttachmentFailure<S extends keyof FailureResults = keyof FailureResults> = {
  [K in S]: {
    state: 'unavailable'; stage: K; result: FailureResults[K];
    check: string; expected?: string; actual?: string;
  }
}[S];
export type AttachmentStatus = { state: 'attached' } | AttachmentFailure;
interface WorkspaceFadeClasses { root: string; body: string; fade: string; }
interface NativeClasses {
  frame: string; sidebarCol: string; centerCol: string; sidebarRoot: string;
  scrollFade: string | null; workspaceFade: WorkspaceFadeClasses | null;
}
const nativeStylesheets = {
  layout: '@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css',
  sidebar: '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css',
  workspace: '@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css',
} as const;
const failure = <S extends keyof FailureResults>(stage: S, check: string, result: FailureResults[S],
  expected?: string, actual?: string) =>
  ({ state: 'unavailable' as const, stage, check, result, ...(expected === undefined ? {} : { expected, actual }) });

/** CSS-module hashes differ between npm and Desktop builds of the same version. */
function nativeClasses(doc: Document): { classes: NativeClasses; failure?: never } | { classes: null; failure: AttachmentFailure } {
  let issue: AttachmentFailure | null = null;
  const read = (owner: keyof typeof nativeStylesheets, name: string, required = true) => {
    const module = nativeStylesheets[owner];
    const sheets = doc.querySelectorAll<HTMLStyleElement>(`style[data-plugin-css="${module}"]`);
    if (sheets.length !== 1) {
      if (required) issue ??= failure('styles', `${owner}.stylesheet`, sheets.length ? 'ambiguous' : 'missing', '1', String(sheets.length));
      return null;
    }
    const pattern = new RegExp(`\\.([A-Za-z0-9_-]+_${name})(?![A-Za-z0-9_-])`, 'g');
    const names = [...new Set([...(sheets[0].textContent ?? '').matchAll(pattern)].map(match => match[1]))];
    if (names.length === 1) return names[0];
    if (required) issue ??= failure('styles', `${owner}.${name}`, names.length ? 'ambiguous' : 'missing', '1', String(names.length));
    return null;
  };
  const frame = read('layout', 'frame');
  const sidebarCol = read('layout', 'sidebarCol');
  const centerCol = read('layout', 'centerCol');
  const sidebarRoot = read('sidebar', 'root');
  const scrollFade = read('sidebar', 'scrollFade', false);
  const workspaceRoot = read('workspace', 'root', false);
  const workspaceBody = read('workspace', 'treeBody', false);
  const fade = read('workspace', 'fade', false);
  const workspaceFade = workspaceRoot && workspaceBody && fade
    ? { root: workspaceRoot, body: workspaceBody, fade } : null;
  return frame && sidebarCol && centerCol && sidebarRoot
    ? { classes: { frame, sidebarCol, centerCol, sidebarRoot, scrollFade, workspaceFade } }
    : { classes: null, failure: issue! };
}

/** Restore a declaration only while it still belongs to this attachment. */
function ownStyle(element: HTMLElement, property: string, value: string, priority = 'important') {
  const before = element.style.getPropertyValue(property);
  const beforePriority = element.style.getPropertyPriority(property);
  let owned = true;
  const stillOwned = () => owned && element.style.getPropertyValue(property) === value
    && element.style.getPropertyPriority(property) === priority;
  element.style.setProperty(property, value, priority);
  return {
    update(next: string) {
      if (!stillOwned()) { owned = false; return; }
      if (next === value) return;
      element.style.setProperty(property, next, priority);
      value = next;
    },
    restore() {
      if (!stillOwned()) return;
      owned = false;
      if (before) element.style.setProperty(property, before, beforePriority);
      else element.style.removeProperty(property);
    },
  };
}

function change(element: HTMLElement, property: string, value: string, priority = 'important') {
  return ownStyle(element, property, value, priority).restore;
}

/** User-requested global preview: one canvas underneath the verified app frame. */
export interface BackgroundAppearance {
  opacity: number;
  blur: number;
  /** A user wallpaper replaces the animated pattern when present. */
  wallpaper?: { dataUrl: string; name: string } | null;
}

/** Restyle only owned media; wallpaper mixes with the current theme beneath a veil. */
export function applyAppearance(layer: HTMLElement, appearance: Pick<BackgroundAppearance, 'opacity' | 'blur'>) {
  const visibility = Math.min(100, Math.max(0, Number.isFinite(appearance.opacity) ? appearance.opacity : 100));
  const alpha = visibility / 100;
  const wallpaper = layer.matches('[data-kind="wallpaper"]');
  const opacity = !wallpaper && alpha < 1 ? String(alpha) : '';
  if (layer.style.getPropertyValue('opacity') !== opacity) {
    if (opacity) layer.style.setProperty('opacity', opacity);
    else layer.style.removeProperty('opacity');
  }
  const veil = layer.querySelector<HTMLElement>('.power-dsh-wallpaper-veil');
  if (veil) {
    const veilOpacity = String((100 - visibility) / 100);
    if (veil.style.getPropertyValue('opacity') !== veilOpacity) veil.style.setProperty('opacity', veilOpacity);
  }
  const savedBlur = Math.min(wallpaper ? 20 : 40, Math.max(0, Number.isFinite(appearance.blur) ? appearance.blur : 0));
  // A hidden wallpaper retains its saved blur but does no actual filter work.
  const blur = wallpaper && alpha === 0 ? 0 : savedBlur;
  const artwork = layer.querySelector<HTMLElement>('.power-dsh-artwork');
  if (!artwork) return;
  // Wallpaper may crop slightly as its media expands by three radii before
  // clipping. The flowing pattern retains its original geometry at every blur.
  const overscan = wallpaper && blur > 0 ? 3 * blur : 0;
  const declarations = {
    filter: blur > 0 ? `blur(${blur}px)` : '',
    position: overscan ? 'absolute' : '',
    inset: overscan ? `-${overscan}px` : '',
    width: overscan ? `calc(100% + ${2 * overscan}px)` : '',
    height: overscan ? `calc(100% + ${2 * overscan}px)` : '',
  };
  for (const [property, value] of Object.entries(declarations)) {
    if (artwork.style.getPropertyValue(property) === value) continue;
    if (value) artwork.style.setProperty(property, value);
    else artwork.style.removeProperty(property);
  }
}

export function watchBackground(
  report: (status: AttachmentStatus) => void,
  doc: Document = document,
  win: Window & typeof globalThis = window,
  animate = startAnimation,
  appearance: BackgroundAppearance = { opacity: 100, blur: 0 },
  /** Re-read on every sync so live sliders restyle the owned layer in place. */
  readAppearance?: () => BackgroundAppearance,
  subscribeAppearance?: (listener: () => void) => () => void,
): () => void {
  let current: { target: HTMLElement; layer: HTMLDivElement; refresh(classes: NativeClasses): void; dispose(): void } | null = null;
  let disposed = false;
  let failedTarget: HTMLElement | null = null;
  const findFrame = (classes: NativeClasses): { target: HTMLElement; failure?: never } | { target: null; failure: AttachmentFailure } => {
    const roots = [...new Set([...doc.querySelectorAll<HTMLElement>('[data-shell-overlay]')]
      .map(overlay => overlay.parentElement).filter((target): target is HTMLElement => target !== null
        && target.isConnected && target.matches(`.${classes.frame}`)))];
    const visible = roots.filter(target => target.clientWidth > 0 && target.clientHeight > 0);
    if (visible.length !== 1) return { target: null, failure: failure('frame', 'app-frame',
      visible.length > 1 ? 'ambiguous' : roots.length ? 'hidden' : 'missing', '1 visible frame', String(visible.length)) };
    const target = visible[0];
    const computed = win.getComputedStyle(target);
    if (computed.position !== 'relative') return { target: null, failure: failure('frame', 'frame.position', 'unsupported', 'relative', ['static', 'absolute', 'fixed', 'sticky'].includes(computed.position) ? computed.position : 'other') };
    if (computed.display !== 'grid') return { target: null, failure: failure('frame', 'frame.display', 'unsupported', 'grid', ['flex', 'block', 'none', 'inline', 'contents'].includes(computed.display) ? computed.display : 'other') };
    for (const [check, selector] of [
      ['frame.bottom', '[data-shell-bottom]'], ['frame.rightbar', '[data-rightbar-col]'],
      ['frame.sidebar', `.${classes.sidebarCol}`], ['frame.center', `.${classes.centerCol}`],
    ]) {
      if (!target.querySelector(`:scope > ${selector}`)) return { target: null, failure: failure('frame', check, 'missing', '1 direct child', '0') };
    }
    return { target };
  };
  const clear = () => { current?.dispose(); current = null; };
  /**
   * A global main panel (plugin manager, workspace, usage and similar) replaces
   * the conversation in the centre column. The host marks it with
   * `data-global-panel` on that column's panel wrapper. The artwork stays mounted
   * so the sidebar keeps its background; only the centre returns to the native
   * opaque surface so the page itself reads normally.
   */
  const centerHasGlobalPanel = (element: HTMLElement, names: NativeClasses) => {
    const center = element.querySelector<HTMLElement>(`:scope > .${names.centerCol}`);
    return center !== null && center.querySelector('[data-global-panel]') !== null;
  };
  const sync = () => {
    if (disposed) return;
    const mapping = nativeClasses(doc);
    if (!mapping.classes) { clear(); failedTarget = null; report(mapping.failure); return; }
    const classes = mapping.classes;
    const frame = findFrame(classes);
    if (!frame.target) { clear(); failedTarget = null; report(frame.failure); return; }
    const target = frame.target;
    if (current?.target === target && current.layer.parentElement === target) {
      if (win.getComputedStyle(target).isolation !== 'isolate') {
        clear(); failedTarget = target; report(failure('frame', 'frame.isolation', 'changed', 'isolate', 'not isolated')); return;
      }
      try {
        current.refresh(classes);
        return;
      } catch {
        clear(); failedTarget = target; report(failure('initialization', 'attachment.refresh', 'failed', 'completed', 'exception')); return;
      }
    }
    if (target === failedTarget) return;
    failedTarget = null;
    clear();
    const restores: Array<() => void> = [];
    const surfaces = new Map<HTMLElement, { color: ReturnType<typeof ownStyle>; restoreImage(): void }>();
    const fades = new Map<HTMLElement, () => void>();
    const refresh = (names: NativeClasses) => {
      if (readAppearance) applyAppearance(layer, readAppearance());
      // Scope Windows chrome overrides to the verified frame owning this layer.
      const css = `${styles}
html[data-windows-titlebar] .${names.frame}:has(> .power-dsh-flowing-background)::before { background: transparent !important; }
html[data-windows-titlebar] .${names.frame}:not([data-sidebar-drawer]):has(> .power-dsh-flowing-background) > .${names.sidebarCol} { border-right: 0.5px solid var(--dsw-alias-border-l3) !important; }`;
      if (sheet.textContent !== css) sheet.textContent = css;
      // Released builds place the bottom fade in either the shell or the workspace list.
      const nextFades = new Set<HTMLElement>();
      for (const sidebar of target.querySelectorAll<HTMLElement>(`.${names.sidebarRoot}`)) {
        if (names.scrollFade) {
          for (const fade of sidebar.querySelectorAll<HTMLElement>(`.${names.scrollFade}[aria-hidden="true"]`)) nextFades.add(fade);
        }
        const workspace = names.workspaceFade;
        if (!workspace) continue;
        for (const root of sidebar.querySelectorAll<HTMLElement>(`.${workspace.root}`)) {
          for (const body of root.querySelectorAll<HTMLElement>(`.${workspace.body}`)) {
            for (const fade of body.querySelectorAll<HTMLElement>(`:scope > .${workspace.fade}`)) {
              if (fade.tagName.toLowerCase() === 'span') nextFades.add(fade);
            }
          }
        }
      }
      for (const [element, restore] of fades) {
        if (!nextFades.has(element)) { restore(); fades.delete(element); }
      }
      for (const element of nextFades) {
        if (!fades.has(element)) fades.set(element, change(element, 'display', 'none'));
      }
      const drawer = target.hasAttribute('data-sidebar-drawer');
      const selectors = `.${names.sidebarCol}, .${names.centerCol}, .${names.sidebarRoot}`;
      const next = new Map([...target.querySelectorAll<HTMLElement>(selectors)]
        .filter(element => !drawer || !element.matches(`.${names.sidebarCol}, .${names.sidebarRoot}`))
        .map(element => [element, 'transparent']));
      // Web and Linux centre columns have no native fill of their own. Paint the
      // theme base while a global panel is present, keeping the sidebar artwork.
      if (centerHasGlobalPanel(target, names)) {
        for (const element of next.keys()) {
          if (element.matches(`.${names.centerCol}`)) next.set(element, 'var(--dsw-alias-bg-base)');
        }
      }
      for (const content of target.querySelectorAll<HTMLElement>('[data-conversation-content]')) {
        const root = content.parentElement;
        if (!root?.matches('[data-phase]')) continue;
        next.set(root, 'transparent');
        // The seat's bg-base fade otherwise paints a solid rectangle around the card.
        for (const seat of content.querySelectorAll<HTMLElement>('[data-composer-seat][data-conversation-region="composer"]')) next.set(seat, 'transparent');
      }
      for (const [element, surface] of surfaces) {
        if (!next.has(element)) { surface.restoreImage(); surface.color.restore(); surfaces.delete(element); }
      }
      for (const [element, value] of next) {
        const surface = surfaces.get(element);
        if (surface) surface.color.update(value);
        else surfaces.set(element, { color: ownStyle(element, 'background-color', value),
          restoreImage: change(element, 'background-image', 'none') });
      }
    };
    const layer = doc.createElement('div');
    layer.className = 'power-dsh-flowing-background';
    const initial = readAppearance ? readAppearance() : appearance;
    const wallpaper = initial.wallpaper ?? null;
    layer.setAttribute('data-kind', wallpaper ? 'wallpaper' : 'pattern');
    layer.setAttribute('aria-hidden', 'true');
    const sheet = doc.createElement('style');
    sheet.textContent = styles;
    let stop = () => {};
    let canvas: HTMLCanvasElement | null = null;
    if (wallpaper) {
      // The wallpaper is a plain cover image; no GPU context or frame chain is created.
      const image = doc.createElement('img');
      image.className = 'power-dsh-wallpaper power-dsh-artwork';
      image.setAttribute('alt', '');
      image.setAttribute('draggable', 'false');
      image.src = wallpaper.dataUrl;
      const veil = doc.createElement('div');
      veil.className = 'power-dsh-wallpaper-veil';
      layer.append(sheet, image, veil);
    } else {
      canvas = doc.createElement('canvas');
      canvas.className = 'power-dsh-artwork';
      layer.append(sheet, canvas);
    }
    applyAppearance(layer, initial);
    const dispose = () => {
      stop(); layer.remove();
      for (const surface of surfaces.values()) { surface.restoreImage(); surface.color.restore(); }
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
      if (canvas) stop = animate(canvas, win, doc, target);
      current = { target, layer, refresh, dispose };
      report({ state: 'attached' });
    } catch {
      // Partial attachment never leaves a front layer or a retry driven by rollback mutations.
      dispose(); failedTarget = target; report(failure('initialization', 'attachment.initialize', 'failed', 'completed', 'exception'));
    }
  };
  if (!doc.body) {
    report(failure('environment', 'document.body', 'missing', 'available', 'missing')); return () => {};
  }
  if (typeof win.MutationObserver !== 'function') {
    report(failure('environment', 'mutation-observer', 'unsupported', 'available', 'missing')); return () => {};
  }
  const observer = new win.MutationObserver(sync);
  if (doc.head) observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-phase', 'data-global-panel', 'data-shell-overlay', 'data-shell-bottom', 'data-rightbar-col',
      'data-sidebar-drawer', 'hidden', 'class', 'style'] });
  sync();
  const offAppearance = subscribeAppearance?.(() => {
    if (!disposed && current && readAppearance) applyAppearance(current.layer, readAppearance());
  });
  return () => {
    if (disposed) return;
    disposed = true;
    offAppearance?.();
    observer.disconnect();
    clear();
  };
}

import type { ClientEnvironment, ClientFeature, ClientRuntime, SettingsForm } from '../../shared/client/types.ts';
interface GestureNode { getAttribute(name: string): string | null; tagName?: string; isContentEditable?: boolean; }
// Event paths can contain Window, Document and other non-element targets. Read only this bounded DOM shape.
function isGestureNode(node: unknown): node is GestureNode {
  return typeof node === 'object' && node !== null && 'getAttribute' in node && typeof node.getAttribute === 'function';
}


export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { ctx, form, savePreference } = env;
  // Explicitly approved DOM exception: read only the current gesture's path.
  // The session row marker was checked against DSH 0.2.2-rc.1.
  function bindDoubleClickRenameBlocker(form: SettingsForm) {
    let listening = false;
    const enabled = () => {
      const snapshot = form.getSnapshot();
      return snapshot.status === 'ready' && snapshot.value?.blockDoubleClickRename === true;
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (!enabled() || event.button !== 0) return;
      for (const node of event.composedPath()) {
        if (!isGestureNode(node)) continue;
        const role = node.getAttribute('role');
        if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(node.tagName ?? '')
          || node.isContentEditable || ['button', 'link', 'textbox', 'combobox', 'switch', 'menuitem'].includes(role ?? '')) return;
        if (role !== 'treeitem') continue;
        if (node.getAttribute('data-row-key')?.startsWith('session:')) event.stopPropagation();
        return;
      }
    };
    const sync = () => {
      const next = enabled();
      if (next === listening) return;
      listening = next;
      if (next) window.addEventListener('dblclick', onDoubleClick, true);
      else window.removeEventListener('dblclick', onDoubleClick, true);
    };
    const unsubscribe = form.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      if (listening) window.removeEventListener('dblclick', onDoubleClick, true);
    };
  }
  ctx.effect(() => bindDoubleClickRenameBlocker(form));
  return { settings: [{ field: 'blockDoubleClickRename', description: 'blockDoubleClickRenameDescription', save: next => savePreference('blockDoubleClickRename', next === true) }] } satisfies ClientFeature;
}

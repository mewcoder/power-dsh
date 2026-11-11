import type { Dispose } from '../../shared/client/types.ts';

/** Preview the background while keeping the original slider visible and mounted. */
export function temporarilyHideSettings(input: HTMLInputElement): Dispose | null {
  const row = input.parentElement;
  const panel = input.closest('[data-shortcut-modal="settings"][role="dialog"][aria-modal="true"]');
  const overlay = panel?.parentElement;
  if (!input.isConnected || !row?.hasAttribute('data-power-dsh-wallpaper-slider')
    || !overlay || overlay.parentElement !== input.ownerDocument.body
    || overlay.getAttribute('role') !== 'presentation' || overlay.children.length !== 2
    || overlay.children[1] !== panel || overlay.children[0]?.getAttribute('aria-hidden') !== 'true') return null;
  const visibility = (element: HTMLElement, value: string): Dispose => {
    const before = element.style.getPropertyValue('visibility');
    const priority = element.style.getPropertyPriority('visibility');
    element.style.setProperty('visibility', value, 'important');
    return () => {
      if (element.style.getPropertyValue('visibility') !== value || element.style.getPropertyPriority('visibility') !== 'important') return;
      if (before) element.style.setProperty('visibility', before, priority);
      else element.style.removeProperty('visibility');
    };
  };
  const restoreOverlay = visibility(overlay, 'hidden');
  const restoreRow = visibility(row, 'visible');
  const marker = row.getAttribute('data-wallpaper-previewing');
  row.setAttribute('data-wallpaper-previewing', '');
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    if (row.getAttribute('data-wallpaper-previewing') === '') {
      if (marker === null) row.removeAttribute('data-wallpaper-previewing');
      else row.setAttribute('data-wallpaper-previewing', marker);
    }
    restoreRow();
    restoreOverlay();
  };
}

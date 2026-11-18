export function createWhaleTrigger(play: () => void) {
  let played = false;
  let tab = false;
  let alive = true;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  return {
    key(event: { isTrusted: boolean; key: string; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) {
      if (!event.isTrusted || event.key !== 'Tab' || event.altKey || event.metaKey || event.ctrlKey) return;
      tab = true;
      clearTimeout(expiry);
      expiry = setTimeout(() => { tab = false; }, 0);
    },
    activate(event: { isTrusted: boolean; type: string; button?: number }, input: boolean) {
      if (!alive || played || !input || !event.isTrusted) return;
      if (event.type !== 'click' && !(event.type === 'focus' && tab) || event.type === 'click' && event.button !== 0) return;
      played = true;
      play();
    },
    dispose() { alive = false; tab = false; clearTimeout(expiry); },
  };
}

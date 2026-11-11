export interface BackgroundSessions {
  phase: string;
  byId: Record<string, { blank?: boolean; running?: boolean; retainedBy?: { mainView?: number } }>;
}

/** Only a known blank main view (or no selected Session) receives the artwork. */
export function isNewChat(snapshot: BackgroundSessions): boolean {
  if (snapshot.phase !== 'ready') return false;
  const mainViews = Object.values(snapshot.byId).filter(row => (row.retainedBy?.mainView ?? 0) > 0);
  return mainViews.length === 0 || (mainViews.length === 1 && mainViews[0].blank === true && mainViews[0].running === false);
}

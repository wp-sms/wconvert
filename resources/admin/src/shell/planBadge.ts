import { useSyncExternalStore } from 'react';
import { adminSettings, type PlanBadgeData } from '../settings';

/**
 * The header badge's link, words and dot, as the server last described them.
 *
 * It starts from the settings beside the bundle and a page can replace it after
 * a change — so a badge reading "needs a look" stops saying so the moment the
 * page that fixed it answers, without a reload. Free draws whatever it is
 * given and decides none of it.
 */
let current: PlanBadgeData | null | undefined;
const listeners = new Set<() => void>();

export function setPlanBadge(badge: PlanBadgeData | null): void {
  current = badge;
  listeners.forEach((listener) => listener());
}

function read(): PlanBadgeData | null {
  if (current === undefined) current = adminSettings()?.planBadge ?? null;
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlanBadge(): PlanBadgeData | null {
  return useSyncExternalStore(subscribe, read, read);
}

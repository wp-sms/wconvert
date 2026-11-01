import type { SectionId } from './nav';

/**
 * Where each section's code is, one chunk per section (ADR 0038).
 *
 * Its own file, with nothing but `import()`s in it, so the nav can warm a
 * section on intent without importing the section wrappers — which import the
 * frame the nav is part of.
 */
export const sectionChunks = {
  analytics: () => import('./stats/Dashboard'),
  leads: () => import('./leads/LeadLog'),
  settings: () => import('./settings-page/Settings'),
  destinations: () => import('./destinations/Destinations'),
  occasion: () => import('./occasions/OccasionPage'),
};

/**
 * Start fetching a section's chunk when the pointer or focus reaches its tab,
 * so the click usually finds it already here. Campaigns is in the main file.
 * A failure is not reported here: the section reports it when it renders.
 */
export function preloadSection(id: SectionId): void {
  if (id === 'optins') return;
  void sectionChunks[id]().catch(() => undefined);
}

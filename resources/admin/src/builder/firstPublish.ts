import { adminSettings } from '../settings';

/**
 * **Whether this site has ever published a campaign** — ADR 0176's
 * `first_publish` milestone, handed to the page as `firstPublished` (ADR 0178).
 * A publish in this page writes the same fact back into that boot data, so a
 * second draft opened in the same visit does not lead through the tabs again.
 *
 * The milestone is stored once and never cleared, so deleting every campaign
 * later does not bring the guided header back.
 *
 * **Only an explicit `false` guides.** The guide is optional help, so boot
 * data without the flag reads as published and the header keeps its plain
 * "Review & publish" — the failure to take is offering less, never changing
 * where the main button goes.
 */
export function sitePublishedBefore(): boolean {
  return adminSettings()?.firstPublished !== false;
}

export function notePublished(): void {
  const settings = window.wconvertAdmin as { firstPublished?: boolean } | undefined;
  if (settings) settings.firstPublished = true;
}

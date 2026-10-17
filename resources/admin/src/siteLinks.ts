import { adminSettings } from './settings';

/*
 * Links to the merchant's own site. Outside builder/ because the campaign list
 * offers one too, and the list must not pull the builder into the eager bundle.
 */

/** The site's home page with one parameter set, using WordPress's subdirectory-aware home URL. */
function onSite(homeUrl: string | undefined, param: string | undefined, value: string): string | null {
  if (!homeUrl || !param) return null;
  try {
    const target = new URL(homeUrl);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
    target.searchParams.set(param, value);
    return target.toString();
  } catch {
    return null;
  }
}

/** Open the existing real-page inspector. */
export function siteCheckUrl(homeUrl?: string, inspectParam?: string): string | null {
  return onSite(homeUrl, inspectParam, '1');
}

/** Show this campaign's saved draft on the home page, now, to this admin only (ADR 0151). */
export function draftPreviewUrl(optinId: string, homeUrl = adminSettings()?.homeUrl, previewParam = adminSettings()?.previewParam): string | null {
  return onSite(homeUrl, previewParam, optinId);
}

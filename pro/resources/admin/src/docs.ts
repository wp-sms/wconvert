import { docsUrl, type Guide } from '@/shell/docs';

/**
 * A guide linked from Pro's own screens: free's `docsUrl`, tagged as Pro's
 * link (ADR 0189). A link on free's screens stays free's on a Pro install,
 * because the tag names the plugin that owns the link.
 */
export function proDocsUrl(guide: Guide, section?: string): string {
  return docsUrl(guide, section, 'guide', 'wconvert-pro');
}

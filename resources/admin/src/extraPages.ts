import type { ComponentType } from 'react';

/**
 * Pages reached by their own hash rather than a tab: free's Help (ADR 0144)
 * and whatever another bundle adds, such as Pro's License.
 *
 * A slot like `analyticsIntegration`'s — the other bundle fills it, free
 * draws whatever is there and names nothing it does not ship — with a
 * `registerPage()` call rather than an assignment, because there can be
 * several. A page here is not a section
 * — it has no tab, because a page a merchant opens a few times a year does not
 * earn a place beside the four they use every day — so it is reached by a
 * link, and the frame shows it with no tab current.
 */
export interface ExtraPage {
  /** The hash that opens it: `license` is `#license`. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly Component: ComponentType;
}

const pages = new Map<string, ExtraPage>();

export function registerPage(page: ExtraPage): void {
  pages.set(page.id, page);
}

/** The registered page a hash names, if any. */
export function extraPageFor(hash: string): ExtraPage | undefined {
  return pages.get(hash.replace(/^#/, '').split('?')[0]);
}

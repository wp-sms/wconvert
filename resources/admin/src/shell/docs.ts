/**
 * **Every guide the plugin links to, in one table** (ADR 0145).
 *
 * The docs live on wconvert.io (ADR 0144), and the plugin names each article
 * by its slug here and nowhere else, so a renamed article is one edit and a
 * typo is a type error. No imports: the block editor's bundle and Pro's admin
 * read this file too.
 *
 * Every slug and section below exists on the website's `docs.ts`; check it
 * there before adding one.
 */
export const DOCS_URL = 'https://wconvert.io/docs/';

/** Every other address on our sites. Shipped code writes none of these by hand (ADR 0189). */
export const SITE_URL = 'https://wconvert.io/';
export const PRICING_URL = 'https://wconvert.io/pricing/';
export const SUPPORT_URL = 'https://wconvert.io/support/';
export const PUBLISHER_URL = 'https://veronalabs.com/';

/** The plugin that owns a link, as its `utm_campaign` (ADR 0189). */
export type LinkProduct = 'wconvert-free' | 'wconvert-pro';

/** The spots a link can sit in, as its `utm_content` (ADR 0189). PHP's twin passes the same words as plain strings. */
export type ProSurface = 'header' | 'settings-list' | 'rule-menu' | 'rule-picks' | 'flow-map' | 'destinations' | 'campaign-menu';
export type LinkSpot = ProSurface | 'guide' | 'help' | 'help-search' | 'footer' | 'license'
  | 'template-card' | 'plugins-screen' | 'admin-notice' | 'inspector';

/**
 * A link's four tags. Fixed values only: never the site, the version, the user
 * or a count, so nothing about this install leaves (G7).
 */
export function linkTags(content: LinkSpot, product: LinkProduct = 'wconvert-free'): Readonly<Record<string, string>> {
  return { utm_source: 'wp-admin', utm_medium: 'plugin', utm_campaign: product, utm_content: content };
}

/** An address with its tags, placed before any `#section` so the browser still sends them. */
export function taggedUrl(url: string, content: LinkSpot, product: LinkProduct = 'wconvert-free'): string {
  const hash = url.indexOf('#');
  const base = hash < 0 ? url : url.slice(0, hash);
  const query = Object.entries(linkTags(content, product)).map(([name, value]) => `${name}=${value}`).join('&');
  return `${base}${base.includes('?') ? '&' : '?'}${query}${hash < 0 ? '' : url.slice(hash)}`;
}

export const GUIDES = {
  firstCampaign: 'create-your-first-campaign',
  publishBlocked: 'form-rejected',
  popupNotShowing: 'popup-not-showing',
  emailNotReceived: 'email-not-received',
  changesNotVisible: 'changes-not-visible',
  sendStatuses: 'connections-and-send-statuses',
  resend: 'resend-submissions',
  missingSubmissions: 'missing-submissions-or-counts',
  readResults: 'read-campaign-results',
  spamProtection: 'understand-spam-protection',
  hcaptcha: 'add-hcaptcha',
  blockEmails: 'block-email-addresses',
  whatIsStored: 'what-wconvert-stores',
  retention: 'set-submission-retention',
  erasePersonalData: 'erase-personal-data',
  inlineMissing: 'inline-or-lock-missing',
  proUnavailable: 'pro-features-unavailable',
  update: 'update-wconvert',
  abTest: 'run-an-ab-test',
  quizPaths: 'conditional-quiz-paths',
  externalAnalytics: 'external-analytics-reference',
  campaignSales: 'campaign-sales-reporting',
  aiAgents: 'connect-an-ai-agent',
} as const;

export type Guide = (typeof GUIDES)[keyof typeof GUIDES];

/**
 * The 2-minute-50 walkthrough video: a section of the first-campaign guide on
 * wconvert.io, so it plays there with its captions and transcript (ADR 0176).
 */
export const WALKTHROUGH_VIDEO = { guide: GUIDES.firstCampaign, section: 'watch-the-walkthrough' } as const;

/** A guide's address, optionally at one of its section ids, tagged with the spot it is linked from. */
export function docsUrl(guide?: Guide, section?: string, content: LinkSpot = 'guide', product?: LinkProduct): string {
  return taggedUrl(`${DOCS_URL}${guide ? `${guide}/` : ''}${section ? `#${section}` : ''}`, content, product);
}

/** The docs' own search, opened with `?q=` (ADR 0144). */
export function docsSearchUrl(query: string): string {
  return taggedUrl(`${DOCS_URL}?q=${encodeURIComponent(query)}`, 'help-search');
}

/**
 * The guide a suspended campaign links (ADR 0147), or null for none.
 *
 * A missing site plugin links that plugin's topic on the docs home. Otherwise
 * the cause is the install, and the guide for that is about Pro, so a free
 * install gets no link: free names no Pro page in a repair state (ADR 0116 §3).
 */
export function suspensionGuide(needs: string | null | undefined, free: boolean): string | null {
  if (needs === 'woocommerce') return docsUrl(undefined, 'woocommerce');
  return free ? null : docsUrl(GUIDES.proUnavailable, 'identify-the-problem');
}

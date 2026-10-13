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
} as const;

export type Guide = (typeof GUIDES)[keyof typeof GUIDES];

/** A guide's address, optionally at one of its section ids. */
export function docsUrl(guide?: Guide, section?: string): string {
  return `${DOCS_URL}${guide ? `${guide}/` : ''}${section ? `#${section}` : ''}`;
}

/** The docs' own search, opened with `?q=` (ADR 0144). */
export function docsSearchUrl(query: string): string {
  return `${DOCS_URL}?q=${encodeURIComponent(query)}`;
}

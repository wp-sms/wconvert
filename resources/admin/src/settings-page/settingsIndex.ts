import { __ } from '@wordpress/i18n';
import type { SettingsGroup } from '../nav';
import { ALLOWANCE_LABELS } from '../optins/allowanceSummary';

/** Finds a setting's control on the page, or null while its region is still loading. */
type Finder = (root: ParentNode) => HTMLElement | null;

export interface SettingEntry {
  key: string;
  label: string;
  group: SettingsGroup;
  /** Words a merchant might type that the label does not say. */
  terms: string;
  /** Tried in order; a later finder is where the setting lives when the first is hidden (an off integration, a free install). */
  find: Finder[];
  /** Pro-only controls a free install never draws (ADR 0116). */
  pro?: boolean;
}

/**
 * The rail is where search results go, so a finder never matches inside it:
 * "Connections & destinations" would otherwise answer "Connect".
 */
const outsideRail = (element: Element) => element.closest('[data-settings-rail]') === null;

/** A control in a file this page owns, marked `data-setting` so a rename of its words cannot break the jump. */
const setting = (name: string): Finder => (root) => root.querySelector<HTMLElement>(`[data-setting="${name}"]`);

/** A region heading, matched by its words: for regions whose markup this page does not own. */
const heading = (...titles: string[]): Finder => (root) =>
  [...root.querySelectorAll<HTMLElement>('h2, h3')].find((element) => outsideRail(element) && titles.includes(element.textContent?.trim() ?? '')) ?? null;

/** A button or link whose words begin with one of these. */
const control = (...starts: string[]): Finder => (root) =>
  [...root.querySelectorAll<HTMLElement>('button, a[href]')].find((element) => {
    const text = element.textContent?.trim() ?? '';
    return outsideRail(element) && starts.some((start) => text.startsWith(start));
  }) ?? null;

/**
 * **Find a setting finds settings** — about thirty real controls, each with the
 * group it lives in and a way to reach it. A static client list: every entry
 * is a control this admin already draws, so the index needs no server and no
 * build step, and a setting it misses is one line here.
 *
 * Read at render, not at import, so `__()` runs after translations load.
 */
export function settingsIndex(): SettingEntry[] {
  const destinations = heading(__('Destinations', 'wconvert'));
  const analyticsOn = setting('analytics-enabled');
  const provider = setting('protection-provider');
  return [
    { key: 'add-destination', group: 'connections', label: __('Add a destination', 'wconvert'), terms: __('send leads mailchimp brevo email list provider route new', 'wconvert'), find: [control(__('Add a destination', 'wconvert')), destinations] },
    { key: 'connect-account', group: 'connections', label: __('Connect an account', 'wconvert'), terms: __('account api key credentials sign in mailchimp brevo', 'wconvert'),
      find: [control(__('Connect an account', 'wconvert'), `${__('Connect', 'wconvert')} `), heading(__('Accounts', 'wconvert')), destinations] },
    { key: 'destinations', group: 'connections', label: __('Destinations', 'wconvert'), terms: __('where leads go failing sending issues recent sends status health', 'wconvert'), find: [destinations] },
    { key: 'send-test', group: 'connections', label: __('Send a test', 'wconvert'), terms: __('test email try check delivery', 'wconvert'), find: [control(__('Send a test', 'wconvert')), destinations] },

    { key: 'allowance-max', group: 'experience', label: ALLOWANCE_LABELS.maxImpressions(), terms: __('frequency cap limit times visitor impressions shown ever', 'wconvert'), find: [setting('allowance-max')] },
    { key: 'allowance-wait', group: 'experience', label: ALLOWANCE_LABELS.cooldownDays(), terms: __('cooldown days delay gap frequency', 'wconvert'), find: [setting('allowance-wait')] },
    { key: 'allowance-dismiss', group: 'experience', label: ALLOWANCE_LABELS.stopAfterDismiss(), terms: __('close dismiss frequency', 'wconvert'), find: [setting('allowance-dismiss')] },
    { key: 'allowance-convert', group: 'experience', label: ALLOWANCE_LABELS.stopAfterConversion(), terms: __('convert conversion subscribed frequency stop', 'wconvert'), find: [setting('allowance-convert')] },
    { key: 'phone-country', group: 'experience', label: __('Default phone country', 'wconvert'), terms: __('phone input country code dial prefix sms', 'wconvert'), find: [setting('phone-country')] },

    { key: 'bot-verification', group: 'protection', label: __('Bot verification', 'wconvert'), terms: __('captcha turnstile recaptcha hcaptcha spam bots', 'wconvert'), find: [provider] },
    { key: 'protection-keys', group: 'protection', label: __('Site key and secret key', 'wconvert'), terms: __('captcha turnstile recaptcha hcaptcha keys credentials', 'wconvert'), find: [setting('protection-site-key'), provider] },
    { key: 'protection-test', group: 'protection', label: __('Test saved setup', 'wconvert'), terms: __('captcha verification check spam', 'wconvert'), find: [setting('protection-test'), provider] },
    { key: 'blocked-domains', group: 'protection', pro: true, label: __('Blocked email domains', 'wconvert'), terms: __('spam disposable filter domain block email', 'wconvert'), find: [setting('rule-blocked_domains'), provider] },
    { key: 'blocked-emails', group: 'protection', pro: true, label: __('Blocked email addresses', 'wconvert'), terms: __('spam filter block email', 'wconvert'), find: [setting('rule-blocked_emails'), provider] },
    { key: 'allowed-emails', group: 'protection', pro: true, label: __('Always allow these emails', 'wconvert'), terms: __('exceptions allowlist whitelist bypass filter email', 'wconvert'), find: [setting('rule-allowed_emails'), provider] },
    { key: 'protection-activity', group: 'protection', label: __('Protection activity', 'wconvert'), terms: __('spam counts diagnostics rejected blocked', 'wconvert'), find: [heading(__('Protection activity', 'wconvert'))] },

    { key: 'retention', group: 'data', label: __('Delete submissions automatically', 'wconvert'), terms: __('retention keep how long days purge cleanup gdpr', 'wconvert'), find: [setting('retention-automatic')] },
    { key: 'data-map', group: 'data', label: __('What visitor data is stored', 'wconvert'), terms: __('cookie local storage browser data map gdpr services', 'wconvert'), find: [heading(__('What visitor data is stored', 'wconvert'))] },
    { key: 'policy-text', group: 'data', label: __('Suggested privacy-policy text', 'wconvert'), terms: __('privacy policy page gdpr wordpress', 'wconvert'), find: [setting('privacy-policy-text'), heading(__('What visitor data is stored', 'wconvert'))] },
    { key: 'export-csv', group: 'data', label: __('Download submissions as CSV', 'wconvert'), terms: __('export csv download leads spreadsheet', 'wconvert'), find: [setting('export-csv')] },
    { key: 'export-personal-data', group: 'data', label: __('Export personal data', 'wconvert'), terms: __('gdpr request access subject', 'wconvert'), find: [setting('export-personal-data')] },
    { key: 'erase-personal-data', group: 'data', label: __('Erase personal data', 'wconvert'), terms: __('gdpr delete forget request right to be forgotten', 'wconvert'), find: [setting('erase-personal-data')] },
    { key: 'privacy-guidance', group: 'data', label: __('Privacy guidance in the editor', 'wconvert'), terms: __('privacy notice consent campaign editor', 'wconvert'), find: [setting('privacy-guidance')] },

    { key: 'analytics-enabled', group: 'integrations', pro: true, label: __('Enable analytics integration', 'wconvert'), terms: __('ga4 google analytics gtm plausible tracking events', 'wconvert'), find: [analyticsOn] },
    { key: 'analytics-measurement', group: 'integrations', pro: true, label: __('Measurement ID', 'wconvert'), terms: __('ga4 google analytics tag stream g-', 'wconvert'), find: [setting('analytics-measurement'), analyticsOn] },
    { key: 'analytics-method', group: 'integrations', pro: true, label: __('Connection method', 'wconvert'), terms: __('google tag manager gtm plausible gtag', 'wconvert'), find: [setting('analytics-method'), analyticsOn] },
    { key: 'analytics-consent', group: 'integrations', pro: true, label: __('Consent handling', 'wconvert'), terms: __('wp consent api cookie banner gdpr analytics', 'wconvert'), find: [setting('analytics-consent'), analyticsOn] },
    { key: 'analytics-team', group: 'integrations', pro: true, label: __('Exclude your team', 'wconvert'), terms: __('admins managers internal traffic analytics', 'wconvert'), find: [setting('analytics-team'), analyticsOn] },
    { key: 'analytics-dismissals', group: 'integrations', pro: true, label: __('Track dismissals', 'wconvert'), terms: __('close events analytics', 'wconvert'), find: [setting('analytics-dismissals'), analyticsOn] },
  ];
}

/** Every word typed appears somewhere in the label, the group or the terms. */
export function matchSettings(entries: readonly SettingEntry[], query: string, groupLabel: (group: SettingsGroup) => string): SettingEntry[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return entries.filter((entry) => {
    const haystack = `${entry.label} ${groupLabel(entry.group)} ${entry.terms}`.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Opens what hides the control, focuses it and brings it into view. A wrapper
 * hands focus to its chosen option or first control; a heading takes
 * `tabindex="-1"`, as the destination card's focus request does.
 */
function reveal(target: HTMLElement) {
  for (let details = target.closest('details'); details; details = details.parentElement?.closest('details') ?? null) {
    details.open = true;
  }
  const focusable = 'input, select, textarea, button, a[href]';
  const element = target.matches(focusable)
    ? target
    : target.querySelector<HTMLElement>('input:checked') ?? target.querySelector<HTMLElement>(focusable) ?? target;
  if (element === target && !target.matches(`${focusable}, [tabindex]`)) target.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: 'center' });
}

/**
 * Focuses a setting as soon as its region has drawn it. Regions read their
 * own data, so the control usually arrives after the page does; this waits
 * for it rather than guessing a delay, and gives up after a few seconds so a
 * region that failed to load is not focused out from under the merchant.
 * Returns a cancel for an unmount.
 */
export function focusSetting(entry: SettingEntry, onFound?: () => void, root: HTMLElement = document.body, timeout = 5000): () => void {
  const attempt = () => {
    for (const find of entry.find) {
      const found = find(root);
      if (found) { reveal(found); onFound?.(); return true; }
    }
    return false;
  };
  if (attempt()) return () => undefined;
  const observer = new MutationObserver(() => { if (attempt()) stop(); });
  const timer = window.setTimeout(() => stop(), timeout);
  function stop() { observer.disconnect(); window.clearTimeout(timer); }
  observer.observe(root, { childList: true, subtree: true });
  return stop;
}

/**
 * A setting chosen in another group survives the navigation to it: Settings
 * remounts per address, so the request cannot live in its state. It is read
 * without being consumed (a development double-mount reads it twice) and
 * cleared once the control is focused. It expires, so a request abandoned at
 * "Keep editing" does not fire on some later visit to that group.
 */
let requested: { key: string; group: SettingsGroup; at: number } | null = null;

export function requestSetting(entry: SettingEntry) {
  requested = { key: entry.key, group: entry.group, at: Date.now() };
}

export function requestedSetting(group: SettingsGroup): string | null {
  return requested !== null && requested.group === group && Date.now() - requested.at < 30_000 ? requested.key : null;
}

export function clearRequestedSetting() {
  requested = null;
}

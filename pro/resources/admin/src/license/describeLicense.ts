import { __, _n, sprintf } from '@wordpress/i18n';
import { siteLocale } from '@/lib/format';

/**
 * What the License page says about the licence.
 *
 * The STATE is the server's (`LicenseState`, ADR 0143): which of fifteen
 * situations this is, decided once, in the order the prototype set. This turns
 * a state into words — the headline, the one action, and the three facts
 * under it — and decides nothing about the licence itself. What the licence
 * says OUTSIDE the page (the badge's dot, the Plugins row) is the server's too
 * (`LicenseNotice`), so neither can drift from the other.
 *
 * Every problem state ends on the same sentence: Pro features keep working.
 * A licence never gates a feature; it is updates and support.
 *
 * Ported from the approved prototype's `describeLicense()`
 * (claude.ai/artifact/EovSgYnM27kRV686LKGgWP).
 */

export type LicenseStateName =
  | 'none' | 'active' | 'expiring' | 'cancelled' | 'manual' | 'lifetime' | 'trial' | 'trial_ended'
  | 'expired' | 'payment_failed' | 'disabled' | 'over_limit' | 'moved' | 'copy' | 'key_unreadable' | 'stopped';

export interface LicenseSite {
  domain: string;
  here: boolean;
  dev: boolean;
  added: string | null;
  last_seen: string | null;
}

export interface LicenseOffer { code: string; percent: number | null; until: string | null }

export interface LicensePayload {
  state: LicenseStateName;
  error_code: string;
  retry_at: number | null;
  /** `used` is the store's own count of seats in use, which decides over the limit. */
  plan: { slug: string; label: string; max: number | null; used: number } | null;
  expires_at: string | null;
  days_left: number | null;
  renewal: { mode: 'auto' | 'manual' | 'cancelled' | 'lifetime'; trial_ends_at: string | null; grace_ends_at: string | null; offer: LicenseOffer | null } | null;
  sites: LicenseSite[];
  key: { masked: string | null; source: string | null };
  buyer: { name: string; email: string } | null;
  domain_change: { was: string; now: string; was_dev: boolean } | null;
  updates: { installed: string; latest: string; file_mods: boolean; update_url: string | null; checked_at: number | null };
  last_checked_at: number | null;
  last_success_at: number | null;
  reach: 'ok' | 'unreachable';
  urls: Partial<Record<'account' | 'renew' | 'payment' | 'sites' | 'upgrade' | 'checkout' | 'support' | 'downloads', string>>;
  managed: { by: string | null; email: string | null } | null;
  notice: { dot: 'amber' | 'red' | null; title: string | null; row: string | null };
  badge: { href: string; label: string | null; prompt: boolean; tone: 'amber' | 'red' | null; reason: string | null };
}

export type Tone = 'success' | 'info' | 'warning' | 'danger';
export type Icon = 'checkCircle' | 'key' | 'globe' | 'alert' | 'warn' | 'clock' | 'calendar';

/** The one action the status card offers; the page draws it. */
export type Door =
  | 'account' | 'renew_soon' | 'renewal_on' | 'buy' | 'renew' | 'payment' | 'support'
  | 'sites' | 'activate_copy' | 'move' | 'rekey' | 'contact';

export interface LicenseFact { label: string; value: string; sub?: string | null; tone?: 'warning' | 'danger' }

export interface LicenseDescription {
  tone: Tone;
  icon: Icon;
  headline: string;
  body: string;
  door: Door | null;
  /** The plan chip above the headline: "Pro · 5 sites". */
  chip: string;
  facts: LicenseFact[];
  coupon: LicenseOffer | null;
  /** Updates have stopped: the licence is the reason. */
  stopped: boolean;
  /** The licence is on another domain, so updates are off here. */
  elsewhere: boolean;
}

const STOPPED: readonly LicenseStateName[] = ['key_unreadable', 'disabled', 'trial_ended', 'expired', 'stopped'];

export function describeLicense(license: LicensePayload, now = Date.now()): LicenseDescription {
  const days = license.days_left ?? 0;
  const stopped = STOPPED.includes(license.state);
  const elsewhere = license.state === 'moved' || license.state === 'copy';
  const mode = license.renewal?.mode ?? 'manual';
  const ends = license.expires_at;
  const keepWorking = __('Pro features keep working.', 'wconvert-pro');

  if (license.managed) return managed(license, stopped);

  const hero = (tone: Tone, icon: Icon, headline: string, body: string, door: Door | null) => ({ tone, icon, headline, body, door });
  let card: ReturnType<typeof hero>;

  switch (license.state) {
    case 'key_unreadable':
      card = hero('danger', 'key', __('Enter your license key again', 'wconvert-pro'),
        __('WordPress can’t read the saved key. This usually happens after the site’s security keys change. Updates stopped until you do; Pro features keep working.', 'wconvert-pro'), 'rekey');
      break;
    case 'copy':
      card = hero('info', 'globe', sprintf(__('This is a copy of %s', 'wconvert-pro'), license.domain_change?.was ?? ''),
        __('Updates are off on this copy. Staging and local copies don’t use a site, and the live site isn’t touched.', 'wconvert-pro'), 'activate_copy');
      break;
    case 'moved':
      card = hero('warning', 'globe', sprintf(__('This site moved from %s', 'wconvert-pro'), license.domain_change?.was ?? ''),
        sprintf(__('The license is still on %s, so updates are off here.', 'wconvert-pro'), license.domain_change?.was ?? ''), 'move');
      break;
    case 'disabled':
      card = hero('danger', 'alert', __('This license was turned off', 'wconvert-pro'), `${__('Updates and support stopped.', 'wconvert-pro')} ${keepWorking}`, 'support');
      break;
    case 'trial_ended':
      card = hero('danger', 'alert', __('Your trial ended', 'wconvert-pro'), `${__('Updates and support stopped.', 'wconvert-pro')} ${keepWorking}`, 'buy');
      break;
    case 'expired':
      card = hero('danger', 'alert', __('Your license expired', 'wconvert-pro'),
        `${sprintf(__('Updates and support stopped on %s.', 'wconvert-pro'), long(ends))} ${keepWorking}`, 'renew');
      break;
    case 'payment_failed':
      card = hero('warning', 'warn', __('Your payment didn’t go through', 'wconvert-pro'),
        `${sprintf(__('Update it by %s to keep updates and support.', 'wconvert-pro'), long(license.renewal?.grace_ends_at ?? null))} ${keepWorking}`, 'payment');
      break;
    case 'over_limit': {
      const used = license.plan?.used ?? license.sites.filter((site) => !site.dev).length;
      card = hero('warning', 'warn', sprintf(__('%1$d sites use a %2$d-site license', 'wconvert-pro'), used, license.plan?.max ?? 0),
        __('Remove the sites you no longer use, or upgrade for more.', 'wconvert-pro'), 'sites');
      break;
    }
    case 'trial':
      card = hero(days <= 7 ? 'warning' : 'info', 'clock',
        days <= 7 ? sprintf(_n('Your trial ends in %d day', 'Your trial ends in %d days', days, 'wconvert-pro'), days) : __('You’re on a trial', 'wconvert-pro'),
        sprintf(__('It ends on %s. Buy to keep updates and support after that.', 'wconvert-pro'), long(license.renewal?.trial_ends_at ?? ends)), 'buy');
      break;
    case 'expiring':
      card = hero('warning', 'calendar',
        days <= 0 ? __('Your license ends today', 'wconvert-pro') : sprintf(_n('Your license ends in %d day', 'Your license ends in %d days', days, 'wconvert-pro'), days),
        sprintf(__('It ends on %s. Renew to keep getting updates and support.', 'wconvert-pro'), long(ends)), 'renew');
      break;
    default: {
      const body = mode === 'auto' ? sprintf(__('Renews automatically on %s.', 'wconvert-pro'), long(ends))
        : mode === 'cancelled' ? sprintf(__('Ends on %s and won’t renew.', 'wconvert-pro'), long(ends))
          : mode === 'lifetime' ? __('Lifetime license. There’s nothing to renew.', 'wconvert-pro')
            : sprintf(__('Ends on %s. It doesn’t renew automatically.', 'wconvert-pro'), long(ends));
      const door: Door = mode === 'cancelled' ? 'renewal_on' : mode === 'manual' && days <= 30 ? 'renew_soon' : 'account';
      card = hero('success', 'checkCircle', __('Updates and support are on', 'wconvert-pro'), body, door);
    }
  }

  return {
    ...card,
    chip: chip(license),
    facts: facts(license, stopped, elsewhere, now),
    coupon: card.door === 'renew' ? license.renewal?.offer ?? null : null,
    stopped,
    elsewhere,
  };
}

/** What an agency's client sees: whether updates work, and who to call (P1). */
function managed(license: LicensePayload, stopped: boolean): LicenseDescription {
  const by = license.managed?.by ?? null;
  const who = by ?? __('your site developer', 'wconvert-pro');
  const Who = by ?? __('Your site developer', 'wconvert-pro');

  return {
    tone: stopped ? 'warning' : 'success',
    icon: stopped ? 'alert' : 'checkCircle',
    headline: stopped ? __('Updates stopped', 'wconvert-pro') : __('Updates are on', 'wconvert-pro'),
    body: stopped
      ? `${__('Pro features keep working.', 'wconvert-pro')} ${sprintf(__('Contact %s to turn updates back on.', 'wconvert-pro'), who)}`
      : sprintf(__('%s manages this license.', 'wconvert-pro'), Who),
    door: stopped ? 'contact' : null,
    chip: __('Pro', 'wconvert-pro'),
    facts: [
      { label: __('Updates', 'wconvert-pro'), value: stopped ? __('Stopped', 'wconvert-pro') : license.updates.file_mods ? __('On', 'wconvert-pro') : __('Off on this site', 'wconvert-pro'), tone: stopped ? 'warning' : undefined },
      { label: __('Managed by', 'wconvert-pro'), value: Who },
      { label: __('License key', 'wconvert-pro'), value: __('Set in wp-config.php', 'wconvert-pro') },
    ],
    coupon: null,
    stopped,
    elsewhere: false,
  };
}

function chip(license: LicensePayload): string {
  const pro = __('Pro', 'wconvert-pro');
  const plan = license.plan === null ? null : license.plan.max === null ? __('Unlimited', 'wconvert-pro')
    : sprintf(_n('%d site', '%d sites', license.plan.max, 'wconvert-pro'), license.plan.max);
  const lifetime = license.renewal?.mode === 'lifetime' ? __('Lifetime', 'wconvert-pro') : null;

  const parts: Array<string | null> = [pro, plan, lifetime];

  return parts.filter((part): part is string => part !== null).join(' · ');
}

/** Updates · Support · Renewal. */
function facts(license: LicensePayload, stopped: boolean, elsewhere: boolean, now: number): LicenseFact[] {
  const fileMods = license.updates.file_mods;
  const mode = license.renewal?.mode ?? 'manual';
  const ends = license.expires_at;
  const days = license.days_left;
  const list: LicenseFact[] = [{
    label: __('Updates', 'wconvert-pro'),
    value: stopped ? __('Stopped', 'wconvert-pro') : elsewhere || !fileMods ? __('Off on this site', 'wconvert-pro') : __('On', 'wconvert-pro'),
    sub: !stopped && !elsewhere && !fileMods ? __('Turned off by the host', 'wconvert-pro') : null,
    tone: stopped ? 'danger' : elsewhere || !fileMods ? 'warning' : undefined,
  }];
  const ended = license.state === 'expired' || license.state === 'trial_ended';

  if (license.state === 'disabled') {
    list.push({ label: __('Support', 'wconvert-pro'), value: __('Ended', 'wconvert-pro'), tone: 'danger' });
  } else if (ended) {
    list.push({ label: __('Support', 'wconvert-pro'), value: __('Ended', 'wconvert-pro'), sub: ends ? long(ends) : null, tone: 'danger' });
  } else if (mode === 'lifetime') {
    list.push({ label: __('Support', 'wconvert-pro'), value: __('Included', 'wconvert-pro'), sub: __('For life', 'wconvert-pro') });
  } else {
    list.push({ label: __('Support', 'wconvert-pro'), value: sprintf(__('Until %s', 'wconvert-pro'), short(ends, now)), sub: relative(days) });
  }

  if (mode !== 'lifetime' && license.state !== 'disabled' && !ended) {
    if (license.state === 'trial') {
      list.push({ label: __('Renewal', 'wconvert-pro'), value: __('Trial', 'wconvert-pro'), sub: sprintf(__('Ends %s', 'wconvert-pro'), short(license.renewal?.trial_ends_at ?? ends, now)), tone: (days ?? 0) <= 7 ? 'warning' : undefined });
    } else if (license.state === 'payment_failed') {
      list.push({ label: __('Renewal', 'wconvert-pro'), value: __('Payment failed', 'wconvert-pro'), sub: sprintf(__('Update by %s', 'wconvert-pro'), short(license.renewal?.grace_ends_at ?? null, now)), tone: 'warning' });
    } else {
      const value = mode === 'auto' ? __('Automatic', 'wconvert-pro') : mode === 'cancelled' ? __('Off', 'wconvert-pro') : __('Manual', 'wconvert-pro');
      const sub = sprintf(mode === 'auto' ? __('Renews %s', 'wconvert-pro') : __('Ends %s', 'wconvert-pro'), short(ends, now));
      list.push({ label: __('Renewal', 'wconvert-pro'), value, sub, tone: license.state === 'expiring' ? 'warning' : undefined });
    }
  }

  return list;
}

/** "Mar 3, 2027", from the store's ISO date, on its own calendar day. */
export function long(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(siteLocale(), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

/** "Mar 3" this year, "Mar 3, 2027" otherwise. */
export function short(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const sameYear = iso.slice(0, 4) === new Date(now).toISOString().slice(0, 4);
  return new Intl.DateTimeFormat(siteLocale(), { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

/** "in 9 days", "in 5 months", "today", "3 days ago". */
function relative(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return __('today', 'wconvert-pro');
  if (days < 0) return sprintf(_n('%d day ago', '%d days ago', -days, 'wconvert-pro'), -days);
  if (days < 45) return sprintf(_n('in %d day', 'in %d days', days, 'wconvert-pro'), days);
  const months = Math.round(days / 30.4);
  return sprintf(_n('in %d month', 'in %d months', months, 'wconvert-pro'), months);
}

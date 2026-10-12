import { describe, expect, it } from 'vitest';
import { describeLicense, type LicensePayload } from '../../resources/admin/src/license/describeLicense';

/**
 * The License page's copy, one scenario of the approved prototype at a time
 * (claude.ai/artifact/EovSgYnM27kRV686LKGgWP). The server decides the STATE
 * (LicenseState, tested in PHP); this decides only what the page says about
 * it — the headline, the one action, and Updates · Support · Renewal.
 */
const base = (over: Partial<LicensePayload> = {}): LicensePayload => ({
  state: 'active',
  error_code: '',
  retry_at: null,
  plan: { slug: '5-sites', label: '5 sites', max: 5, used: 2 },
  expires_at: '2027-03-03T00:00:00+00:00',
  days_left: 142,
  renewal: { mode: 'auto', trial_ends_at: null, grace_ends_at: null, offer: null },
  sites: [
    { domain: 'example.com', here: true, dev: false, added: '2026-03-03T10:00:00+00:00', last_seen: null },
    { domain: 'shop.example.com', here: false, dev: false, added: '2026-04-18T10:00:00+00:00', last_seen: null },
    { domain: 'staging.example.com', here: false, dev: true, added: '2026-05-02T10:00:00+00:00', last_seen: null },
  ],
  key: { masked: '••••AB12', source: 'manual' },
  buyer: { name: 'S*** K***', email: 's***@example.com' },
  domain_change: null,
  updates: { installed: '1.4.2', latest: '1.4.2', file_mods: true, update_url: null, checked_at: null },
  last_checked_at: null,
  last_success_at: null,
  reach: 'ok',
  urls: { account: 'a', renew: 'r', payment: 'p', sites: 's', upgrade: 'u', checkout: 'c', support: 'h', downloads: 'd' },
  managed: null,
  notice: { dot: null, title: null, row: null },
  badge: { href: '#license', label: null, prompt: false, tone: null, reason: null },
  ...over,
});

/** The prototype's "today": 12 October 2026. */
const NOW = Date.parse('2026-10-12T12:00:00Z');
const at = (payload: LicensePayload) => describeLicense(payload, NOW);

const facts = (payload: LicensePayload) => at(payload).facts.map((f) => [f.label, f.value]);

describe('describeLicense', () => {
  it('D1: renews by itself — updates and support on, nothing to do but manage the account', () => {
    const d = at(base());
    expect(d.tone).toBe('success');
    expect(d.headline).toBe('Updates and support are on');
    expect(d.body).toBe('Renews automatically on Mar 3, 2027.');
    expect(d.door).toBe('account');
    expect(d.chip).toBe('Pro · 5 sites');
    expect(facts(base())).toEqual([['Updates', 'On'], ['Support', 'Until Mar 3, 2027'], ['Renewal', 'Automatic']]);
  });

  it('D1: an unlimited plan says so on the chip', () => {
    expect(at(base({ plan: { slug: 'unlimited', label: 'Unlimited', max: null, used: 14 } })).chip).toBe('Pro · Unlimited');
  });

  it('D2: a manual renewal months away has no renew door yet', () => {
    const d = at(base({ state: 'manual', renewal: { mode: 'manual', trial_ends_at: null, grace_ends_at: null, offer: null } }));
    expect(d.body).toBe('Ends on Mar 3, 2027. It doesn’t renew automatically.');
    expect(d.door).toBe('account');
  });

  it('D2: within 30 days the renew door appears, still green', () => {
    const d = at(base({ state: 'manual', days_left: 24, expires_at: '2026-11-05T12:00:00+00:00', renewal: { mode: 'manual', trial_ends_at: null, grace_ends_at: null, offer: null } }));
    expect(d.tone).toBe('success');
    expect(d.door).toBe('renew_soon');
  });

  it('D3: cancelled but paid up — one door, turn renewal back on', () => {
    const d = at(base({ state: 'cancelled', expires_at: '2026-11-20T00:00:00+00:00', days_left: 39, renewal: { mode: 'cancelled', trial_ends_at: null, grace_ends_at: null, offer: null } }));
    expect(d.body).toBe('Ends on Nov 20, 2026 and won’t renew.');
    expect(d.door).toBe('renewal_on');
    expect(facts(base({ state: 'cancelled', renewal: { mode: 'cancelled', trial_ends_at: null, grace_ends_at: null, offer: null } }))[2]).toEqual(['Renewal', 'Off']);
  });

  it('D4: lifetime — no renewal fact, support for life', () => {
    const p = base({ state: 'lifetime', expires_at: null, days_left: null, renewal: { mode: 'lifetime', trial_ends_at: null, grace_ends_at: null, offer: null } });
    const d = at(p);
    expect(d.body).toBe('Lifetime license. There’s nothing to renew.');
    expect(d.chip).toBe('Pro · 5 sites · Lifetime');
    expect(facts(p)).toEqual([['Updates', 'On'], ['Support', 'Included']]);
  });

  it('D5: a trial says when it ends; three days out it turns amber', () => {
    const trial = (days: number) => base({ state: 'trial', days_left: days, expires_at: '2026-10-24T12:00:00+00:00', renewal: { mode: 'manual', trial_ends_at: '2026-10-24T12:00:00+00:00', grace_ends_at: null, offer: null } });
    expect(at(trial(12))).toMatchObject({ tone: 'info', headline: 'You’re on a trial', door: 'buy' });
    expect(at(trial(3))).toMatchObject({ tone: 'warning', headline: 'Your trial ends in 3 days' });
  });

  it('D5: an ended trial reads like an expiry — Pro features keep working', () => {
    const d = at(base({ state: 'trial_ended', days_left: -2 }));
    expect(d).toMatchObject({ tone: 'danger', headline: 'Your trial ended', door: 'buy', stopped: true });
    expect(d.body).toContain('Pro features keep working.');
  });

  it('D7: the host turned off file changes — the licence is fine, WordPress cannot install', () => {
    const d = at(base({ updates: { installed: '1.4.2', latest: '1.5.0', file_mods: false, update_url: null, checked_at: null } }));
    expect(d.facts[0]).toEqual({ label: 'Updates', value: 'Off on this site', sub: 'Turned off by the host', tone: 'warning' });
  });

  it('M1: expiring — amber, the days, and the renew door', () => {
    const d = at(base({ state: 'expiring', days_left: 9, expires_at: '2026-10-21T12:00:00+00:00', renewal: { mode: 'manual', trial_ends_at: null, grace_ends_at: null, offer: { code: 'RENEW20', percent: 20, until: '2026-10-21T00:00:00+00:00' } } }));
    expect(d).toMatchObject({ tone: 'warning', headline: 'Your license ends in 9 days', door: 'renew' });
    expect(d.body).toBe('It ends on Oct 21, 2026. Renew to keep getting updates and support.');
    expect(d.coupon).toEqual({ code: 'RENEW20', percent: 20, until: '2026-10-21T00:00:00+00:00' });
  });

  it('M2: payment failed — amber, update payment by the grace date', () => {
    const d = at(base({ state: 'payment_failed', renewal: { mode: 'manual', trial_ends_at: null, grace_ends_at: '2026-10-16T12:00:00+00:00', offer: null } }));
    expect(d).toMatchObject({ tone: 'warning', headline: 'Your payment didn’t go through', door: 'payment' });
    expect(d.body).toBe('Update it by Oct 16, 2026 to keep updates and support. Pro features keep working.');
    expect(d.facts[2]).toMatchObject({ label: 'Renewal', value: 'Payment failed', tone: 'warning' });
  });

  it('M3: expired — red, renew, the coupon, and Pro features keep working', () => {
    const d = at(base({ state: 'expired', days_left: -12, expires_at: '2026-09-30T00:00:00+00:00', renewal: { mode: 'manual', trial_ends_at: null, grace_ends_at: null, offer: { code: 'RENEW20', percent: 20, until: null } } }));
    expect(d).toMatchObject({ tone: 'danger', headline: 'Your license expired', door: 'renew', stopped: true });
    expect(d.body).toBe('Updates and support stopped on Sep 30, 2026. Pro features keep working.');
    expect(facts(base({ state: 'expired', expires_at: '2026-09-30T00:00:00+00:00' }))).toEqual([['Updates', 'Stopped'], ['Support', 'Ended']]);
  });

  it('M4: turned off by the store — support is the door', () => {
    expect(at(base({ state: 'disabled', error_code: 'key_disabled' }))).toMatchObject({ tone: 'danger', headline: 'This license was turned off', door: 'support' });
  });

  it('M5: over the limit — the store\'s seat count, not the listed rows', () => {
    const extra = [1, 2, 3].map((n) => ({ domain: `c${n}.com`, here: false, dev: false, added: null, last_seen: null }));
    const d = at(base({ state: 'over_limit', plan: { slug: '5-sites', label: '5 sites', max: 5, used: 6 }, sites: [...base().sites, ...extra, ...extra.slice(0, 1)] }));
    expect(d).toMatchObject({ tone: 'warning', headline: '6 sites use a 5-site license', door: 'sites' });
  });

  it('C1: moved — the licence is still on the old domain', () => {
    const d = at(base({ state: 'moved', domain_change: { was: 'old-example.com', now: 'example.com', was_dev: false } }));
    expect(d).toMatchObject({ tone: 'warning', headline: 'This site moved from old-example.com', door: 'move', elsewhere: true });
    expect(d.facts[0]).toMatchObject({ value: 'Off on this site' });
  });

  it('C2: a staging copy — activating here uses no site', () => {
    const d = at(base({ state: 'copy', domain_change: { was: 'example.com', now: 'staging2.example.com', was_dev: false } }));
    expect(d).toMatchObject({ tone: 'info', headline: 'This is a copy of example.com', door: 'activate_copy' });
  });

  it('C7: a key that cannot be read — enter it again, right here', () => {
    const d = at(base({ state: 'key_unreadable', key: { masked: null, source: 'manual' } }));
    expect(d).toMatchObject({ tone: 'danger', headline: 'Enter your license key again', door: 'rekey', stopped: true });
  });

  it('P1: managed — whether updates work and who to call, nothing else', () => {
    const managed = (state: LicensePayload['state'], by: string | null, email: string | null) =>
      at(base({ state, managed: { by, email }, plan: null, expires_at: null, days_left: null, renewal: null, sites: [], buyer: null }));
    expect(managed('active', null, null)).toMatchObject({ tone: 'success', headline: 'Updates are on', body: 'Your site developer manages this license.', door: null, chip: 'Pro' });
    expect(managed('active', 'Acme Studio', 'help@acme.studio').body).toBe('Acme Studio manages this license.');
    expect(managed('stopped', 'Acme Studio', 'help@acme.studio')).toMatchObject({ tone: 'warning', headline: 'Updates stopped', door: 'contact' });
    expect(managed('stopped', 'Acme Studio', null).body).toBe('Pro features keep working. Contact Acme Studio to turn updates back on.');
    expect(managed('active', 'Acme Studio', null).facts.map((f) => [f.label, f.value])).toEqual([['Updates', 'On'], ['Managed by', 'Acme Studio'], ['License key', 'Set in wp-config.php']]);
  });
});

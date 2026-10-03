import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics, type AnalyticsConfig } from '../../modules/analytics/loader/analytics';

const config: AnalyticsConfig = {
  route: 'gtag', measurement_id: 'G-TEST123', consent: 'site', dismissals: false,
  campaigns: { one: { campaign: 'one', goal: 'collect_email', outcome: 'capture', label: 'Campaign one' } },
};
afterEach(() => { vi.unstubAllGlobals(); });
describe('analytics handoff', () => {
  it('requires an initialized consent policy and observes revocation without replay', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    const permission = vi.fn(() => true); vi.stubGlobal('wp_has_consent', permission);
    const analytics = createAnalytics({ ...config, consent: 'wp' });
    analytics.observe('one', 'capture');
    expect(gtag).not.toHaveBeenCalled();
    vi.stubGlobal('wp_consent_type', 'optin');
    analytics.observe('one', 'capture');
    expect(gtag).toHaveBeenCalledTimes(1);
    permission.mockReturnValue(false);
    analytics.observe('one', 'capture');
    expect(gtag).toHaveBeenCalledTimes(1);
  });
  it('routes quiz completion and secondary capture through GTM with cleared optional fields', () => {
    const dataLayer: unknown[] = []; vi.stubGlobal('dataLayer', dataLayer);
    const analytics = createAnalytics({ ...config, route: 'gtm', campaigns: { one: { ...config.campaigns.one, outcome: 'quiz' } } });
    analytics.observe('one', 'capture'); analytics.observe('one', 'convert');
    expect(dataLayer).toEqual([expect.objectContaining({ event: 'wconvert.lead_accepted', wconvert: expect.objectContaining({ ga_event: 'generate_lead', capture_role: 'secondary' }) }), expect.objectContaining({ event: 'wconvert.campaign_converted', wconvert: expect.objectContaining({ ga_event: 'wconvert_conversion', capture_role: null }) })]);
  });
  it('sends one accepted lead to the selected stream without submitted details', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    const analytics = createAnalytics(config);
    analytics.observe('one', 'capture');
    analytics.observe('one', 'convert');
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'generate_lead', expect.objectContaining({
      send_to: 'G-TEST123', wcv_campaign_id: 'one', wcv_capture_role: 'primary',
    }));
  });
});

describe('analytics isolation', () => {
  it('never falls back between routes and contains tag failures', () => {
    const dataLayer: unknown[] = []; vi.stubGlobal('dataLayer', dataLayer);
    expect(createAnalytics(config).observe('one', 'capture')).toBe('tag_unavailable');
    expect(dataLayer).toEqual([]);
    vi.stubGlobal('gtag', () => { throw new Error('Third-party tag failed'); });
    expect(createAnalytics(config).observe('one', 'capture')).toBe('failed');
  });
  it('withholds service denial even with category permission', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    vi.stubGlobal('wp_consent_type', 'optout'); vi.stubGlobal('wp_has_consent', () => true);
    vi.stubGlobal('wp_is_service_denied', () => true);
    expect(createAnalytics({ ...config, consent: 'wp' }).observe('one', 'capture')).toBe('consent_withheld');
    expect(gtag).not.toHaveBeenCalled();
  });
  it('does not deduplicate independent campaigns or replay withheld activity', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    const analytics = createAnalytics({ ...config, campaigns: { ...config.campaigns, two: { ...config.campaigns.one, campaign: 'two' } } });
    analytics.observe('one', 'capture'); analytics.observe('two', 'capture');
    expect(gtag).toHaveBeenCalledTimes(2);
  });
  it('ignores excluded IDs, inherited property names and disabled dismissals', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    const analytics = createAnalytics(config);
    expect(analytics.observe('excluded', 'impression')).toBe('ignored');
    expect(analytics.observe('constructor', 'capture')).toBe('ignored');
    expect(analytics.observe('one', 'dismiss')).toBe('ignored');
    expect(gtag).not.toHaveBeenCalled();
  });
  it('keeps inspection local and sends synthetic tests only to an explicit test stream', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    const analytics = createAnalytics({ ...config, dry_run: true });
    expect(analytics.observe('one', 'capture')).toBe('dry_run');
    expect(analytics.test('')).toBe('tag_unavailable');
    expect(gtag).not.toHaveBeenCalled();
    analytics.test('G-TEST999');
    expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'wconvert_test', { wcv_schema_version: 1, send_to: 'G-TEST999', debug_mode: true });
  });
  it('does not send or buffer observations during prerendering', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    Object.defineProperty(document, 'prerendering', { configurable: true, value: true });
    const analytics = createAnalytics(config);
    expect(analytics.observe('one', 'impression')).toBe('prerender');
    Object.defineProperty(document, 'prerendering', { configurable: true, value: false });
    analytics.observe('one', 'capture');
    expect(gtag).toHaveBeenCalledTimes(1);
  });
  it('uses a custom data layer and resets every optional test field', () => {
    const custom: unknown[] = []; const dataLayer: unknown[] = [];
    vi.stubGlobal('campaignLayer', custom); vi.stubGlobal('dataLayer', dataLayer);
    const analytics = createAnalytics({ ...config, route: 'gtm', data_layer: 'campaignLayer' });
    analytics.observe('one', 'capture'); analytics.test('');
    expect(dataLayer).toEqual([]);
    expect(custom[1]).toEqual({ event: 'wconvert.test', wconvert: { campaign_id: null, optin_id: null, campaign_label: null, display_type: null, goal: null, outcome: null, capture_role: null, schema_version: 1, ga_event: 'wconvert_test', debug_mode: true } });
  });
});

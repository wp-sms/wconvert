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
  it('uses statistics permission rather than an unregistered service marketing fallback', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    vi.stubGlobal('wp_consent_type', 'optin');
    vi.stubGlobal('wp_has_consent', (category: string) => category === 'statistics');
    vi.stubGlobal('wp_has_service_consent', () => false);
    const denied = vi.fn(() => false); vi.stubGlobal('wp_is_service_denied', denied);
    const analytics = createAnalytics({ ...config, consent: 'wp' });
    expect(analytics.observe('one', 'capture')).toBe('handed_off');
    denied.mockReturnValue(true);
    expect(analytics.observe('one', 'capture')).toBe('consent_withheld');
    expect(gtag).toHaveBeenCalledOnce();
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

describe('Plausible handoff', () => {
  it('maps campaign outcomes to namespaced goals with allowlisted properties and passive impressions', () => {
    const plausible = vi.fn(); const gtag = vi.fn(); const dataLayer: unknown[] = [];
    vi.stubGlobal('plausible', plausible); vi.stubGlobal('gtag', gtag); vi.stubGlobal('dataLayer', dataLayer);
    const analytics = createAnalytics({ ...config, route: 'plausible', measurement_id: '', dismissals: true });
    analytics.observe('one', 'impression'); analytics.observe('one', 'capture'); analytics.observe('one', 'convert'); analytics.observe('one', 'dismiss');
    expect(plausible.mock.calls.map(call => [call[0], call[1].interactive])).toEqual([
      ['WConvert Impression', false], ['WConvert Lead', true], ['WConvert Dismiss', false],
    ]);
    expect(plausible.mock.calls[1][1].props).toEqual({ wcv_campaign_id: 'one', wcv_optin_id: 'one',
      wcv_campaign_label: 'Campaign one', wcv_display_type: 'popup', wcv_goal: 'collect_email',
      wcv_outcome: 'capture', wcv_capture_role: 'primary', wcv_schema_version: 1 });
    expect(plausible.mock.calls[0][1].props).not.toHaveProperty('wcv_capture_role');
    expect(gtag).not.toHaveBeenCalled(); expect(dataLayer).toEqual([]);
  });
  it('keeps quiz completion separate from secondary contact capture', () => {
    const plausible = vi.fn(); vi.stubGlobal('plausible', plausible);
    const analytics = createAnalytics({ ...config, route: 'plausible', campaigns: { one: { ...config.campaigns.one, outcome: 'quiz' } } });
    analytics.observe('one', 'convert'); analytics.observe('one', 'capture');
    expect(plausible.mock.calls.map(call => call[0])).toEqual(['WConvert Conversion', 'WConvert Lead']);
    expect(plausible.mock.calls[1][1].props.wcv_capture_role).toBe('secondary');
  });
  it('contains missing or broken scripts without creating queues or falling back to Google', () => {
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    const analytics = createAnalytics({ ...config, route: 'plausible' });
    expect(analytics.observe('one', 'capture')).toBe('tag_unavailable');
    expect(window).not.toHaveProperty('plausible');
    vi.stubGlobal('plausible', () => { throw new Error('Tracker blocked'); });
    expect(analytics.observe('one', 'capture')).toBe('failed');
    expect(gtag).not.toHaveBeenCalled();
  });
  it('checks statistics and Plausible service denial on every event without replay', () => {
    const plausible = vi.fn(); vi.stubGlobal('plausible', plausible);
    const permission = vi.fn(() => false); vi.stubGlobal('wp_has_consent', permission);
    const denied = vi.fn((service: string) => service === 'google-analytics'); vi.stubGlobal('wp_is_service_denied', denied);
    const analytics = createAnalytics({ ...config, route: 'plausible', consent: 'wp' });
    expect(analytics.observe('one', 'capture')).toBe('consent_unknown');
    vi.stubGlobal('wp_consent_type', 'optin');
    expect(analytics.observe('one', 'capture')).toBe('consent_withheld');
    permission.mockReturnValue(true);
    expect(analytics.observe('one', 'capture')).toBe('handed_off');
    expect(denied).toHaveBeenLastCalledWith('plausible');
    denied.mockReturnValue(true);
    expect(analytics.observe('one', 'capture')).toBe('consent_withheld');
    expect(plausible).toHaveBeenCalledOnce();
  });
  it('keeps diagnostics local and sends an explicit passive test without campaign data', () => {
    const plausible = vi.fn(); vi.stubGlobal('plausible', plausible);
    const analytics = createAnalytics({ ...config, route: 'plausible', dry_run: true });
    expect(analytics.observe('one', 'capture')).toBe('dry_run');
    expect(plausible).not.toHaveBeenCalled();
    expect(analytics.test('')).toBe('handed_off');
    expect(plausible).toHaveBeenCalledExactlyOnceWith('WConvert Test', { props: { wcv_schema_version: 1 }, interactive: false });
  });
});

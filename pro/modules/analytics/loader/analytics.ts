export interface CampaignMetadata { campaign: string; goal: string; outcome: 'capture' | 'quiz' | 'click'; label: string; display?: string; }
export interface AnalyticsConfig {
  route: 'gtag' | 'gtm'; measurement_id: string; consent: 'wp' | 'site'; dismissals: boolean;
  data_layer?: string; campaigns: Record<string, CampaignMetadata>; dry_run?: boolean;
}
export type Activity = 'impression' | 'capture' | 'convert' | 'dismiss';
export type Status = 'handed_off' | 'consent_unknown' | 'consent_withheld' | 'tag_unavailable' | 'ignored' | 'dry_run' | 'failed' | 'prerender';
interface SiteWindow {
  gtag?: (...args: unknown[]) => void;
  wp_consent_type?: string;
  wp_has_consent?: (category: string) => boolean;
  wp_has_service_consent?: (service: string) => boolean;
  wp_is_service_denied?: (service: string) => boolean;
}
const names = { impression: 'wconvert_impression', capture: 'generate_lead', convert: 'wconvert_conversion', dismiss: 'wconvert_dismiss' };
const acts = { impression: 'impression', capture: 'lead_accepted', convert: 'campaign_converted', dismiss: 'dismissed' };

export function createAnalytics(config: AnalyticsConfig) {
  const site = window as unknown as SiteWindow;
  function permission(): Status | null {
    if (config.consent === 'site') return null;
    try {
      if (!['optin', 'optout'].includes(site.wp_consent_type ?? '') || typeof site.wp_has_consent !== 'function') return 'consent_unknown';
      if (site.wp_has_consent('statistics') !== true || site.wp_is_service_denied?.('google-analytics') === true
        || site.wp_has_service_consent?.('google-analytics') === false) return 'consent_withheld';
      return null;
    } catch { return 'consent_unknown'; }
  }
  function send(event: string, action: string, params: Record<string, string | number | null>, test = false, stream = config.measurement_id): Status {
    if ((document as Document & { prerendering?: boolean }).prerendering) return 'prerender';
    const refused = permission();
    if (refused) return refused;
    if (config.dry_run && !test) return 'dry_run';
    try {
      if (config.route === 'gtag') {
        if (typeof site.gtag !== 'function' || !/^G-[A-Z0-9]{4,20}$/.test(stream)) return 'tag_unavailable';
        const fields = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null).map(([key, value]) => [`wcv_${key}`, value]));
        site.gtag('event', event, { ...fields, send_to: stream, ...(test ? { debug_mode: true } : {}) });
      } else {
        const layer = (window as unknown as Record<string, unknown>)[config.data_layer ?? 'dataLayer'];
        if (!Array.isArray(layer)) return 'tag_unavailable';
        layer.push({ event: `wconvert.${action}`, wconvert: { ...params, ga_event: event, debug_mode: test } });
      }
      return 'handed_off';
    } catch { return 'failed'; }
  }
  return {
    observe(id: string, kind: Activity): Status {
      if (!Object.prototype.hasOwnProperty.call(config.campaigns, id) || !Object.prototype.hasOwnProperty.call(names, kind)) return 'ignored';
      const campaign = config.campaigns[id];
      if ((kind === 'convert' && campaign.outcome === 'capture') || (kind === 'dismiss' && !config.dismissals)) return 'ignored';
      return send(names[kind], acts[kind], {
        campaign_id: campaign.campaign, optin_id: id, campaign_label: campaign.label,
        display_type: campaign.display ?? 'popup', goal: campaign.goal, outcome: campaign.outcome,
        capture_role: kind === 'capture' ? (campaign.outcome === 'capture' ? 'primary' : 'secondary') : null,
        schema_version: 1,
      });
    },
    test(stream: string): Status {
      return send('wconvert_test', 'test', { campaign_id: null, optin_id: null, campaign_label: null,
        display_type: null, goal: null, outcome: null, capture_role: null, schema_version: 1 }, true, stream);
    },
  };
}

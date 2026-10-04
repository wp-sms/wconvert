import type { PresentationSession } from '@loader/types';
import type { CampaignMetadata } from './analytics';

declare global {
  interface Window {
    __wcvRevenue?: (session: PresentationSession) => PresentationSession;
    __wcvRevenueResult?: (id: string) => void;
  }
}
interface RevenueConfig { endpoint: string; campaigns: Record<string, CampaignMetadata>; }
export function startRevenue(config: RevenueConfig) {
  const site = window as Window & { wp_consent_type?: string; wp_has_consent?: (category: string) => boolean };
  const permitted = () => {
    try { return ['optin', 'optout'].includes(site.wp_consent_type ?? '') && site.wp_has_consent?.('statistics') === true; }
    catch { return false; }
  };
  const send = (body: URLSearchParams) => {
    void fetch(config.endpoint, { method: 'POST', body, credentials: 'same-origin', keepalive: true }).catch(() => {});
  };
  const remember = (id: string, outcome: 'click' | 'quiz') => {
    if (!permitted() || (document as Document & { prerendering?: boolean }).prerendering || config.campaigns[id]?.outcome !== outcome) return;
    send(new URLSearchParams({ id }));
  };
  window.__wcvRevenue = session => ({ ...session, show(entry, controls) {
    const convert = controls.convert;
    return session.show(entry, { ...controls, convert() { try { remember(entry.id, 'click'); } finally { convert(); } } });
  } });
  window.__wcvRevenueResult = id => remember(id, 'quiz');
  // Unknown consent does not create a session. A withdrawal clears only our pending value.
  const clear = () => { if (!permitted()) send(new URLSearchParams({ clear: '1' })); };
  document.addEventListener('wp_listen_for_consent_change', clear);
  clear();
}
const element = document.getElementById('wconvert-revenue-config');
if (element) { try { startRevenue(JSON.parse(element.textContent ?? '')); } catch { /* Optional tracking cannot block campaigns. */ } }

import type { PresentationSession } from '@loader/types';
import type { CampaignMetadata } from './analytics';

declare global {
  interface Window {
    __wcvRevenue?: (session: PresentationSession) => PresentationSession;
    __wcvRevenueResult?: (id: string) => void;
  }
}
interface RevenueConfig { endpoint: string; campaigns: Record<string, CampaignMetadata>; }
function eventId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
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
    send(new URLSearchParams({ id, event: eventId(), at: String(Math.floor(Date.now() / 1000)) }));
  };
  window.__wcvRevenue = session => ({ ...session, show(entry, controls) {
    const convert = controls.convert;
    return session.show(entry, { ...controls, convert() { try { remember(entry.id, 'click'); } catch { /* Optional tracking. */ } convert(); } });
  } });
  window.__wcvRevenueResult = id => remember(id, 'quiz');
  // Unknown consent does not create a session. A withdrawal clears only our pending value.
  const clear = () => { if (!permitted()) send(new URLSearchParams({ clear: '1' })); };
  document.addEventListener('wp_listen_for_consent_change', clear);
  clear();
}
const element = document.getElementById('wconvert-revenue-config');
if (element) { try { startRevenue(JSON.parse(element.textContent ?? '')); } catch { /* Optional tracking cannot block campaigns. */ } }

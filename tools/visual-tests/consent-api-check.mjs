// Compatibility check against the real, pinned WP Consent API script.
// This checks the JavaScript contract, not a configured CMP or provider receipt.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const revision = 'a6ff13c49a11f00d1f1483d091b6d7559166c6f6';
const source = `https://raw.githubusercontent.com/WordPress/wp-consent-level-api/${revision}/assets/js/wp-consent-api.js`;
const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`WP Consent API download failed: ${response.status}`);
const script = await response.text();
for (const route of ['gtag', 'plausible']) {
  const service = route === 'plausible' ? 'plausible' : 'google-analytics';
  const dom = new JSDOM('<script type="application/json" id="wconvert-analytics-config"></script>', {
    url: 'https://analytics-test.example/', runScripts: 'outside-only',
  });
  const w = dom.window;
  try {
    w.consent_api = { consent_type: '', waitfor_consent_hook: false, cookie_prefix: 'wp_consent', cookie_expiration: 30, services: [] };
    runInContext(script, dom.getInternalVMContext());
    w.document.getElementById('wconvert-analytics-config').textContent = JSON.stringify({
      route, measurement_id: 'G-TEST123', consent: 'wp',
      campaigns: { one: { campaign: 'one', goal: 'email', outcome: 'capture', label: '' } },
    });
    const calls = []; w.gtag = w.plausible = (...args) => calls.push(args);
    runInContext(readFileSync(new URL('../../pro/public/analytics/analytics.js', import.meta.url), 'utf8'), dom.getInternalVMContext());
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const capture = () => w.document.dispatchEvent(new w.CustomEvent('wconvert:capture', { detail: { optinId: 'one' } }));
    capture(); assert.equal(calls.length, 0, 'Missing policy must withhold');
    w.wp_consent_type = 'optin'; capture(); assert.equal(calls.length, 0, 'No consent must withhold');
    w.wp_set_consent('statistics', 'allow'); w.wp_set_consent('marketing', 'deny');
    assert.equal(calls.length, 0, 'Granting consent must not replay');
    assert.equal(w.wp_has_service_consent(service), false, 'Unregistered service falls back to marketing');
    capture(); assert.equal(calls.length, 1, 'Statistics permission must work independently of marketing');
    w.wp_set_consent('statistics', 'deny'); capture(); assert.equal(calls.length, 1, 'Withdrawal must withhold');
    w.wp_set_consent('statistics', 'allow'); w.wp_set_service_consent(service, false);
    capture(); assert.equal(calls.length, 1, 'Explicit service denial must withhold');
    w.wp_set_service_consent(service, true); capture(); assert.equal(calls.length, 2, 'Restored permission permits new activity');
    console.log(`WP Consent API ${revision} (${route}): unknown, denied, granted, revoked, service denial and no-replay checks passed.`);
  } finally { w.close(); }
}

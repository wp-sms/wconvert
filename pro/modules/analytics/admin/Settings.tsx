import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Region, RegionBody, RegionHeader } from '@/shell/Region';
import { messageOf } from '@/shell/loadable';
import { useSettingsEditing, type SettingsEditing } from '@/settings-page/useSettingsEditing';
import { path, type Response, type SettingsValue } from './api';
const selectClass = 'block min-w-0 max-w-full w-full rounded-md border border-input bg-background px-3 py-2 text-body';
export default function Settings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  const [response, setResponse] = useState<Response>();
  const [value, setValue] = useState<SettingsValue>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0); const [page, setPage] = useState('');
  const dirty = !!value && JSON.stringify(value) !== JSON.stringify(response?.settings);
  useSettingsEditing(dirty, busy, onEditingStateChange);
  useEffect(() => {
    let active = true;
    apiFetch<Response>({ path }).then(next => { if (active) { setResponse(next); setValue(next.settings); setPage(next.test_url); setError(''); } })
      .catch(reason => { if (active) setError(messageOf(reason)); });
    return () => { active = false; };
  }, [reload]);
  const change = (patch: Partial<SettingsValue>) => { setValue(old => old ? { ...old, ...patch } : old); setSaved(false); };
  const save = async () => {
    setBusy(true); setError('');
    try { const next = await apiFetch<Response>({ path, method: 'POST', data: value }); setResponse(next); setValue(next.settings); setSaved(true); }
    catch (reason) { setError(messageOf(reason)); } finally { setBusy(false); }
  };
  let testUrl = '';
  try { const url = new URL(page); if (response && url.origin === new URL(response.home).origin && ['http:', 'https:'].includes(url.protocol)) { url.searchParams.set('wconvert-analytics', '1'); testUrl = url.href; } } catch { /* Invalid input is kept editable. */ }
  return <Region><RegionHeader title={__('Google Analytics 4', 'wconvert')} description={__('Measure campaign appearances and accepted outcomes using the tracking already installed on your website.', 'wconvert')} />
    <RegionBody className="flex min-w-0 flex-col gap-5">
      {error && <div role="alert"><p>{error}</p>{!response && <Button variant="outline" onClick={() => setReload(n => n + 1)}>{__('Retry', 'wconvert')}</Button>}</div>}
      {!value || !response ? <p>{__('Loading analytics settings…', 'wconvert')}</p> : <>
        {!response.asset_available && <p role="alert">{__('The analytics script is missing. Reinstall WConvert Pro to restore the integration.', 'wconvert')}</p>}
        {response.environment !== 'production' && <p role="status">{__('Routine tracking is disabled in this environment. Use a test property in the website diagnostic panel.', 'wconvert')} ({response.environment})</p>}
        {!response.site_matches && value.enabled && <p role="status">{__('This configuration came from another site. Review the stream and save to activate it here.', 'wconvert')}</p>}
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
          <label className="flex gap-2 items-center"><input type="checkbox" checked={value.enabled} onChange={e => change({ enabled: e.target.checked })} />{__('Enable GA4 integration', 'wconvert')}</label>
          <p className="text-note text-muted-foreground">{__('Applies to existing and future published campaigns that use the site setting. WConvert does not install a Google tag.', 'wconvert')} {sprintf(__('%s published designs currently opt out.', 'wconvert'), String(response.excluded))}</p>
          <label>{__('Connection method', 'wconvert')}<select className={selectClass} value={value.route} onChange={e => change({ route: e.target.value as SettingsValue['route'] })}><option value="gtag">{__('Existing Google tag', 'wconvert')}</option><option value="gtm">{__('Google Tag Manager', 'wconvert')}</option></select></label>
          {value.route === 'gtag' ? <label>{__('GA4 Measurement ID', 'wconvert')}<Input value={value.measurement_id} placeholder="G-XXXXXXXXXX" maxLength={22} onChange={e => change({ measurement_id: e.target.value.trim().toUpperCase() })} /><span className="text-note">{__('Use the web stream already configured by your Google tag. A property number or GTM container ID will not work.', 'wconvert')}</span></label>
            : <p>{__('Configure the WConvert custom-event trigger and GA4 event tag in your existing container. Saving here does not publish GTM changes.', 'wconvert')}</p>}
          <label>{__('Consent handling', 'wconvert')}<select className={selectClass} value={value.consent} onChange={e => change({ consent: e.target.value as SettingsValue['consent'] })}><option value="wp">{__('Follow an initialized WP Consent API integration', 'wconvert')}</option><option value="site">{__('Existing Google tag / GTM manages consent', 'wconvert')}</option></select></label>
          <p className="text-note">{value.consent === 'wp' ? __('Requires an initialized consent manager exposing statistics permission. Missing or unknown permission withholds events.', 'wconvert') : __('Your existing tag configuration controls collection. WConvert cannot verify permission in this mode; advanced Google Consent Mode may send cookieless requests. WConvert never grants consent.', 'wconvert')}</p>
          <details><summary>{__('Advanced settings', 'wconvert')}</summary><div className="flex flex-col gap-3 py-3">
            <label className="flex gap-2"><input type="checkbox" checked={value.dismissals} onChange={e => change({ dismissals: e.target.checked })} />{__('Include deliberate dismissal events', 'wconvert')}</label>
            <label className="flex gap-2"><input type="checkbox" checked={value.exclude_managers} onChange={e => change({ exclude_managers: e.target.checked })} />{__('Exclude logged-in campaign managers', 'wconvert')}</label>
            {value.route === 'gtm' && <label>{__('Data-layer name', 'wconvert')}<Input value={value.data_layer} maxLength={40} onChange={e => change({ data_layer: e.target.value })} /></label>}
          </div></details>
          <div><Button disabled={!dirty && response.site_matches} onClick={() => void save()}>{busy ? __('Saving…', 'wconvert') : __('Save settings', 'wconvert')}</Button></div>
        </fieldset>
        {saved && <p role="status">{__('Settings saved. Known page caches were purged; clear any other page/CDN cache. Receipt still needs verification in Google Analytics.', 'wconvert')}</p>}
        <details><summary>{__('Test and verify', 'wconvert')}</summary><div className="flex flex-col gap-3 py-3">
          <p>{__('Open a page containing a campaign while logged in. The panel inspects locally; a separate button sends a real synthetic event. Enter a dedicated test stream for direct GA or use a test GTM workspace. Consent rules still apply.', 'wconvert')}</p>
          <label>{__('Website page URL', 'wconvert')}<Input type="url" value={page} onChange={e => setPage(e.target.value)} /></label>
          {testUrl && !dirty ? <a href={testUrl} target="_blank" rel="noreferrer">{__('Open website diagnostics', 'wconvert')}</a> : <p>{__('Save settings and enter a URL on this site to test.', 'wconvert')}</p>}
          <p>{__('Look for wconvert_test in GA DebugView or Realtime. A successful local handoff does not prove Google received it.', 'wconvert')}</p>
        </div></details>
        <details><summary>{__('Events and reporting setup', 'wconvert')}</summary><div className="flex flex-col gap-3 py-3">
          <p>{__('Events: wconvert_impression, generate_lead, wconvert_conversion, and optional wconvert_dismiss. Optional SMS does not generate a second lead. Quiz completion and contact capture are separate outcomes.', 'wconvert')}</p>
          <p>{__('Create event-scoped custom dimensions for wcv_campaign_id and, when needed, wcv_campaign_label, wcv_optin_id, wcv_display_type, wcv_outcome and wcv_capture_role. Filter generate_lead by WConvert campaign metadata. Report availability can take 24–48 hours.', 'wconvert')}</p>
          <p>{__('Use one route; remove only older duplicate WConvert tags. Existing generate_lead key-event settings in GA apply to these leads too.', 'wconvert')}</p>
          <a href={response.guide_url} target="_blank" rel="noreferrer">{__('Setup guide, GTM recipe and reporting examples', 'wconvert')}</a>
          <a href="https://developers.google.com/analytics/devguides/collection/ga4/event-parameters" target="_blank" rel="noreferrer">{__('Google: event parameters and custom dimensions', 'wconvert')}</a>
        </div></details>
      </>}
    </RegionBody></Region>;
}

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { AdminDialog, AdminDialogBody, AdminDialogClose, AdminDialogContent, AdminDialogFooter, AdminDialogHeader, AdminDialogTrigger } from '@/components/ui/admin-dialog';
import { InfoTip } from '@/shell/InfoTip';
import { CheckRow } from '@/shell/CheckRow';
import { Disclosure } from '@/shell/Disclosure';
import { Field } from '@/shell/Field';
import { OptionStrip } from '@/shell/OptionStrip';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter, RegionHeader } from '@/shell/Region';
import { RegionSkeleton } from '@/shell/RegionSkeleton';
import { SaveStatus, useSaveStatus } from '@/shell/SaveStatus';
import { failed, messageOf, type Loadable } from '@/shell/loadable';
import { useSettingsEditing, type SettingsEditing } from '@/settings-page/useSettingsEditing';
import { path, type Response, type SettingsValue } from './api';

export default function Settings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  const [loaded, setLoaded] = useState<Loadable<Response>>({ status: 'loading' });
  const [value, setValue] = useState<SettingsValue>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState('');
  const saveButton = useRef<HTMLButtonElement>(null);
  const status = useSaveStatus();
  const ids = useId();
  const response = loaded.status === 'ready' ? loaded.data : undefined;
  const dirty = !!value && JSON.stringify(value) !== JSON.stringify(response?.settings);
  useSettingsEditing(dirty, busy, onEditingStateChange);

  useEffect(() => {
    let active = true;
    setLoaded({ status: 'loading' });
    apiFetch<Response>({ path }).then(next => {
      if (active) { setLoaded({ status: 'ready', data: next }); setValue(next.settings); setPage(next.test_url); }
    }).catch(reason => { if (active) setLoaded(failed(reason)); });
    return () => { active = false; };
  }, [retry]);

  const change = (patch: Partial<SettingsValue>) => { status.clear(); setValue(old => old ? { ...old, ...patch } : old); };
  const save = async () => {
    if (!value || busy) return;
    setBusy(true); setError(''); status.clear();
    try {
      const next = await apiFetch<Response>({ path, method: 'POST', data: value });
      setLoaded({ status: 'ready', data: next }); setValue(next.settings); status.markSaved();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); requestAnimationFrame(() => saveButton.current?.focus()); }
  };

  const title = __('Analytics integrations', 'wconvert');
  if (loaded.status === 'failed') return <Region>
    <RegionHeader title={title} />
    <RegionErrorState message={loaded.message} onRetry={() => setRetry(n => n + 1)} />
  </Region>;
  if (!response || !value) return <RegionSkeleton label={title} lines={4} />;

  let testUrl = '';
  try {
    const url = new URL(page);
    if (url.origin === new URL(response.home).origin && ['http:', 'https:'].includes(url.protocol)) {
      url.searchParams.set('wconvert-analytics', '1'); testUrl = url.href;
    }
  } catch { /* Keep an incomplete URL editable. */ }
  const plausible = value.route === 'plausible';
  const paused = response.environment !== 'production';
  const needsReview = !response.site_matches && value.enabled;
  // Save on a clean form re-confirms a moved site — and only then, with the
  // sentence that says so beside it. Off, there is nothing to resume.
  const reconfirm = !dirty && needsReview;
  const on = value.enabled;
  const live = response.settings.enabled && response.site_matches && !paused ? sendingLine(response.settings) : null;
  const testBlocked = dirty || busy || !response.asset_available;
  // The sentence that says why Test setup is refused, so a keyboard user hears it with the button (§14).
  const testReason = !response.asset_available ? `${ids}-asset` : dirty ? `${ids}-unsaved` : undefined;

  return <Region>
    <RegionHeader title={title} description={__('Track published campaigns through your existing analytics setup.', 'wconvert')} />
    {error && <RegionError message={error} />}
    <RegionBody className="grid gap-5">
      {/* A site problem, not a failed read: it stays until the files are restored. */}
      {!response.asset_available && <Alert variant="destructive" className="border-destructive/30 bg-destructive-surface">
        <CircleAlert />
        <AlertTitle id={`${ids}-asset`} className="line-clamp-none">{__('The analytics script is missing. Reinstall WConvert Pro to restore it.', 'wconvert')}</AlertTitle>
      </Alert>}
      {/* What the SAVED setup is doing, so nobody opens the fields to find out. */}
      {live && <p className="m-0 font-medium">{live}</p>}
      <fieldset disabled={busy} className="m-0 grid min-w-0 gap-5 border-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CheckRow className="font-medium" label={__('Enable analytics integration', 'wconvert')} checked={value.enabled} data-setting="analytics-enabled" onChange={e => change({ enabled: e.target.checked })} />
          {paused && <Badge variant="warning">{__('Non-production site', 'wconvert')}</Badge>}
        </div>
        {/* Off, the machinery is hidden, not cleared: turning it back on finds the draft as it was. */}
        {!on && <p className="m-0 text-note text-muted-foreground">{__('Off. Campaign events aren’t sent to Google Analytics, GTM or Plausible.', 'wconvert')}</p>}
        {on && paused && <p className="m-0 text-note text-muted-foreground">{__('Tracking is paused here. Diagnostics remain available.', 'wconvert')}</p>}
        {needsReview && <p id={`${ids}-review`} className="m-0 text-note">{__('Site address changed. Review this connection and save to resume tracking.', 'wconvert')}</p>}

        {on && <>
        <Choices setting="analytics-method" label={__('Connection method', 'wconvert')} value={value.route} onChange={route => change({ route, ...((route === 'plausible') !== plausible ? { consent: 'wp' as const } : {}) })}
          options={[['gtag', __('Google tag', 'wconvert')], ['gtm', __('Google Tag Manager', 'wconvert')], ['plausible', __('Plausible', 'wconvert')]]} />
        {value.route === 'gtag' ? <div className="grid gap-1.5">
          <div className="flex items-center gap-1"><label htmlFor="analytics-stream" className="font-medium">{__('Measurement ID', 'wconvert')}</label>
            <InfoTip label={__('About the Measurement ID', 'wconvert')}>{__('Use the G- ID of the web stream already installed on this site. WConvert does not install a Google tag.', 'wconvert')}</InfoTip>
          </div>
          <Input id="analytics-stream" data-setting="analytics-measurement" className="max-w-sm" value={value.measurement_id} placeholder="G-XXXXXXXXXX" maxLength={22} dir="ltr" autoComplete="off" onChange={e => change({ measurement_id: e.target.value.trim().toUpperCase() })} />
        </div> : plausible ? <p className="m-0 text-note text-muted-foreground">{__('Uses your installed Plausible script. Custom events count toward Plausible usage.', 'wconvert')} <a href={response.guide_url + '#plausible'} target="_blank" rel="noreferrer" className="underline">{__('Plausible setup', 'wconvert')}</a></p> : <p className="m-0 text-note text-muted-foreground">{__('Add the WConvert event tag to your container, then publish it.', 'wconvert')} <a href={response.guide_url + '#gtm'} target="_blank" rel="noreferrer" className="underline">{__('GTM setup', 'wconvert')}</a></p>}

        <div className="grid gap-2">
          <Choices label={__('Consent handling', 'wconvert')} value={value.consent} onChange={consent => change({ consent })}
            setting="analytics-consent"
            options={[['wp', __('WP Consent API', 'wconvert')], ['site', plausible ? __('Existing tracker', 'wconvert') : __('Google tag / GTM', 'wconvert')]]}
            help={<InfoTip label={__('About consent handling', 'wconvert')}>{value.consent === 'wp'
              ? __('Requires an initialized WP Consent API integration. Missing or denied permission withholds events; earlier events are not replayed.', 'wconvert')
              : plausible ? __('WConvert sends events without checking consent in this mode. Choose this only when your existing Plausible setup matches your site’s collection policy.', 'wconvert')
              : __('Choose this only if consent is already configured in your tag or container. WConvert cannot verify permission in this mode and never grants consent. Advanced Google Consent Mode may send cookieless requests.', 'wconvert')}</InfoTip>} />
          <p className="m-0 text-note text-muted-foreground">{value.consent === 'wp'
            ? __('Send only when your consent manager allows statistics.', 'wconvert')
            : plausible ? __('Send through Plausible without a WConvert consent check.', 'wconvert')
            : __('Your Google tag or GTM controls consent, including cookieless requests.', 'wconvert')}</p>
        </div>

        <div className="border-t border-border pt-2">
          <Disclosure variant="inline" title={__('Advanced settings', 'wconvert')} bodyClassName="gap-4">
            <CheckRow label={__('Track dismissals', 'wconvert')} data-setting="analytics-dismissals" checked={value.dismissals} onChange={e => change({ dismissals: e.target.checked })} />
            <CheckRow label={__('Exclude your team', 'wconvert')} data-setting="analytics-team" hint={__('Visits by people who can manage campaigns are not tracked.', 'wconvert')}
              checked={value.exclude_managers} onChange={e => change({ exclude_managers: e.target.checked })} />
            {value.route === 'gtm' && <Field label={__('Data-layer name', 'wconvert')} htmlFor={`${ids}-layer`}>
              <Input id={`${ids}-layer`} className="max-w-sm" value={value.data_layer} maxLength={40} dir="ltr" onChange={e => change({ data_layer: e.target.value })} />
            </Field>}
            <p className="m-0 text-note text-muted-foreground">{__('Includes existing and future campaigns unless excluded in campaign details.', 'wconvert')}{response.excluded > 0 && <> {sprintf(_n('%s published campaign is excluded.', '%s published campaigns are excluded.', response.excluded, 'wconvert'), String(response.excluded))}</>}</p>
          </Disclosure>
        </div>
        </>}
      </fieldset>
    </RegionBody>
    <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">{on && <AdminDialog>
        <AdminDialogTrigger asChild><Button variant="outline" disabled={busy} aria-disabled={testBlocked || undefined} aria-describedby={testReason}
          onClick={event => { if (testBlocked) event.preventDefault(); }}>{__('Test setup', 'wconvert')}</Button></AdminDialogTrigger>
        <TestDialog page={page} onPage={setPage} testUrl={testUrl} plausible={plausible} />
      </AdminDialog>}<a className="text-note underline underline-offset-2" href={response.guide_url} target="_blank" rel="noreferrer">{__('Setup guide', 'wconvert')}</a></div>
      <div className="flex flex-wrap items-center gap-3">
        {dirty && on && <span id={`${ids}-unsaved`} className="text-note text-muted-foreground">{__('Save changes before testing.', 'wconvert')}</span>}
        <SaveStatus saved={status.saved} />
        {dirty && <Button variant="ghost" disabled={busy} onClick={() => { setValue(response.settings); setError(''); }}>{__('Cancel changes', 'wconvert')}</Button>}
        <Button ref={saveButton} disabled={busy || (!dirty && !reconfirm)} aria-describedby={reconfirm ? `${ids}-review` : undefined} onClick={() => void save()}>{busy ? __('Saving…', 'wconvert') : __('Save analytics integration', 'wconvert')}</Button>
      </div>
    </RegionFooter>
  </Region>;
}

/** Diagnostics open on a page of this site; anything else is refused with its reason beside the button. */
function TestDialog({ page, onPage, testUrl, plausible }: { page: string; onPage: (page: string) => void; testUrl: string; plausible: boolean }) {
  const id = useId();
  return <AdminDialogContent size="sm">
    <AdminDialogHeader title={__('Test analytics', 'wconvert')} meta={__('Inspect a page with a campaign. Events stay local until you send a test.', 'wconvert')} />
    <AdminDialogBody className="grid content-start gap-4">
      <Field label={__('Website page URL', 'wconvert')} htmlFor={`${id}-url`}>
        <Input id={`${id}-url`} type="url" dir="ltr" value={page} aria-describedby={testUrl ? undefined : `${id}-refused`} onChange={e => onPage(e.target.value)} />
      </Field>
      <p className="m-0 text-note text-muted-foreground">{plausible ? __('Tests go to the site configured by your Plausible script. Use a dedicated test site, clear page caches, and verify WConvert Test in Plausible.', 'wconvert') : __('Use a test property and clear any page/CDN cache first. Verify receipt in GA DebugView.', 'wconvert')}</p>
    </AdminDialogBody>
    <AdminDialogFooter back={<AdminDialogClose asChild><Button variant="outline">{__('Cancel', 'wconvert')}</Button></AdminDialogClose>}
      note={testUrl ? undefined : <span id={`${id}-refused`} role="status">{__('Enter a URL on this website.', 'wconvert')}</span>}>
      {testUrl ? <Button asChild><a href={testUrl} target="_blank" rel="noreferrer">{__('Open diagnostics', 'wconvert')}</a></Button>
        : <Button aria-disabled="true" aria-describedby={`${id}-refused`}>{__('Open diagnostics', 'wconvert')}</Button>}
    </AdminDialogFooter>
  </AdminDialogContent>;
}

/**
 * One line naming what the saved setup sends and under which consent, e.g.
 * "Sending campaign events to Google tag G-ABC123, with WP Consent API."
 */
function sendingLine(settings: SettingsValue): string {
  const to = settings.route === 'plausible' ? __('Plausible', 'wconvert')
    : settings.route === 'gtm' ? __('Google Tag Manager', 'wconvert')
      : settings.measurement_id
        /* translators: %s: a Google Analytics measurement ID, e.g. “G-ABC123”. */
        ? sprintf(__('Google tag %s', 'wconvert'), settings.measurement_id)
        : __('Google tag', 'wconvert');
  const consent = settings.consent === 'wp' ? __('with WP Consent API', 'wconvert')
    : settings.route === 'plausible' ? __('without a WConvert consent check', 'wconvert')
      : __('with consent handled by your tag', 'wconvert');
  /* translators: 1: where events go, e.g. “Google tag G-ABC123”; 2: the consent handling, e.g. “with WP Consent API”. */
  return sprintf(__('Sending campaign events to %1$s, %2$s.', 'wconvert'), to, consent);
}

/** Small exclusive choices: the shared OptionStrip, under a visible label that names the group. */
function Choices<T extends string>({ label, value, options, help, setting, onChange }: { label: string; help?: ReactNode; value: T; options: [T, string][]; setting?: string; onChange(value: T): void }) {
  return <div className="grid gap-2" data-setting={setting}>
    <div className="flex items-center gap-1"><span aria-hidden="true" className="font-medium">{label}</span>{help}</div>
    <OptionStrip label={label} value={value} options={options.map(([key, name]) => ({ value: key, label: name }))} onChange={next => onChange(next as T)} />
  </div>;
}

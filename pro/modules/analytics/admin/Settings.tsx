import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { InfoTip } from '@/shell/InfoTip';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter, RegionHeader } from '@/shell/Region';
import { RegionSkeleton } from '@/shell/RegionSkeleton';
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

  const change = (patch: Partial<SettingsValue>) => setValue(old => old ? { ...old, ...patch } : old);
  const save = async () => {
    if (!value || busy) return;
    setBusy(true); setError('');
    try {
      const next = await apiFetch<Response>({ path, method: 'POST', data: value });
      setLoaded({ status: 'ready', data: next }); setValue(next.settings);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); requestAnimationFrame(() => saveButton.current?.focus()); }
  };

  const title = __('Google Analytics 4', 'wconvert');
  if (loaded.status === 'failed') return <Region>
    <RegionHeader title={title} />
    <RegionErrorState message={loaded.message} hint={__('Load the connection settings again.', 'wconvert')}
      action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} />
  </Region>;
  if (!response || !value) return <RegionSkeleton label={title} lines={4} />;

  let testUrl = '';
  try {
    const url = new URL(page);
    if (url.origin === new URL(response.home).origin && ['http:', 'https:'].includes(url.protocol)) {
      url.searchParams.set('wconvert-analytics', '1'); testUrl = url.href;
    }
  } catch { /* Keep an incomplete URL editable. */ }
  const paused = response.environment !== 'production';
  const needsReview = !response.site_matches && value.enabled;
  const testBlocked = dirty || busy || !response.asset_available;

  return <Region>
    <RegionHeader title={title} description={__('Track published campaigns through your existing Google tag.', 'wconvert')} />
    {error && <RegionError message={error} />}
    {!response.asset_available && <RegionError message={__('Analytics script missing. Reinstall WConvert Pro to restore it.', 'wconvert')} />}
    <RegionBody className="grid gap-5">
      <fieldset disabled={busy} className="m-0 grid min-w-0 gap-5 border-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={value.enabled} onChange={e => change({ enabled: e.target.checked })} />{__('Enable GA4 integration', 'wconvert')}</label>
          {paused && <Badge variant="warning">{__('Non-production site', 'wconvert')}</Badge>}
        </div>
        {paused && <p className="m-0 text-note text-muted-foreground">{__('Tracking is paused here. Diagnostics remain available.', 'wconvert')}</p>}
        {needsReview && <p className="m-0 text-note">{__('Site address changed. Review this connection and save to resume tracking.', 'wconvert')}</p>}

        <Choices label={__('Connection method', 'wconvert')} value={value.route} onChange={route => change({ route })}
          options={[['gtag', __('Google tag', 'wconvert')], ['gtm', __('Google Tag Manager', 'wconvert')]]} />
        {value.route === 'gtag' ? <div className="grid gap-2">
          <div className="flex items-center gap-1"><label htmlFor="analytics-stream" className="font-medium">{__('Measurement ID', 'wconvert')}</label>
            <InfoTip label={__('About the Measurement ID', 'wconvert')}>{__('Use the G- ID of the web stream already installed on this site. WConvert does not install a Google tag.', 'wconvert')}</InfoTip>
          </div>
          <Input id="analytics-stream" className="max-w-sm" value={value.measurement_id} placeholder="G-XXXXXXXXXX" maxLength={22} dir="ltr" autoComplete="off" onChange={e => change({ measurement_id: e.target.value.trim().toUpperCase() })} />
        </div> : <p className="m-0 text-note text-muted-foreground">{__('Add the WConvert event tag to your container, then publish it.', 'wconvert')} <a href={response.guide_url + '#gtm'} target="_blank" rel="noreferrer" className="underline">{__('GTM setup', 'wconvert')}</a></p>}

        <div className="grid gap-2">
          <Choices label={__('Consent handling', 'wconvert')} value={value.consent} onChange={consent => change({ consent })}
            options={[['wp', __('WP Consent API', 'wconvert')], ['site', __('Google tag / GTM', 'wconvert')]]}
            help={<InfoTip label={__('About consent handling', 'wconvert')}>{value.consent === 'wp'
              ? __('Requires an initialized WP Consent API integration. Missing or denied permission withholds events; earlier events are not replayed.', 'wconvert')
              : __('Choose this only if consent is already configured in your tag or container. WConvert cannot verify permission in this mode and never grants consent. Advanced Google Consent Mode may send cookieless requests.', 'wconvert')}</InfoTip>} />
          <p className="m-0 text-note text-muted-foreground">{value.consent === 'wp'
            ? __('Send only when your consent manager allows statistics.', 'wconvert')
            : __('Your Google tag or GTM controls consent, including cookieless requests.', 'wconvert')}</p>
        </div>

        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer text-body font-medium">{__('Advanced settings', 'wconvert')}</summary>
          <div className="grid gap-4 pt-4">
            <label className="flex items-start gap-2"><input type="checkbox" checked={value.dismissals} onChange={e => change({ dismissals: e.target.checked })} />{__('Track dismissals', 'wconvert')}</label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={value.exclude_managers} onChange={e => change({ exclude_managers: e.target.checked })} />{__('Exclude campaign managers', 'wconvert')}</label>
            {value.route === 'gtm' && <label className="grid gap-2">{__('Data-layer name', 'wconvert')}<Input className="max-w-sm" value={value.data_layer} maxLength={40} dir="ltr" onChange={e => change({ data_layer: e.target.value })} /></label>}
            <p className="m-0 text-note text-muted-foreground">{__('Includes existing and future campaigns unless excluded in campaign details.', 'wconvert')}{response.excluded > 0 && <> {sprintf(_n('%s published design is excluded.', '%s published designs are excluded.', response.excluded, 'wconvert'), String(response.excluded))}</>}</p>
          </div>
        </details>
      </fieldset>
    </RegionBody>
    <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3"><Dialog>
        <DialogTrigger asChild><Button variant="outline" disabled={busy} aria-disabled={testBlocked || undefined} aria-describedby={dirty ? 'analytics-unsaved' : undefined}
          onClick={event => { if (testBlocked) event.preventDefault(); }}>{__('Test setup', 'wconvert')}</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{__('Test analytics', 'wconvert')}</DialogTitle>
            <DialogDescription>{__('Inspect a page with a campaign. Events stay local until you explicitly send a test.', 'wconvert')}</DialogDescription>
          </DialogHeader>
          <label className="grid gap-2">{__('Website page URL', 'wconvert')}<Input type="url" dir="ltr" value={page} onChange={e => setPage(e.target.value)} /></label>
          {!testUrl && <p role="status" className="m-0 text-note">{__('Enter a URL on this website.', 'wconvert')}</p>}
          <p className="m-0 text-note text-muted-foreground">{__('Use a test property and clear any page/CDN cache first. Verify receipt in GA DebugView.', 'wconvert')}</p>
          <DialogFooter><DialogClose asChild><Button variant="outline">{__('Cancel', 'wconvert')}</Button></DialogClose>
            {testUrl ? <Button asChild><a href={testUrl} target="_blank" rel="noreferrer">{__('Open diagnostics', 'wconvert')}</a></Button>
              : <Button aria-disabled="true">{__('Open diagnostics', 'wconvert')}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog><a className="text-note underline underline-offset-2" href={response.guide_url} target="_blank" rel="noreferrer">{__('Setup guide', 'wconvert')}</a></div>
      <div className="flex flex-wrap items-center gap-3">
        {dirty && <span id="analytics-unsaved" className="text-note text-muted-foreground">{__('Save changes before testing.', 'wconvert')}</span>}
        {dirty && <Button variant="ghost" disabled={busy} onClick={() => { setValue(response.settings); setError(''); }}>{__('Cancel changes', 'wconvert')}</Button>}
        <Button ref={saveButton} disabled={busy || (!dirty && response.site_matches)} onClick={() => void save()}>{busy ? __('Saving…', 'wconvert') : __('Save settings', 'wconvert')}</Button>
      </div>
    </RegionFooter>
  </Region>;
}

/** Small exclusive choices use the shared native-radio chip treatment. */
function Choices<T extends string>({ label, value, options, help, onChange }: { label: string; help?: ReactNode; value: T; options: [T, string][]; onChange(value: T): void }) {
  const id = useId();
  return <div className="grid gap-2">
    <div className="flex items-center gap-1"><span id={id} className="font-medium">{label}</span>{help}</div>
    <div role="group" aria-labelledby={id} className="wconvert-option-strip">
      {options.map(([key, name]) => <label key={key} className="py-2">
        <input type="radio" name={id} value={key} checked={key === value} onChange={() => onChange(key)} />{name}
      </label>)}
    </div>
  </div>;
}

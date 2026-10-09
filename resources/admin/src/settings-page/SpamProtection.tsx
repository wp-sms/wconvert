import { verify, type Challenge } from '../../../loader/src/protection';
import { useEffect, useId, useRef, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { CircleAlert, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { Textarea } from '../components/ui/textarea';
import { Region, RegionBody, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { Description } from '../shell/Description';
import { Disclosure } from '../shell/Disclosure';
import { Field } from '../shell/Field';
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { messageOf } from '../shell/loadable';
import { formatCount, formatWhen, labelOf } from '../lib/format';
import { useSettingsEditing, type SettingsEditing } from './useSettingsEditing';

type Provider = 'none' | 'turnstile' | 'recaptcha' | 'hcaptcha';
interface Settings {
  site_hostname: string; provider: Provider; site_key: string; has_secret: boolean; rules_available: boolean; rules_configured: boolean;
  rule_fields: { id: string; label: string; help: string; value: string }[];
  diagnostics: { since: number; counts: Record<string, number> };
}
interface Draft { provider: Provider; site_key: string; secret: string; rules?: Record<string, string> | never[]; }
const draftOf = (s: Settings): Draft => ({ provider: s.provider, site_key: s.site_key, secret: '',
  ...(s.rules_available ? { rules: Object.fromEntries(s.rule_fields.map(f => [f.id, f.value])) } : {}) });
const links: Record<Exclude<Provider, 'none'>, string> = {
  turnstile: 'https://dash.cloudflare.com/?to=/:account/turnstile',
  recaptcha: 'https://www.google.com/recaptcha/admin/create',
  hcaptcha: 'https://dashboard.hcaptcha.com/sites',
};
export function SpamProtection({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  const id = useId();
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const testButton = useRef<HTMLButtonElement>(null);
  const status = useSaveStatus();
  const [testNotice, setTestNotice] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoadError(null);
    void apiFetch<Settings>({ path: '/wconvert/v1/protection' }).then(data => {
      if (active) { setSaved(data); setDraft(draftOf(data)); }
    }).catch(cause => { if (active) setLoadError(messageOf(cause)); });
    return () => { active = false; };
  }, [retry]);
  const dirty = saved !== null && draft !== null && JSON.stringify(draft) !== JSON.stringify(draftOf(saved));
  useSettingsEditing(dirty, busy, onEditingStateChange);
  async function test() {
    if (busy || dirty) return;
    setBusy(true); setTesting(true); setError(null); setTestNotice(false);
    try {
      const response = await apiFetch<{ challenge: Challenge }>({ path: '/wconvert/v1/protection/test', method: 'POST', data: {} });
      const token = await verify(response.challenge);
      await apiFetch({ path: '/wconvert/v1/protection/test', method: 'POST', data: { verification_token: token } });
      setTestNotice(true);
    } catch (cause) { setError(cause && typeof cause === 'object' && 'message' in cause ? messageOf(cause) : __('Test failed. Check your saved keys and hostname, then try again.', 'wconvert')); }
    finally { setBusy(false); setTesting(false); requestAnimationFrame(() => testButton.current?.focus()); }
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true); setError(null); setTestNotice(false);
    try {
      const data = await apiFetch<Settings>({ path: '/wconvert/v1/protection', method: 'POST', data: draft });
      setSaved(data); setDraft(draftOf(data)); status.markSaved();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  const title = __('Spam protection', 'wconvert');
  if (!saved || !draft) return loadError
    ? <Region><RegionHeader title={title} /><RegionErrorState message={loadError} onRetry={() => setRetry(v => v + 1)} /></Region>
    : <RegionSkeleton label={title} lines={3} />;
  const edit = (change: Partial<Draft>) => { setDraft({ ...draft, ...change }); status.clear(); setTestNotice(false); setError(null); };
  const reasons: Record<string, string> = {
    honeypot: __('Hidden-field rejections', 'wconvert'), rate_limit: __('Requests limited', 'wconvert'),
    challenge_failed: __('Incomplete verifications', 'wconvert'), provider_unavailable: __('Verification service errors', 'wconvert'),
    verified: __('Successful verifications', 'wconvert'), filter: __('Email filter rejections', 'wconvert'), send_limited: __('Repeat resource emails prevented', 'wconvert'),
  };
  const counts = Object.entries(saved.diagnostics.counts);
  const noSavedRules = saved.rule_fields.every(f => f.value.trim() === '');
  const rulesHelp = <Description>{__('Apply to every campaign. Leave a list empty to allow all emails.', 'wconvert')}</Description>;
  const ruleFields = <>
    {saved.rule_fields.map(f => <Field key={f.id} label={f.label} htmlFor={`${id}-${f.id}`} hint={f.help} hintId={`${id}-${f.id}-hint`}>
      <Textarea id={`${id}-${f.id}`} data-setting={`rule-${f.id}`} rows={3} aria-describedby={`${id}-${f.id}-hint`} value={(draft.rules as Record<string, string> | undefined)?.[f.id] ?? ''} onChange={e => edit({ rules: { ...draft.rules, [f.id]: e.target.value } })} />
    </Field>)}
  </>;
  const keyHelp = draft.provider === 'turnstile' ? __('Use a Managed widget.', 'wconvert')
    : draft.provider === 'recaptcha' ? __('Use v2 checkbox keys. v3 and Cloud API keys are not supported.', 'wconvert')
      : __('Use standard hCaptcha keys.', 'wconvert');
  return <div className="grid gap-6"><Region>
    <RegionHeader title={title} description={__('Built-in checks always slow bots, rapid submissions and repeated resource emails.', 'wconvert')} />
    <RegionBody className="grid gap-5">
      <fieldset disabled={busy} className="m-0 grid min-w-0 gap-5 border-0 p-0">
        <Field label={__('Bot verification', 'wconvert')} htmlFor={`${id}-provider`}>
          <NativeSelect id={`${id}-provider`} data-setting="protection-provider" className="w-full" value={draft.provider} onChange={e => edit({ provider: e.target.value as Provider, site_key: '', secret: '' })}>
            <option value="none">{__('Built-in checks only', 'wconvert')}</option>
            <option value="turnstile">{__('Cloudflare Turnstile (recommended)', 'wconvert')}</option>
            <option value="recaptcha">{__('Google reCAPTCHA v2 checkbox', 'wconvert')}</option>
            <option value="hcaptcha">{__('hCaptcha', 'wconvert')}</option>
          </NativeSelect>
        </Field>
        {draft.provider !== 'none' && <>
          <Description>
            {__('Register this hostname with the provider:', 'wconvert')} <strong className="text-foreground"><bdi>{saved.site_hostname}</bdi></strong>.{' '}
            {__('Use your own keys; the provider may charge.', 'wconvert')}{' '}
            <a href={links[draft.provider]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
              {__('Get keys', 'wconvert')}<ExternalLink aria-hidden="true" className="size-3 rtl:-scale-x-100" />
              <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
            </a>
          </Description>
          <Field label={__('Site key', 'wconvert')} htmlFor={`${id}-site`} hint={keyHelp} hintId={`${id}-site-hint`}>
            <Input id={`${id}-site`} data-setting="protection-site-key" autoComplete="off" aria-describedby={`${id}-site-hint`} value={draft.site_key} onChange={e => edit({ site_key: e.target.value.trim() })} />
          </Field>
          <Field label={__('Secret key', 'wconvert')} htmlFor={`${id}-secret`}>
            <Input id={`${id}-secret`} type="password" autoComplete="new-password" value={draft.secret} onChange={e => edit({ secret: e.target.value.trim() })} placeholder={saved.has_secret && saved.provider === draft.provider ? __('Saved — leave empty to keep', 'wconvert') : ''} />
          </Field>
          <Description>{__('Every form then asks for verification. The provider receives browser and network data, not form answers, so mention it in your privacy notice. Save, test, then try a published form.', 'wconvert')}</Description>
        </>}
        {saved.rules_available && (noSavedRules
          // Three empty boxes are ~450px of nothing on most sites: folded, the
          // summary says what they amount to. Keyed on the SAVED lists, so
          // typing into one never refolds the box under the cursor.
          ? <div className="border-t border-border pt-4">
            <Disclosure title={__('Email filters', 'wconvert')} summary={__('No emails blocked', 'wconvert')} bodyClassName="grid gap-4">
              {rulesHelp}
              {ruleFields}
            </Disclosure>
          </div>
          : <div className="grid gap-4 border-t border-border pt-4">
            <div className="grid gap-1">
              <h3 className="m-0 text-body font-semibold">{__('Email filters', 'wconvert')}</h3>
              {rulesHelp}
            </div>
            {ruleFields}
          </div>)}
        {!saved.rules_available && saved.rules_configured && <Alert variant="destructive" className="border-destructive/30 bg-destructive-surface">
          <CircleAlert />
          <AlertTitle className="line-clamp-none">{__('Forms are paused: saved email filters aren’t available on this site. Remove the filters to resume.', 'wconvert')}</AlertTitle>
          <AlertDescription><Button variant="outline" onClick={() => edit({ rules: [] })}>{__('Remove unavailable filters', 'wconvert')}</Button></AlertDescription>
        </Alert>}
      </fieldset>
    </RegionBody>
    <RegionFooter className="flex flex-wrap items-center gap-3">
      {saved.provider !== 'none' && <>
        <Button ref={testButton} data-setting="protection-test" variant="outline" disabled={busy && !dirty} aria-disabled={dirty || undefined} aria-describedby={dirty ? `${id}-test-reason` : undefined} onClick={() => void test()}>{testing ? __('Testing…', 'wconvert') : __('Test saved setup', 'wconvert')}</Button>
        {dirty && <span id={`${id}-test-reason`} className="text-note">{__('Save changes before testing.', 'wconvert')}</span>}
        {testNotice && <span role="status" className="text-note">{__('Test passed. No lead created or messages sent.', 'wconvert')}</span>}
      </>}
      <div className="ms-auto flex flex-wrap items-center justify-end gap-3">
        {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
        <SaveStatus saved={status.saved} />
        {dirty && <Button variant="outline" disabled={busy} onClick={() => { setDraft(draftOf(saved)); setError(null); }}>{__('Cancel changes', 'wconvert')}</Button>}
        <Button disabled={!dirty || busy} onClick={() => void save()}>{busy && !testing ? __('Saving…', 'wconvert') : __('Save spam protection', 'wconvert')}</Button>
      </div>
    </RegionFooter>
  </Region><Region><RegionHeader title={__('Protection activity', 'wconvert')} description={sprintf(
    /* translators: %s: a date and time. */
    __('Approximate counts since %s. They reset after 24 hours.', 'wconvert'), formatWhen(new Date(saved.diagnostics.since * 1000).toISOString(), 'detail'))} /><RegionBody>
    {counts.length === 0 ? <p className="m-0">{__('No activity yet.', 'wconvert')}</p> : <dl className="m-0 grid gap-3">{counts.map(([key, count]) => <div key={key} className="flex justify-between gap-4"><dt>{labelOf(key, reasons, __('Other checks', 'wconvert'))}</dt><dd className="m-0 tabular-nums">{formatCount(count)}</dd></div>)}</dl>}
    <Description className="mt-4">{__('Counts show checks, not people or confirmed spam. No personal data is stored here.', 'wconvert')}</Description>
  </RegionBody></Region></div>;
}

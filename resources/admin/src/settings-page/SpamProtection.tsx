import { verify, type Challenge } from '../../../loader/src/protection';
import { useEffect, useRef, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Region, RegionBody, RegionError, RegionFooter, RegionHeader } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { messageOf } from '../shell/loadable';
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
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const testButton = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState(false);
  const [testNotice, setTestNotice] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void apiFetch<Settings>({ path: '/wconvert/v1/protection' }).then(data => {
      if (active) { setSaved(data); setDraft(draftOf(data)); }
    }).catch(cause => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [retry]);
  const dirty = saved !== null && draft !== null && JSON.stringify(draft) !== JSON.stringify(draftOf(saved));
  useSettingsEditing(dirty, busy, onEditingStateChange);
  async function test() {
    if (busy) return;
    setBusy(true); setTesting(true); setError(null); setTestNotice(false);
    try {
      const response = await apiFetch<{ challenge: Challenge }>({ path: '/wconvert/v1/protection/test', method: 'POST', data: {} });
      const token = await verify(response.challenge);
      await apiFetch({ path: '/wconvert/v1/protection/test', method: 'POST', data: { verification_token: token } });
      setTestNotice(true);
    } catch (cause) { setError(cause && typeof cause === 'object' && 'message' in cause ? messageOf(cause) : __('Test failed. Check your saved keys and hostname, then retry.', 'wconvert')); }
    finally { setBusy(false); setTesting(false); requestAnimationFrame(() => testButton.current?.focus()); }
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true); setError(null); setNotice(false); setTestNotice(false);
    try {
      const data = await apiFetch<Settings>({ path: '/wconvert/v1/protection', method: 'POST', data: draft });
      setSaved(data); setDraft(draftOf(data)); setNotice(true);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  if (!saved || !draft) return error
    ? <Region><RegionHeader title={__('Spam protection', 'wconvert')} /><RegionError message={error} /><RegionFooter><Button onClick={() => setRetry(v => v + 1)}>{__('Retry', 'wconvert')}</Button></RegionFooter></Region>
    : <RegionSkeleton label={__('Spam protection', 'wconvert')} lines={3} />;
  const edit = (change: Partial<Draft>) => { setDraft({ ...draft, ...change }); setNotice(false); setTestNotice(false); setError(null); };
  const reasons: Record<string, string> = {
    honeypot: __('Hidden-field rejections', 'wconvert'), rate_limit: __('Requests limited', 'wconvert'),
    challenge_failed: __('Incomplete verifications', 'wconvert'), provider_unavailable: __('Verification service errors', 'wconvert'),
    verified: __('Successful verifications', 'wconvert'), filter: __('Email filter rejections', 'wconvert'), send_limited: __('Repeat resource emails prevented', 'wconvert'),
  };
  return <div className="grid gap-6"><Region>
    <RegionHeader title={__('Spam protection', 'wconvert')} description={__('Reduce unwanted form submissions.', 'wconvert')} />
    {error && <RegionError message={error} />}
    <RegionBody className="grid gap-5">
      <p className="m-0 text-note text-muted-foreground">{__('Built-in checks limit bots, rapid submissions and repeated resource emails.', 'wconvert')}</p>
      <fieldset disabled={busy} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <label className="grid gap-2 font-medium" htmlFor="protection-provider">{__('Bot verification', 'wconvert')}
          <select id="protection-provider" className="rounded-md border border-input bg-background p-2 text-body" value={draft.provider} onChange={e => edit({ provider: e.target.value as Provider, site_key: '', secret: '' })}>
            <option value="none">{__('Built-in checks only', 'wconvert')}</option>
            <option value="turnstile">{__('Cloudflare Turnstile (recommended)', 'wconvert')}</option>
            <option value="recaptcha">{__('Google reCAPTCHA v2 checkbox', 'wconvert')}</option>
            <option value="hcaptcha">{__('hCaptcha', 'wconvert')}</option>
          </select>
        </label>
        {draft.provider !== 'none' && <>
          <p className="m-0 text-note">{__('Register this hostname:', 'wconvert')} <strong>{saved.site_hostname}</strong></p>
          <p className="m-0 text-note">{__('Use your own provider keys. Provider charges may apply.', 'wconvert')} <a href={links[draft.provider]} target="_blank" rel="noreferrer" className="underline">{__('Get keys', 'wconvert')}</a></p>
          <p className="m-0 text-note text-muted-foreground">{draft.provider === 'turnstile' ? __('Use a Managed widget.', 'wconvert') : draft.provider === 'recaptcha' ? __('Use v2 checkbox keys. v3 and Cloud API keys are not supported.', 'wconvert') : __('Use standard hCaptcha keys.', 'wconvert')}</p>
          <label className="grid gap-2" htmlFor="protection-site">{__('Site key', 'wconvert')}<Input id="protection-site" autoComplete="off" value={draft.site_key} onChange={e => edit({ site_key: e.target.value.trim() })} /></label>
          <label className="grid gap-2" htmlFor="protection-secret">{__('Secret key', 'wconvert')}<Input id="protection-secret" type="password" autoComplete="new-password" value={draft.secret} onChange={e => edit({ secret: e.target.value.trim() })} placeholder={saved.has_secret && saved.provider === draft.provider ? __('Saved — leave blank to keep', 'wconvert') : ''} /></label>
          <p className="m-0 text-note text-muted-foreground">{__('Verification is required for all forms. Visitors can retry without losing their details. Save, test this setup, then try a published form.', 'wconvert')}</p>
          <p className="m-0 text-note text-muted-foreground">{__('The provider receives browser and network data, not form answers. Update your privacy notice.', 'wconvert')}</p>
        </>}
        {saved.rules_available && <div className="grid gap-4 border-t border-border pt-4"><h3 className="m-0 font-medium">{__('Email filters', 'wconvert')}</h3>
          <p className="m-0 text-note text-muted-foreground">{__('Apply to all campaigns. Leave lists empty to allow all emails.', 'wconvert')}</p>
          {saved.rule_fields.map(f => <label key={f.id} className="grid gap-2" htmlFor={`protection-${f.id}`}>{f.label}<textarea id={`protection-${f.id}`} className="rounded-md border border-input bg-background p-2 text-body" rows={3} value={(draft.rules as Record<string, string> | undefined)?.[f.id] ?? ''} onChange={e => edit({ rules: { ...draft.rules, [f.id]: e.target.value } })} /><span className="text-note text-muted-foreground">{f.help}</span></label>)}
        </div>}
        {!saved.rules_available && saved.rules_configured && <div role="alert"><p>{__('Forms are paused: saved email filters aren’t available on this site. Remove the filters to resume.', 'wconvert')}</p><Button variant="outline" onClick={() => edit({ rules: [] })}>{__('Remove unavailable filters', 'wconvert')}</Button></div>}
      </fieldset>
    </RegionBody>
    <RegionFooter className="flex flex-wrap items-center gap-3"><Button disabled={!dirty || busy} onClick={() => void save()}>{busy && !testing ? __('Saving…', 'wconvert') : __('Save protection', 'wconvert')}</Button><Button variant="outline" disabled={!dirty || busy} onClick={() => { setDraft(draftOf(saved)); setError(null); setNotice(false); }}>{__('Cancel changes', 'wconvert')}</Button>{saved.provider !== 'none' && <Button ref={testButton} variant="outline" disabled={dirty || busy} onClick={() => void test()}>{testing ? __('Testing…', 'wconvert') : __('Test saved setup', 'wconvert')}</Button>}{testNotice && <span role="status">{__('Test passed. No lead created or messages sent.', 'wconvert')}</span>}{notice && <span role="status">{__('Settings saved.', 'wconvert')}</span>}</RegionFooter>
  </Region><Region><RegionHeader title={__('Protection activity', 'wconvert')} description={sprintf(__('Approximate counts since %s. Reset after 24 hours.', 'wconvert'), new Date(saved.diagnostics.since * 1000).toLocaleString())} /><RegionBody>
    {Object.keys(saved.diagnostics.counts).length === 0 ? <p className="m-0">{__('No activity yet.', 'wconvert')}</p> : <dl className="m-0 grid gap-3">{Object.entries(saved.diagnostics.counts).map(([key, count]) => <div key={key} className="flex justify-between gap-4"><dt>{reasons[key] ?? key}</dt><dd className="m-0 tabular-nums">{count}</dd></div>)}</dl>}
    <p className="mb-0 mt-4 text-note text-muted-foreground">{__('Counts show checks, not people or confirmed spam. No personal data is stored here.', 'wconvert')}</p>
  </RegionBody></Region></div>;
}

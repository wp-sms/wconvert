import { verify, type Challenge } from '../../../loader/src/protection';
import { useEffect, useState } from 'react';
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
  provider: Provider; site_key: string; has_secret: boolean; rules_available: boolean; rules_configured: boolean;
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
    setBusy(true); setError(null); setTestNotice(false);
    try {
      const response = await apiFetch<{ challenge: Challenge }>({ path: '/wconvert/v1/protection/test', method: 'POST', data: {} });
      const token = await verify(response.challenge);
      await apiFetch({ path: '/wconvert/v1/protection/test', method: 'POST', data: { verification_token: token } });
      setTestNotice(true);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
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
  const edit = (change: Partial<Draft>) => { setDraft({ ...draft, ...change }); setNotice(false); setError(null); };
  const reasons: Record<string, string> = {
    honeypot: __('Hidden-field checks refused', 'wconvert'), rate_limit: __('Requests limited', 'wconvert'),
    challenge_failed: __('Verifications not completed', 'wconvert'), provider_unavailable: __('Verification service errors', 'wconvert'),
    verified: __('Successful verifications', 'wconvert'), filter: __('Email filters refused', 'wconvert'), send_limited: __('Repeated resource emails suppressed', 'wconvert'),
  };
  return <div className="grid gap-6"><Region>
    <RegionHeader title={__('Spam protection', 'wconvert')} description={__('Built-in checks protect every form. Add a verification service when you need stronger bot protection.', 'wconvert')} />
    {error && <RegionError message={error} />}
    <RegionBody className="grid gap-5">
      <p className="m-0 text-note text-muted-foreground">{__('Active in Free and Pro: hidden-field checks, submission limits and repeated resource-email protection. Rejected submissions are not saved as leads.', 'wconvert')}</p>
      <fieldset disabled={busy} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <label className="grid gap-2 font-medium" htmlFor="protection-provider">{__('Additional bot protection', 'wconvert')}
          <select id="protection-provider" className="rounded-md border border-input bg-background p-2 text-body" value={draft.provider} onChange={e => edit({ provider: e.target.value as Provider, site_key: '', secret: '' })}>
            <option value="none">{__('None — keep built-in checks', 'wconvert')}</option>
            <option value="turnstile">{__('Cloudflare Turnstile (recommended)', 'wconvert')}</option>
            <option value="recaptcha">{__('Google reCAPTCHA v2 checkbox', 'wconvert')}</option>
            <option value="hcaptcha">{__('hCaptcha', 'wconvert')}</option>
          </select>
        </label>
        {draft.provider !== 'none' && <>
          <p className="m-0 text-note">{__('Use your own provider account. Register this website’s hostname. Any provider charges are separate from WConvert.', 'wconvert')} <a href={links[draft.provider]} target="_blank" rel="noreferrer" className="underline">{__('Get provider keys', 'wconvert')}</a></p>
          <p className="m-0 text-note text-muted-foreground">{draft.provider === 'turnstile' ? __('Choose a Managed widget. Visitors may need to check a box.', 'wconvert') : draft.provider === 'recaptcha' ? __('Choose reCAPTCHA v2 “I’m not a robot” checkbox keys. v3 and Cloud API keys are not supported here. Challenges and usage limits are managed by Google.', 'wconvert') : __('Use standard hCaptcha site keys. Some visitors will need to complete a challenge.', 'wconvert')}</p>
          <label className="grid gap-2" htmlFor="protection-site">{__('Site key', 'wconvert')}<Input id="protection-site" autoComplete="off" value={draft.site_key} onChange={e => edit({ site_key: e.target.value.trim() })} /></label>
          <label className="grid gap-2" htmlFor="protection-secret">{__('Secret key', 'wconvert')}<Input id="protection-secret" type="password" autoComplete="new-password" value={draft.secret} onChange={e => edit({ secret: e.target.value.trim() })} placeholder={saved.has_secret && saved.provider === draft.provider ? __('Saved — leave blank to keep', 'wconvert') : ''} /></label>
          <p className="m-0 text-note text-muted-foreground">{__('Enabling a provider makes verification required on every capture form. If verification is unavailable, visitors can retry without losing their entered details. Saving checks key format; test a live form to confirm the keys and hostname work. Cached pages do not bypass this setting.', 'wconvert')}</p>
          <p className="m-0 text-note text-muted-foreground">{__('The provider receives browser and network information during verification. WConvert sends the verification token to that provider, not your form’s contact fields. Review your privacy notice before enabling.', 'wconvert')}</p>
        </>}
        {saved.rules_available && <div className="grid gap-4 border-t border-border pt-4"><h3 className="m-0 font-medium">{__('Advanced email filters', 'wconvert')}</h3>
          <p className="m-0 text-note text-muted-foreground">{__('These Pro filters apply to every campaign on this site. Empty lists impose no email restrictions. Phone-only submissions are unaffected.', 'wconvert')}</p>
          {saved.rule_fields.map(f => <label key={f.id} className="grid gap-2" htmlFor={`protection-${f.id}`}>{f.label}<textarea id={`protection-${f.id}`} className="rounded-md border border-input bg-background p-2 text-body" rows={3} value={(draft.rules as Record<string, string> | undefined)?.[f.id] ?? ''} onChange={e => edit({ rules: { ...draft.rules, [f.id]: e.target.value } })} /><span className="text-note text-muted-foreground">{f.help}</span></label>)}
        </div>}
        {!saved.rules_available && saved.rules_configured && <div role="alert"><p>{__('Saved Pro filters cannot run. Capture is paused until Pro is restored or you remove those filters.', 'wconvert')}</p><Button variant="outline" onClick={() => edit({ rules: [] })}>{__('Remove unavailable filters', 'wconvert')}</Button></div>}
      </fieldset>
    </RegionBody>
    <RegionFooter className="flex flex-wrap items-center gap-3"><Button disabled={!dirty || busy} onClick={() => void save()}>{busy ? __('Saving…', 'wconvert') : __('Save protection', 'wconvert')}</Button><Button variant="outline" disabled={!dirty || busy} onClick={() => { setDraft(draftOf(saved)); setError(null); setNotice(false); }}>{__('Cancel changes', 'wconvert')}</Button>{saved.provider !== 'none' && <Button variant="outline" disabled={dirty || busy} onClick={() => void test()}>{__('Test saved setup', 'wconvert')}</Button>}{testNotice && <span role="status">{__('Verification passed. No lead was created and nothing was sent.', 'wconvert')}</span>}{notice && <span role="status">{__('Protection settings saved.', 'wconvert')}</span>}</RegionFooter>
  </Region><Region><RegionHeader title={__('Protection activity', 'wconvert')} description={sprintf(__('Approximate totals since %s. These expire after 24 hours and are not counts of people or confirmed spam.', 'wconvert'), new Date(saved.diagnostics.since * 1000).toLocaleString())} /><RegionBody>
    {Object.keys(saved.diagnostics.counts).length === 0 ? <p className="m-0">{__('No protection activity recorded in this window.', 'wconvert')}</p> : <dl className="m-0 grid gap-3">{Object.entries(saved.diagnostics.counts).map(([key, count]) => <div key={key} className="flex justify-between gap-4"><dt>{reasons[key] ?? key}</dt><dd className="m-0 tabular-nums">{count}</dd></div>)}</dl>}
    <p className="mb-0 mt-4 text-note text-muted-foreground">{__('Only totals and reasons are retained here. No submitted details, IP addresses or verification tokens are logged.', 'wconvert')}</p>
  </RegionBody></Region></div>;
}

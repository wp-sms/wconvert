import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { AlertTriangle, CalendarClock, CircleAlert, CircleCheck, Clock, Copy, Check, Download, Globe, Info, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/shell/Disclosure';
import { formatShortDay, formatWhen } from '@/lib/format';
import { describeLicense, type Door, type Icon, type LicensePayload } from './describeLicense';
import { Ext, KeyField } from './parts';

const ICONS: Record<Icon, typeof CircleCheck> = {
  checkCircle: CircleCheck,
  key: KeyRound,
  globe: Globe,
  alert: CircleAlert,
  warn: AlertTriangle,
  clock: Clock,
  calendar: CalendarClock,
};

export interface StatusActions {
  busy: string | null;
  checking: boolean;
  /** WordPress's own update check failed: the foot says so and offers Try again. */
  updatesFailed: boolean;
  onCheck: () => void;
  onSites: () => void;
  onMove: (keepOld?: boolean) => void;
  onRekey: (key: string) => void;
  onReactivate: () => void;
  rekeyError?: ReactNode;
}

/**
 * The status card: one headline, one action, and Updates · Support · Renewal,
 * with the updates line and Check now at its foot (ADR 0143, decision 8).
 */
export function StatusCard({ license, actions }: { license: LicensePayload; actions: StatusActions }) {
  const d = describeLicense(license);
  const Icon = ICONS[d.icon];
  const [rekey, setRekey] = useState('');

  return (
    <section className="wconvert-license-hero" data-tone={d.tone} aria-labelledby="wconvert-license-headline">
      <div className="wconvert-license-hero__top">
        <span className="wconvert-license-well" data-tone={d.tone}><Icon size={22} aria-hidden="true" /></span>
        <div className="wconvert-license-hero__copy">
          <div className="wconvert-license-hero__chip"><Badge variant="outline">{d.chip}</Badge></div>
          <h2 id="wconvert-license-headline" tabIndex={-1}>{d.headline}</h2>
          <p className="wconvert-license-hero__body">{d.body}</p>
          {d.door === 'rekey' && (
            <div className="wconvert-license-hero__field">
              <KeyField id="wconvert-license-rekey" label={__('License key', 'wconvert-pro')} value={rekey} onChange={setRekey}
                onSubmit={() => actions.onRekey(rekey)} busy={actions.busy === 'rekey'} submitLabel={__('Save key', 'wconvert-pro')}
                error={actions.rekeyError}
                hint={<>{__('It’s in your purchase email', 'wconvert-pro')} · <Ext href={license.urls.account ?? '#'}>{__('Find my key', 'wconvert-pro')}</Ext></>} />
            </div>
          )}
          <Doors door={d.door} license={license} actions={actions} />
          {d.coupon && <Coupon code={d.coupon.code} percent={d.coupon.percent} until={d.coupon.until} />}
        </div>
      </div>
      <dl className="wconvert-license-strip">
        {d.facts.map((fact) => (
          <div key={fact.label} data-tone={fact.tone}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}{fact.sub && <small>{fact.sub}</small>}</dd>
          </div>
        ))}
      </dl>
      {/* Announced, so Check now's answer is heard as well as seen. */}
      <div className="wconvert-license-hero__foot" aria-live="polite">
        <div className="wconvert-license-hero__updates">{actions.updatesFailed
          ? <span className="wconvert-license-line"><CircleAlert className="wconvert-license-bad" aria-hidden="true" />{__('Couldn’t check for updates.', 'wconvert-pro')}<Button variant="link" size="sm" onClick={actions.onCheck}>{__('Try again', 'wconvert-pro')}</Button></span>
          : <UpdatesLine license={license} stopped={d.stopped} elsewhere={d.elsewhere} />}</div>
        <div><CheckLine license={license} checking={actions.checking} onCheck={actions.onCheck} /></div>
      </div>
    </section>
  );
}

function Doors({ door, license, actions }: { door: Door | null; license: LicensePayload; actions: StatusActions }) {
  const urls = license.urls;
  let doors: ReactNode = null;

  switch (door) {
    case 'account': doors = <Ext href={urls.account ?? '#'}>{__('Manage account', 'wconvert-pro')}</Ext>; break;
    case 'renew_soon': doors = <><Ext href={urls.renew ?? '#'} variant="outline">{__('Renew', 'wconvert-pro')}</Ext><Ext href={urls.account ?? '#'}>{__('Manage account', 'wconvert-pro')}</Ext></>; break;
    case 'renewal_on': doors = <Ext href={urls.account ?? '#'} variant="outline">{__('Turn renewal back on', 'wconvert-pro')}</Ext>; break;
    case 'buy': doors = <Ext href={urls.checkout ?? '#'} variant="brand">{__('Buy WConvert Pro', 'wconvert-pro')}</Ext>; break;
    case 'renew': doors = <Ext href={urls.renew ?? '#'} variant="brand">{__('Renew', 'wconvert-pro')}</Ext>; break;
    case 'payment': doors = <Ext href={urls.payment ?? '#'} variant="brand">{__('Update payment', 'wconvert-pro')}</Ext>; break;
    case 'support': doors = <Ext href={urls.support ?? '#'} variant="outline">{__('Contact support', 'wconvert-pro')}</Ext>; break;
    case 'sites': doors = <><Button variant="outline" onClick={actions.onSites}>{__('Manage sites', 'wconvert-pro')}</Button><Ext href={urls.upgrade ?? '#'}>{__('Upgrade', 'wconvert-pro')}</Ext></>; break;
    case 'activate_copy': doors = <Button aria-disabled={actions.busy !== null || undefined} onClick={() => actions.busy === null && actions.onMove()}>{actions.busy === 'move' ? __('Activating…', 'wconvert-pro') : __('Activate on this copy', 'wconvert-pro')}</Button>; break;
    case 'move': doors = <>
      <Button aria-disabled={actions.busy !== null || undefined} onClick={() => actions.busy === null && actions.onMove(false)}>{__('Move license here', 'wconvert-pro')}</Button>
      {!license.domain_change?.was_dev && <Button variant="outline" aria-disabled={actions.busy !== null || undefined} onClick={() => actions.busy === null && actions.onMove(true)}>{__('Keep it on both', 'wconvert-pro')}</Button>}
    </>; break;
    case 'activate_here': doors = <Button aria-disabled={actions.busy !== null || undefined} onClick={() => actions.busy === null && actions.onReactivate()}>{actions.busy === 'reactivate' ? __('Activating…', 'wconvert-pro') : __('Activate on this site', 'wconvert-pro')}</Button>; break;
    case 'contact': doors = license.managed?.email ? <Contact email={license.managed.email} /> : null; break;
    default: doors = null;
  }

  return doors === null ? null : <div className="wconvert-license-actions">{doors}</div>;
}

function Coupon({ code, percent, until }: { code: string; percent: number | null; until: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = () => void navigator.clipboard?.writeText(code).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }, () => undefined);

  return (
    <div className="wconvert-license-coupon">
      <span>{percent !== null ? sprintf(__('%d%% off your renewal with', 'wconvert-pro'), percent) : __('Your renewal coupon', 'wconvert-pro')}</span>
      <code>{code}</code>
      <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? __('Copied', 'wconvert-pro') : __('Copy', 'wconvert-pro')}</Button>
      {until && <span className="wconvert-license-muted">{sprintf(__('until %s', 'wconvert-pro'), formatShortDay(until))}</span>}
    </div>
  );
}

function Contact({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => void navigator.clipboard?.writeText(email).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }, () => undefined);

  return (
    <span className="wconvert-license-contact">
      <a href={`mailto:${email}`}>{email}</a>
      <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? __('Copied', 'wconvert-pro') : __('Copy', 'wconvert-pro')}</Button>
    </span>
  );
}

/** What can be done about versions here. "Update now" is WordPress's own upgrade link. */
function UpdatesLine({ license, stopped, elsewhere }: { license: LicensePayload; stopped: boolean; elsewhere: boolean }) {
  const { installed, latest, file_mods: fileMods, update_url: updateUrl } = license.updates;
  const newer = latest !== installed;

  if (stopped) {
    return <span className="wconvert-license-line wconvert-license-muted">{newer
      ? sprintf(__('Version %1$s is out. This site stays on %2$s until updates are back.', 'wconvert-pro'), latest, installed)
      : sprintf(__('Version %s', 'wconvert-pro'), installed)}</span>;
  }

  if (elsewhere) {
    return <span className="wconvert-license-line"><AlertTriangle className="wconvert-license-warn" aria-hidden="true" />{__('Updates are off here until the license is on this site.', 'wconvert-pro')}</span>;
  }

  if (!fileMods) {
    return (
      <div className="wconvert-license-stack">
        <span className="wconvert-license-line"><AlertTriangle className="wconvert-license-warn" aria-hidden="true" />{newer
          ? sprintf(__('Version %s is out, and this host turned off updates from WordPress.', 'wconvert-pro'), latest)
          : __('This host turned off updates from WordPress.', 'wconvert-pro')}</span>
        {newer && (
          <Disclosure variant="inline" title={__('Update by hand', 'wconvert-pro')}>
            <ol className="wconvert-license-steps">
              {license.managed
                ? <li>{sprintf(__('Ask %1$s for WConvert Pro %2$s.', 'wconvert-pro'), license.managed.by ?? __('your site developer', 'wconvert-pro'), latest)}</li>
                : <li><Ext href={license.urls.downloads ?? '#'}>{sprintf(__('Download WConvert Pro %s from your account', 'wconvert-pro'), latest)}</Ext></li>}
              <li>{__('In Plugins → Add New Plugin → Upload Plugin, choose the ZIP.', 'wconvert-pro')}</li>
              <li>{__('Choose Replace current with uploaded.', 'wconvert-pro')}</li>
            </ol>
          </Disclosure>
        )}
      </div>
    );
  }

  if (newer && updateUrl) {
    return (
      <span className="wconvert-license-line">
        <Download className="wconvert-license-act" aria-hidden="true" />
        <b>{sprintf(__('Version %s is available.', 'wconvert-pro'), latest)}</b>
        <Button asChild size="sm"><a href={updateUrl}>{__('Update now', 'wconvert-pro')}</a></Button>
      </span>
    );
  }

  return <span className="wconvert-license-line"><CircleCheck className="wconvert-license-ok" aria-hidden="true" />{sprintf(__('Up to date · version %s', 'wconvert-pro'), installed)}</span>;
}

function CheckLine({ license, checking, onCheck }: { license: LicensePayload; checking: boolean; onCheck: () => void }) {
  // "detail" — "Oct 12, 2026, 9:14 AM" — reads the same mid-sentence in any language.
  const when = (at: number | null) => (at === null ? null : formatWhen(new Date(at * 1000).toISOString(), 'detail'));
  const button = (
    <Button variant="link" size="sm" aria-disabled={checking || undefined} onClick={() => !checking && onCheck()}>
      {checking ? __('Checking…', 'wconvert-pro') : license.reach === 'unreachable' ? __('Try again', 'wconvert-pro') : __('Check now', 'wconvert-pro')}
    </Button>
  );

  if (license.reach === 'unreachable') {
    return <span className="wconvert-license-line"><Info className="wconvert-license-act" aria-hidden="true" />{sprintf(__('Couldn’t reach the license server. Showing details from %s.', 'wconvert-pro'), when(license.last_success_at) ?? '—')}{button}</span>;
  }

  const checked = when(license.last_checked_at);

  return (
    <span className="wconvert-license-line wconvert-license-muted">
      {checked !== null && sprintf(__('Checked %s', 'wconvert-pro'), checked)}
      {button}
    </span>
  );
}

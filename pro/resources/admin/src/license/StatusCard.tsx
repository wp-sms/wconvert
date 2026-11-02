import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { AlertTriangle, CalendarClock, CircleAlert, CircleCheck, Clock, Copy, Check, Download, Globe, Info, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/shell/Disclosure';
import { GuideLink } from '@/shell/GuideLink';
import { Region, RegionBody, RegionFooter, RegionHeader, TryAgain } from '@/shell/Region';
import { formatShortDay, formatWhen } from '@/lib/format';
import { describeLicense, type Door, type Icon, type LicensePayload } from './describeLicense';
import { Ext, KeyField, KeyHint } from './parts';
import { GUIDES, docsUrl } from '@/shell/docs';

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
 * The status card: what the licence's state is, one action, and Updates ·
 * Support · Renewal, with the updates line and Check now at its foot (ADR 0143,
 * decision 8). A region like any other, so its state is in the header's icon
 * and words rather than in a heading of its own size.
 */
export function StatusCard({ license, actions }: { license: LicensePayload; actions: StatusActions }) {
  const d = describeLicense(license);
  const Icon = ICONS[d.icon];
  const [rekey, setRekey] = useState('');
  const doors = doorsOf(d.door, license, actions);

  return (
    <Region className={`wconvert-license-tone-${d.tone}`}>
      <RegionHeader title={d.headline} description={d.body} icon={<Icon />} trailing={<Badge variant="secondary">{d.chip}</Badge>} />
      {(d.door === 'rekey' || doors.length > 0 || d.coupon) && (
        <RegionBody className="wconvert-license-card__body">
          {d.door === 'rekey' && (
            <div className="wconvert-license-field">
              <KeyField id="wconvert-license-rekey" label={__('License key', 'wconvert-pro')} value={rekey} onChange={setRekey}
                onSubmit={() => actions.onRekey(rekey)} busy={actions.busy === 'rekey'} submitLabel={__('Save key', 'wconvert-pro')}
                error={actions.rekeyError}
                hint={<KeyHint account={license.urls.account} />} />
            </div>
          )}
          {doors.length > 0 && <div className="wconvert-license-actions">{doors}</div>}
          {d.coupon && <Coupon code={d.coupon.code} percent={d.coupon.percent} until={d.coupon.until} />}
        </RegionBody>
      )}
      <dl className="wconvert-license-strip">
        {d.facts.map((fact) => (
          <div key={fact.label} data-tone={fact.tone}>
            {/* The same register as `shell/Stat`, which has no line under its value. */}
            <dt className="text-micro uppercase text-muted-foreground">{fact.label}</dt>
            <dd>{fact.value}{fact.sub && <small>{fact.sub}</small>}</dd>
          </div>
        ))}
      </dl>
      <RegionFooter>
        {/* Announced, so Check now's answer is heard as well as seen. */}
        <div className="wconvert-license-foot" aria-live="polite">
          <div className="wconvert-license-updates">{actions.updatesFailed
            ? <span className="wconvert-license-line"><CircleAlert className="wconvert-license-bad" aria-hidden="true" />{__('Couldn’t check for updates.', 'wconvert-pro')}<TryAgain onClick={actions.onCheck} busy={actions.checking} /></span>
            : <UpdatesLine license={license} stopped={d.stopped} elsewhere={d.elsewhere} />}</div>
          <div><CheckLine license={license} checking={actions.checking} onCheck={actions.onCheck} /></div>
        </div>
      </RegionFooter>
    </Region>
  );
}

/** The action the state offers, as far as its doors have somewhere to go. */
function doorsOf(door: Door | null, license: LicensePayload, actions: StatusActions): ReactNode[] {
  const urls = license.urls;
  const out = (href: string | undefined, label: string, variant?: 'brand' | 'outline') => (href ? <Ext key={label} href={href} variant={variant}>{label}</Ext> : null);
  const drawn = (...doors: ReactNode[]) => doors.filter((each) => each !== null && each !== false);

  switch (door) {
    case 'account': return drawn(out(urls.account, __('Manage account', 'wconvert-pro')));
    case 'renew_soon': return drawn(out(urls.renew, __('Renew', 'wconvert-pro'), 'outline'), out(urls.account, __('Manage account', 'wconvert-pro')));
    case 'renewal_on': return drawn(out(urls.account, __('Turn renewal back on', 'wconvert-pro'), 'outline'));
    case 'buy': return drawn(out(urls.checkout, __('Buy WConvert Pro', 'wconvert-pro'), 'brand'));
    case 'renew': return drawn(out(urls.renew, __('Renew', 'wconvert-pro'), 'brand'));
    case 'payment': return drawn(out(urls.payment, __('Update payment', 'wconvert-pro'), 'brand'));
    case 'support': return drawn(out(urls.support, __('Contact support', 'wconvert-pro'), 'outline'));
    case 'sites': return drawn(<Button key="sites" variant="outline" onClick={actions.onSites}>{__('Manage sites', 'wconvert-pro')}</Button>, out(urls.upgrade, __('Upgrade', 'wconvert-pro')));
    case 'activate_copy': return [<Button key="copy" disabled={actions.busy !== null} onClick={() => actions.onMove()}>{actions.busy === 'move' ? __('Activating…', 'wconvert-pro') : __('Activate on this copy', 'wconvert-pro')}</Button>];
    case 'move': return drawn(
      <Button key="move" disabled={actions.busy !== null} onClick={() => actions.onMove(false)}>{__('Move license here', 'wconvert-pro')}</Button>,
      !license.domain_change?.was_dev && <Button key="both" variant="outline" disabled={actions.busy !== null} onClick={() => actions.onMove(true)}>{__('Keep it on both', 'wconvert-pro')}</Button>,
    );
    case 'activate_here': return [<Button key="here" disabled={actions.busy !== null} onClick={() => actions.onReactivate()}>{actions.busy === 'reactivate' ? __('Activating…', 'wconvert-pro') : __('Activate on this site', 'wconvert-pro')}</Button>];
    case 'contact': return license.managed?.email ? [<Contact key="contact" email={license.managed.email} />] : [];
    default: return [];
  }
}

function Coupon({ code, percent, until }: { code: string; percent: number | null; until: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = () => void navigator.clipboard?.writeText(code).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }, () => undefined);

  return (
    <div className="wconvert-license-coupon wconvert-toolbar">
      <span>{percent !== null ? sprintf(/* translators: %d: a discount percentage, e.g. “20”. A coupon code follows the sentence. */ __('%d%% off your renewal with', 'wconvert-pro'), percent) : __('Your renewal coupon', 'wconvert-pro')}</span>
      <code>{code}</code>
      <Button variant="outline" onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? __('Copied', 'wconvert-pro') : __('Copy', 'wconvert-pro')}</Button>
      {until && <span className="wconvert-license-muted">{sprintf(/* translators: %s: the day the coupon ends, e.g. “Oct 12”. */ __('until %s', 'wconvert-pro'), formatShortDay(until))}</span>}
    </div>
  );
}

function Contact({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => void navigator.clipboard?.writeText(email).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }, () => undefined);

  return (
    <span className="wconvert-license-contact wconvert-toolbar">
      <a href={`mailto:${email}`}>{email}</a>
      <Button variant="outline" onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? __('Copied', 'wconvert-pro') : __('Copy', 'wconvert-pro')}</Button>
    </span>
  );
}

/** What can be done about versions here. "Update now" is WordPress's own upgrade link. */
function UpdatesLine({ license, stopped, elsewhere }: { license: LicensePayload; stopped: boolean; elsewhere: boolean }) {
  const { installed, latest, file_mods: fileMods, update_url: updateUrl } = license.updates;
  const newer = latest !== installed;

  if (stopped) {
    return <span className="wconvert-license-line wconvert-license-muted">{newer
      ? sprintf(/* translators: 1: the newest WConvert Pro version, e.g. “2.4.0”, 2: the version this site has. */ __('Version %1$s is out. This site stays on %2$s until updates are back.', 'wconvert-pro'), latest, installed)
      : sprintf(/* translators: %s: the WConvert Pro version this site has, e.g. “2.3.1”. */ __('Version %s', 'wconvert-pro'), installed)}</span>;
  }

  if (elsewhere) {
    return <span className="wconvert-license-line"><AlertTriangle className="wconvert-license-warn" aria-hidden="true" />{__('Updates are off here until the license is on this site.', 'wconvert-pro')}</span>;
  }

  if (!fileMods) {
    return (
      <div className="wconvert-license-stack">
        <span className="wconvert-license-line"><AlertTriangle className="wconvert-license-warn" aria-hidden="true" />{newer
          ? sprintf(/* translators: %s: the newest WConvert Pro version, e.g. “2.4.0”. */ __('Version %s is out, and this host turned off updates from WordPress.', 'wconvert-pro'), latest)
          : __('This host turned off updates from WordPress.', 'wconvert-pro')}</span>
        {newer && (
          <Disclosure variant="inline" title={__('Update by hand', 'wconvert-pro')}>
            <ol className="wconvert-license-steps">
              {license.managed
                ? <li>{sprintf(/* translators: 1: who manages the license, an agency's name or “your site developer”, 2: the newest WConvert Pro version, e.g. “2.4.0”. */ __('Ask %1$s for WConvert Pro %2$s.', 'wconvert-pro'), license.managed.by ?? __('your site developer', 'wconvert-pro'), latest)}</li>
                : <li><Ext href={license.urls.downloads}>{sprintf(/* translators: %s: the newest WConvert Pro version, e.g. “2.4.0”. */ __('Download WConvert Pro %s from your account', 'wconvert-pro'), latest)}</Ext></li>}
              <li>{__('In Plugins → Add New Plugin → Upload Plugin, choose the ZIP.', 'wconvert-pro')}</li>
              <li>{__('Choose Replace current with uploaded.', 'wconvert-pro')}</li>
            </ol>
            <GuideLink href={docsUrl(GUIDES.update, 'update-the-files')}>{__('Full steps, with a backup first', 'wconvert-pro')}</GuideLink>
          </Disclosure>
        )}
      </div>
    );
  }

  if (newer && updateUrl) {
    return (
      <span className="wconvert-license-line">
        <Download className="wconvert-license-act" aria-hidden="true" />
        <b>{sprintf(/* translators: %s: the newest WConvert Pro version, e.g. “2.4.0”. */ __('Version %s is available.', 'wconvert-pro'), latest)}</b>
        <Button asChild><a href={updateUrl}>{__('Update now', 'wconvert-pro')}</a></Button>
      </span>
    );
  }

  return <span className="wconvert-license-line"><CircleCheck className="wconvert-license-ok" aria-hidden="true" />{sprintf(/* translators: %s: the WConvert Pro version this site has, e.g. “2.4.0”. */ __('Up to date · version %s', 'wconvert-pro'), installed)}</span>;
}

function CheckLine({ license, checking, onCheck }: { license: LicensePayload; checking: boolean; onCheck: () => void }) {
  // "detail" — "Oct 12, 2026, 9:14 AM" — reads the same mid-sentence in any language.
  const when = (at: number | null) => (at === null ? null : formatWhen(new Date(at * 1000).toISOString(), 'detail'));
  const button = (
    <Button variant="link" disabled={checking} onClick={() => onCheck()}>
      {checking ? __('Checking…', 'wconvert-pro') : __('Check now', 'wconvert-pro')}
    </Button>
  );

  if (license.reach === 'unreachable') {
    return <span className="wconvert-license-line"><Info className="wconvert-license-act" aria-hidden="true" />{sprintf(/* translators: %s: when the license was last checked successfully, e.g. “Oct 12, 2026, 9:14 AM”, or “—” if never. */ __('Couldn’t reach the license server. Showing details from %s.', 'wconvert-pro'), when(license.last_success_at) ?? '—')}<TryAgain onClick={onCheck} busy={checking} /></span>;
  }

  const checked = when(license.last_checked_at);

  return (
    <span className="wconvert-license-line wconvert-license-muted">
      {checked !== null && sprintf(/* translators: %s: when the license was last checked, e.g. “Oct 12, 2026, 9:14 AM”. */ __('Checked %s', 'wconvert-pro'), checked)}
      {button}
    </span>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { KeyRound, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/shell/Disclosure';
import { formatWhen } from '@/lib/format';
import { asLicenseError, chooseLicense, readAccount, signIn, signOut, type Account, type Changed, type LicenseError } from './api';
import { short, type LicensePayload } from './describeLicense';
import { errorCopy, type Way } from './errorCopy';
import { Ext, KeyField, Notice } from './parts';

/**
 * Nothing activated yet: sign in to the account first, a key second.
 *
 * Signing in leaves for the store and comes back here with the account read
 * server-side; one licence activates on the way back, several open the
 * chooser, and a licence with no site left is refused before the click, with
 * its reason. Freeing a site from here waits on the SDK (#31), so a full
 * licence points to the account's own site list.
 */
export function ActivateCard({ license, onActivateKey, onChanged, busy, keyError }: {
  license: LicensePayload;
  onActivateKey: (key: string) => void;
  onChanged: (license: Changed) => void;
  busy: string | null;
  keyError: LicenseError | null;
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState<LicenseError | null>(null);
  const [opening, setOpening] = useState(false);
  const [choosing, setChoosing] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [keyOpen, setKeyOpen] = useState(keyError !== null);
  const [key, setKey] = useState('');
  const keyRef = useRef<HTMLInputElement>(null);

  // Coming back from the store, or a sign-in already under way.
  useEffect(() => {
    let active = true;
    readAccount().then((answer) => { if (active) setAccount(answer); }, (cause) => { if (active) setAccountError(asLicenseError(cause)); });
    return () => { active = false; };
  }, []);

  const startSignIn = () => {
    setOpening(true);
    setAccountError(null);
    signIn().then(({ url }) => { window.location.assign(url); }, (cause) => { setOpening(false); setAccountError(asLicenseError(cause)); });
  };

  const leave = () => {
    signOut().then(() => setAccount({ signed_in: false, email_masked: null, licenses: [], error_code: null, message: null }), (cause) => setAccountError(asLicenseError(cause)));
  };

  const choose = (id: number) => {
    setChoosing(id);
    setAccountError(null);
    chooseLicense(id).then(onChanged, (cause) => { setChoosing(null); setAccountError(asLicenseError(cause)); });
  };

  const ways = (error: LicenseError, retry: () => void) => (
    <Ways ways={errorCopy(error).ways} license={license} retry={retry} signIn={startSignIn} />
  );

  // A key from wp-config.php that did not activate: its source, why, and when the SDK tries again (P3).
  if (license.managed) {
    const error = license.error_code ? { code: license.error_code } : null;
    return (
      <section className="wconvert-license-act-card" aria-labelledby="wconvert-license-activate">
        <div className="wconvert-license-act-card__main">
          <span className="wconvert-license-well" data-tone="info"><KeyRound size={22} aria-hidden="true" /></span>
          <div>
            <h2 id="wconvert-license-activate">{__('Activate WConvert Pro', 'wconvert-pro')}</h2>
            <p className="wconvert-license-hero__body">{__('Your license key is set in wp-config.php.', 'wconvert-pro')}</p>
            {error && (
              <Notice tone="danger" title={__('It didn’t activate', 'wconvert-pro')}>
                <p>{errorCopy(error).text}</p>
                {license.retry_at && <p>{sprintf(__('WordPress tries again %s.', 'wconvert-pro'), formatWhen(new Date(license.retry_at * 1000).toISOString()))}</p>}
              </Notice>
            )}
          </div>
        </div>
      </section>
    );
  }

  const choices = account?.signed_in ? account.licenses : [];

  if (account?.signed_in && choices.length === 0) {
    return (
      <section className="wconvert-license-card" aria-labelledby="wconvert-license-activate">
        <div className="wconvert-license-card__head"><h2 id="wconvert-license-activate">{__('Activate WConvert Pro', 'wconvert-pro')}</h2></div>
        <div className="wconvert-license-card__body">
          <Notice tone="warning" title={sprintf(__('This account (%s) has no WConvert Pro license', 'wconvert-pro'), account.email_masked ?? '')}
            actions={<>
              <Button variant="outline" size="sm" onClick={leave}>{__('Sign out and use another account', 'wconvert-pro')}</Button>
              <Ext href={license.urls.checkout ?? '#'}>{__('See plans', 'wconvert-pro')}</Ext>
              <Button variant="link" size="sm" onClick={() => { leave(); setKeyOpen(true); window.setTimeout(() => keyRef.current?.focus(), 30); }}>{__('Use a key instead', 'wconvert-pro')}</Button>
            </>} />
        </div>
      </section>
    );
  }

  if (account?.signed_in) {
    const selected = chosen ?? choices.find((choice) => !choice.full)?.id ?? null;
    const picked = choices.find((choice) => choice.id === selected);

    return (
      <section className="wconvert-license-card" aria-labelledby="wconvert-license-choose">
        <div className="wconvert-license-card__head"><h2 id="wconvert-license-choose">{__('Choose a license for this site', 'wconvert-pro')}</h2></div>
        <div className="wconvert-license-card__body">
          {accountError && <Notice tone="danger" focus>{errorCopy(accountError).text}{ways(accountError, () => selected !== null && choose(selected))}</Notice>}
          {account.message && <Notice tone="warning">{account.message}</Notice>}
          <fieldset className="wconvert-license-choices">
            <legend className="sr-only">{__('Your licenses', 'wconvert-pro')}</legend>
            {choices.map((choice) => (
              <label key={choice.id} className="wconvert-radio-card" data-refused={choice.full ? '' : undefined}>
                <input type="radio" name="wconvert-license-choice" checked={selected === choice.id}
                  aria-disabled={choice.full || undefined} aria-describedby={choice.full ? `wconvert-license-full-${choice.id}` : undefined}
                  onChange={() => !choice.full && setChosen(choice.id)} />
                <span>
                  <b>{sprintf(__('Pro · %s', 'wconvert-pro'), planName(choice.max))}</b>
                  <span>{[
                    choice.key_masked,
                    choice.ends_at ? sprintf(__('Ends %s', 'wconvert-pro'), short(choice.ends_at)) : null,
                    choice.max === null ? sprintf(_n('%d site', '%d sites', choice.used, 'wconvert-pro'), choice.used) : sprintf(__('%1$d of %2$d used', 'wconvert-pro'), choice.used, choice.max),
                  ].filter(Boolean).join(' · ')}</span>
                  {choice.full && <span className="wconvert-license-why" id={`wconvert-license-full-${choice.id}`}>{__('No free site', 'wconvert-pro')}</span>}
                </span>
              </label>
            ))}
          </fieldset>
          {picked === undefined && <p className="wconvert-license-hint">
            {__('Every license on this account is in use. Free a site in your account, then come back.', 'wconvert-pro')} <Ext href={license.urls.sites ?? '#'}>{__('Manage sites', 'wconvert-pro')}</Ext>
          </p>}
          <div className="wconvert-license-actions">
            <Button aria-disabled={picked === undefined || choosing !== null || undefined} onClick={() => picked && choosing === null && choose(picked.id)}>
              {choosing !== null ? __('Activating…', 'wconvert-pro') : __('Activate on this site', 'wconvert-pro')}
            </Button>
          </div>
        </div>
        <div className="wconvert-license-card__foot">
          {sprintf(__('Signed in as %s', 'wconvert-pro'), account.email_masked ?? '')} · <Button variant="link" size="sm" onClick={leave}>{__('Sign out', 'wconvert-pro')}</Button>
        </div>
      </section>
    );
  }

  const signError = accountError ?? (account?.error_code ? { code: account.error_code } : null);
  const keyCopy = keyError ? errorCopy(keyError) : null;

  return (
    <section className="wconvert-license-act-card" aria-labelledby="wconvert-license-activate">
      <div className="wconvert-license-act-card__main">
        <span className="wconvert-license-well" data-tone="info"><KeyRound size={22} aria-hidden="true" /></span>
        <div>
          <h2 id="wconvert-license-activate">{__('Activate WConvert Pro', 'wconvert-pro')}</h2>
          <p className="wconvert-license-hero__body">{__('Activate to get updates and support. Pro features already work.', 'wconvert-pro')}</p>
          <div className="wconvert-license-actions">
            <Button variant="brand" aria-disabled={opening || undefined} aria-describedby={signError ? 'wconvert-license-sign-error' : 'wconvert-license-sign-hint'} onClick={() => !opening && startSignIn()}>
              {opening ? __('Opening your account…', 'wconvert-pro') : signError?.code === 'account_expired' ? __('Sign in again', 'wconvert-pro') : __('Sign in to your account', 'wconvert-pro')}
            </Button>
          </div>
          {signError
            ? <div className="wconvert-license-error" id="wconvert-license-sign-error" role="alert"><span>{errorCopy(signError).text}</span>{ways(signError, startSignIn)}</div>
            : <p className="wconvert-license-hint" id="wconvert-license-sign-hint">{account?.message ?? __('Opens your account, then brings you back here.', 'wconvert-pro')}</p>}
        </div>
      </div>
      <Disclosure className="wconvert-license-act-card__key" variant="inline" title={__('Enter a license key instead', 'wconvert-pro')} open={keyOpen} onToggle={setKeyOpen}>
        <KeyField id="wconvert-license-key-input" label={__('License key', 'wconvert-pro')} value={key} inputRef={keyRef} onChange={setKey}
          onSubmit={() => onActivateKey(key)} busy={busy === 'activate'} refused={keyError?.code === 'rate_limited'}
          error={keyCopy && <><span role="alert">{keyCopy.text}</span>{ways(keyError!, () => onActivateKey(key))}</>}
          hint={<>{__('It’s in your purchase email', 'wconvert-pro')} · <Ext href={license.urls.account ?? '#'}>{__('Find my key', 'wconvert-pro')}</Ext></>} />
      </Disclosure>
    </section>
  );
}

function planName(max: number | null): string {
  if (max === null) return __('Unlimited', 'wconvert-pro');
  return sprintf(_n('%d site', '%d sites', max, 'wconvert-pro'), max);
}

/** The ways forward from a refusal: links to the store, Try again, Sign in. */
export function Ways({ ways, license, retry, signIn: startSignIn }: { ways: Way[]; license: LicensePayload; retry: () => void; signIn: () => void }) {
  if (ways.length === 0) return null;

  const door: Record<Way, ReactNode> = {
    sign_in: <Button key="sign_in" variant="link" size="sm" onClick={startSignIn}>{__('Sign in instead', 'wconvert-pro')}</Button>,
    find_key: <Ext key="find_key" href={license.urls.account ?? '#'}>{__('Find my WConvert key', 'wconvert-pro')}</Ext>,
    renew: <Ext key="renew" href={license.urls.renew ?? license.urls.account ?? '#'} variant="brand" size="sm">{__('Renew', 'wconvert-pro')}</Ext>,
    sites: <Ext key="sites" href={license.urls.sites ?? '#'}>{__('Manage sites', 'wconvert-pro')}</Ext>,
    upgrade: <Ext key="upgrade" href={license.urls.upgrade ?? '#'}>{__('Upgrade', 'wconvert-pro')}</Ext>,
    retry: <Button key="retry" variant="outline" size="sm" onClick={retry}><RefreshCw aria-hidden="true" />{__('Try again', 'wconvert-pro')}</Button>,
    support: <Ext key="support" href={license.urls.support ?? '#'}>{__('Contact support', 'wconvert-pro')}</Ext>,
  };

  return <div className="wconvert-license-actions">{ways.map((way) => door[way])}</div>;
}

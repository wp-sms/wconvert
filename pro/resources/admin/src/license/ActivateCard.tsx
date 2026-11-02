import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Region, RegionBody, RegionFooter, RegionHeader, TryAgain } from '@/shell/Region';
import { GuideLink } from '@/shell/GuideLink';
import { __, _n, sprintf } from '@wordpress/i18n';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { refusable } from '@/lib/refusable';
import { Disclosure } from '@/shell/Disclosure';
import { formatWhen } from '@/lib/format';
import { asLicenseError, chooseLicense, goSignIn, readAccount, signOut, type Account, type Changed, type LicenseError } from './api';
import { type LicensePayload } from './describeLicense';
import { formatShortDay } from '@/lib/format';
import { errorCopy, type Way } from './errorCopy';
import { Ext, KeyField, KeyHint, ResultAlert } from './parts';
import { GUIDES, docsUrl } from '@/shell/docs';

/**
 * Nothing activated yet: sign in to the account first, a key second.
 *
 * Signing in leaves for the store and comes back here with the account read
 * server-side; one licence activates on the way back, several open the
 * chooser, and a licence with no site left is refused before the click, with
 * its reason. Freeing a site from here waits on the SDK (#31), so a full
 * licence points to the account's own site list.
 */
export function ActivateCard({ license, onActivateKey, onKeyEdit, onChanged, busy, keyError }: {
  license: LicensePayload;
  onActivateKey: (key: string) => void;
  /** The key was edited: a refusal about the last one no longer applies. */
  onKeyEdit: () => void;
  onChanged: (license: Changed) => void;
  busy: string | null;
  keyError: LicenseError | null;
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountErrorState] = useState<{ error: LicenseError; id: number } | null>(null);
  const setAccountError = (error: LicenseError | null) => setAccountErrorState((current) => (error === null ? null : { error, id: (current?.id ?? 0) + 1 }));
  const [focusKey, setFocusKey] = useState(false);
  const [opening, setOpening] = useState(false);
  const [choosing, setChoosing] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [keyOpen, setKeyOpen] = useState(keyError !== null);
  const [key, setKey] = useState('');
  const keyRef = useRef<HTMLInputElement>(null);

  // "Use a key instead": the field is open by the time this runs.
  useEffect(() => {
    if (!focusKey) return;
    keyRef.current?.focus();
    setFocusKey(false);
  }, [focusKey]);

  // Coming back from the store, or a sign-in already under way.
  useEffect(() => {
    let active = true;
    readAccount().then((answer) => { if (active) setAccount(answer); }, (cause) => { if (active) setAccountError(asLicenseError(cause)); });
    return () => { active = false; };
  }, []);

  const startSignIn = () => {
    setOpening(true);
    setAccountError(null);
    goSignIn((error) => { setOpening(false); setAccountError(error); });
  };

  const signedOut: Account = { signed_in: false, email_masked: null, licenses: [], error_code: null, message: null };

  const leave = () => {
    signOut().then(() => setAccount(signedOut), (cause) => setAccountError(asLicenseError(cause)));
  };

  // Out of the account and straight to the key: the field opens now, and the
  // sign-out finishes on its own.
  const useKey = () => {
    setAccount(signedOut);
    setKeyOpen(true);
    setFocusKey(true);
    void signOut().catch(() => undefined);
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
    const copy = error ? errorCopy(error, { fromConfig: true }) : null;
    return (
      <Region>
        <RegionHeader title={__('Activate WConvert Pro', 'wconvert-pro')} description={__('Your license key is set in wp-config.php.', 'wconvert-pro')} icon={<KeyRound />} />
        {error && copy && (
          <RegionBody>
            <ResultAlert tone="danger" title={__('It didn’t activate', 'wconvert-pro')}>
              <p>{copy.text} <span className="wconvert-license-muted">({error.code})</span></p>
              {license.retry_at && <p>{sprintf(/* translators: %s: when it tries next, e.g. “Today, 4:05 PM” or “Oct 3”. */ __('WordPress tries again %s.', 'wconvert-pro'), formatWhen(new Date(license.retry_at * 1000).toISOString()))}</p>}
            </ResultAlert>
          </RegionBody>
        )}
      </Region>
    );
  }

  const choices = account?.signed_in ? account.licenses : [];

  if (account?.signed_in && choices.length === 0) {
    return (
      <Region>
        <RegionHeader title={__('Activate WConvert Pro', 'wconvert-pro')} />
        <RegionBody>
          <ResultAlert tone="warning" title={sprintf(/* translators: %s: the account's email address, partly hidden, e.g. “n***@example.com”. */ __('This account (%s) has no WConvert Pro license', 'wconvert-pro'), account.email_masked ?? '')}>
            <div className="wconvert-license-actions">
              <Button variant="outline" onClick={leave}>{__('Sign out and use another account', 'wconvert-pro')}</Button>
              <Ext href={license.urls.checkout}>{__('See plans', 'wconvert-pro')}</Ext>
              <Button variant="link" onClick={useKey}>{__('Use a key instead', 'wconvert-pro')}</Button>
            </div>
          </ResultAlert>
        </RegionBody>
      </Region>
    );
  }

  if (account?.signed_in) {
    const selected = chosen ?? choices.find((choice) => !choice.full)?.id ?? null;
    const picked = choices.find((choice) => choice.id === selected);

    return (
      <Region>
        <RegionHeader title={__('Choose a license for this site', 'wconvert-pro')} />
        <RegionBody className="wconvert-license-card__body">
          {accountError && <ResultAlert key={accountError.id} tone="danger" title={errorCopy(accountError.error).text} focus>{ways(accountError.error, () => selected !== null && choose(selected))}</ResultAlert>}
          {account.message && <ResultAlert tone="warning" title={account.message} />}
          <fieldset className="wconvert-license-choices">
            <legend className="sr-only">{__('Your licenses', 'wconvert-pro')}</legend>
            {choices.map((choice) => (
              <label key={choice.id} className="wconvert-radio-card" data-refused={choice.full ? '' : undefined}>
                <input type="radio" name="wconvert-license-choice" checked={selected === choice.id}
                  aria-disabled={choice.full || undefined} aria-describedby={choice.full ? `wconvert-license-full-${choice.id}` : undefined}
                  onChange={() => !choice.full && setChosen(choice.id)} />
                <span>
                  <b>{sprintf(/* translators: %s: the license's plan size, e.g. “5 sites” or “Unlimited”. */ __('Pro · %s', 'wconvert-pro'), planName(choice.max))}</b>
                  <span>{[
                    choice.key_masked,
                    choice.ends_at ? sprintf(/* translators: %s: the day the license ends, e.g. “Mar 3, 2027”. */ __('Ends %s', 'wconvert-pro'), formatShortDay(choice.ends_at)) : null,
                    choice.max === null ? sprintf(/* translators: %d: how many sites use this unlimited license. */ _n('%d site', '%d sites', choice.used, 'wconvert-pro'), choice.used) : sprintf(/* translators: 1: how many sites use this license, 2: how many sites the plan allows. */ __('%1$d of %2$d used', 'wconvert-pro'), choice.used, choice.max),
                  ].filter(Boolean).join(' · ')}</span>
                  {choice.full && <span className="wconvert-license-why" id={`wconvert-license-full-${choice.id}`}>{__('No free site', 'wconvert-pro')}</span>}
                </span>
              </label>
            ))}
          </fieldset>
          {picked === undefined && <p id="wconvert-license-none-free" className="wconvert-license-hint">
            {__('Every license on this account is in use. Free a site in your account, then come back.', 'wconvert-pro')} <Ext href={license.urls.sites}>{__('Manage sites', 'wconvert-pro')}</Ext>
          </p>}
          <div className="wconvert-license-actions">
            <Button disabled={choosing !== null} {...refusable(picked === undefined ? 'wconvert-license-none-free' : null, () => picked && choose(picked.id))}>
              {choosing !== null ? __('Activating…', 'wconvert-pro') : __('Activate on this site', 'wconvert-pro')}
            </Button>
          </div>
        </RegionBody>
        <RegionFooter className="flex flex-wrap items-center gap-2 text-note">
          {sprintf(/* translators: %s: the account's email address, partly hidden, e.g. “n***@example.com”. */ __('Signed in as %s', 'wconvert-pro'), account.email_masked ?? '')} · <Button variant="link" onClick={leave}>{__('Sign out', 'wconvert-pro')}</Button>
        </RegionFooter>
      </Region>
    );
  }

  const signError = accountError?.error ?? (account?.error_code ? { code: account.error_code } : null);
  const keyCopy = keyError ? errorCopy(keyError) : null;

  return (
    <Region>
      <RegionHeader title={__('Activate WConvert Pro', 'wconvert-pro')} description={__('Activate to get updates and support. Pro features already work.', 'wconvert-pro')} icon={<KeyRound />} />
      <RegionBody className="wconvert-license-card__body">
        <div className="wconvert-license-actions">
          <Button variant="brand" disabled={opening} aria-describedby={signError ? 'wconvert-license-sign-error' : 'wconvert-license-sign-hint'} onClick={() => startSignIn()}>
            {opening ? __('Opening your account…', 'wconvert-pro') : signError?.code === 'account_expired' ? __('Sign in again', 'wconvert-pro') : __('Sign in to your account', 'wconvert-pro')}
          </Button>
        </div>
        {signError
          ? <div className="wconvert-license-error" id="wconvert-license-sign-error" role="alert"><span>{errorCopy(signError).text}</span>{ways(signError, startSignIn)}</div>
          : <p className="wconvert-license-hint" id="wconvert-license-sign-hint">{account?.message ?? __('Opens your account, then brings you back here.', 'wconvert-pro')}</p>}
        {/* The second door, under a rule. Its field stays on the card's surface (§6). */}
        <div className="border-t border-border pt-2">
          <Disclosure variant="inline" title={__('Enter a license key instead', 'wconvert-pro')} open={keyOpen} onToggle={setKeyOpen}>
            <KeyField id="wconvert-license-key-input" label={__('License key', 'wconvert-pro')} value={key} inputRef={keyRef} onChange={(value) => { setKey(value); onKeyEdit(); }}
              onSubmit={() => onActivateKey(key)} busy={busy === 'activate'} refused={keyError?.code === 'rate_limited'}
              error={keyCopy && <><span role="alert">{keyCopy.text}</span>{ways(keyError!, () => onActivateKey(key))}</>}
              hint={<KeyHint account={license.urls.account} />} />
          </Disclosure>
        </div>
      </RegionBody>
    </Region>
  );
}

function planName(max: number | null): string {
  if (max === null) return __('Unlimited', 'wconvert-pro');
  return sprintf(/* translators: %d: how many sites the plan allows. */ _n('%d site', '%d sites', max, 'wconvert-pro'), max);
}

/** The ways forward from a refusal: links to the store, Try again, Sign in. */
export function Ways({ ways, license, retry, signIn: startSignIn }: { ways: Way[]; license: LicensePayload; retry: () => void; signIn: () => void }) {
  if (ways.length === 0) return null;

  const door: Record<Way, ReactNode> = {
    sign_in: <Button key="sign_in" variant="link" onClick={startSignIn}>{__('Sign in instead', 'wconvert-pro')}</Button>,
    find_key: <Ext key="find_key" href={license.urls.account}>{__('Find my WConvert key', 'wconvert-pro')}</Ext>,
    renew: <Ext key="renew" href={license.urls.renew ?? license.urls.account} variant="outline">{__('Renew', 'wconvert-pro')}</Ext>,
    sites: <Ext key="sites" href={license.urls.sites}>{__('Manage sites', 'wconvert-pro')}</Ext>,
    upgrade: <Ext key="upgrade" href={license.urls.upgrade}>{__('Upgrade', 'wconvert-pro')}</Ext>,
    retry: <TryAgain key="retry" onClick={retry} />,
    support: <Ext key="support" href={license.urls.support}>{__('Contact support', 'wconvert-pro')}</Ext>,
    guide: <GuideLink key="guide" href={docsUrl(GUIDES.proUnavailable, 'check-license')}>{__('Troubleshooting guide', 'wconvert-pro')}</GuideLink>,
  };

  return <div className="wconvert-license-actions">{ways.map((way) => door[way])}</div>;
}

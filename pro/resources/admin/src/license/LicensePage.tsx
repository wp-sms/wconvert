import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Info } from 'lucide-react';
import { ConfirmDialog } from '@/shell/ConfirmDialog';
import { Region, RegionBody, RegionError } from '@/shell/Region';
import { RegionSkeleton } from '@/shell/RegionSkeleton';
import { LOADING, messageOf, ready, type Loadable } from '@/shell/loadable';
import { setPlanBadge } from '@/shell/planBadge';
import {
  activateKey, asLicenseError, checkUpdates, goSignIn, moveLicense, readLicense, removeLicense, removeSite, replaceKey,
  type Changed, type LicenseError,
} from './api';
import { type LicensePayload, type LicenseSite } from './describeLicense';
import { errorCopy } from './errorCopy';
import { markLicenseCurrent } from './menuHighlight';
import { Notice, type NoticeTone } from './parts';
import { ActivateCard, Ways } from './ActivateCard';
import { StatusCard } from './StatusCard';
import { KeyCard, SitesCard } from './SitesCard';
import './license.css';

/** The focus refresh asks at most this often; the server holds the same line. */
const FOCUS_CHECK_MS = 60_000;

type KeyField = 'activate' | 'replace' | 'rekey';

interface Result { tone: NoticeTone; title: string; body?: ReactNode; id: number }

interface Confirmation { title: string; description: ReactNode; confirm: string; destructive?: boolean; run: () => void }

/**
 * WConvert → License (ADR 0143): the status card, then Sites and the License
 * key — or, with nothing activated, the way to activate.
 *
 * Every action answers with the whole licence, so the page and the header
 * badge redraw from that one answer. Results are inline, focused on arrival
 * and announced, never toasts. Coming back to the tab asks the store again,
 * at most once a minute, so a renewal made in another tab shows here at once
 * — and a check that fails keeps what the page already shows.
 */
export function LicensePage() {
  const [license, setLicense] = useState<Loadable<LicensePayload>>(LOADING);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [updatesFailed, setUpdatesFailed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [errors, setErrors] = useState<Partial<Record<KeyField, LicenseError>>>({});
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [sitesResult, setSitesResult] = useState<ReactNode>(null);
  const sitesHeading = useRef<HTMLDivElement>(null);
  const lastCheck = useRef(0);
  const results = useRef(0);
  const lastKey = useRef<Partial<Record<KeyField, string>>>({});

  useEffect(() => markLicenseCurrent(), []);

  const say = useCallback((tone: NoticeTone, title: string, body?: ReactNode) => setResult({ tone, title, body, id: ++results.current }), []);

  const settle = useCallback((next: LicensePayload) => {
    setLicense(ready(next));
    setPlanBadge(next.badge);
  }, []);

  const load = useCallback((check = false) => {
    if (check) lastCheck.current = Date.now();
    return readLicense(check).then(settle, (cause) => {
      // A page already showing the licence keeps showing it — with the key
      // somebody was halfway through typing — and says the check failed.
      setLicense((current) => (current.status === 'ready' ? current : { status: 'failed', message: messageOf(cause) }));
      if (check) say('warning', __('Couldn’t check the license just now.', 'wconvert-pro'), messageOf(cause));
    });
  }, [settle, say]);

  useEffect(() => { void load(); }, [load]);

  // Back to the tab: a renewal or an upgrade made in the store shows here at once.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck.current < FOCUS_CHECK_MS) return;
      void load(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [load]);

  // A rate-limited key field opens again once the wait is over.
  const activateError = errors.activate;
  useEffect(() => {
    if (activateError?.code !== 'rate_limited') return undefined;
    const timer = window.setTimeout(() => setErrors((current) => ({ ...current, activate: undefined })), Math.max(5, activateError.data?.retry_after ?? 60) * 1000);
    return () => window.clearTimeout(timer);
  }, [activateError]);

  const run = async (name: string, action: () => Promise<Changed>, done?: (answer: Changed) => void, field?: KeyField) => {
    setBusy(name);
    setResult(null);
    if (field) setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      const answer = await action();
      settle(answer);
      done?.(answer);
    } catch (cause) {
      const error = asLicenseError(cause);
      if (field) setErrors((current) => ({ ...current, [field]: error }));
      else say('danger', errorCopy(error).text);
    } finally {
      setBusy(null);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    setUpdatesFailed(false);
    try {
      await load(true);
      await checkUpdates().then(
        ({ updates }) => setLicense((current) => (current.status === 'ready' ? ready({ ...current.data, updates }) : current)),
        () => setUpdatesFailed(true),
      );
    } finally {
      setChecking(false);
    }
  };

  const startSignIn = () => goSignIn((error) => say('danger', errorCopy(error).text));

  if (license.status === 'loading') return <RegionSkeleton label={__('Loading license…', 'wconvert-pro')} lines={5} />;

  if (license.status === 'failed') {
    return <Region><RegionBody><RegionError message={license.message} onRetry={() => { setLicense(LOADING); void load(); }} /></RegionBody></Region>;
  }

  const data = license.data;
  const notice = result && <Notice key={result.id} tone={result.tone} title={result.title} focus>{result.body}</Notice>;

  const activate = (key: string) => {
    lastKey.current.activate = key;
    void run('activate', () => activateKey(key), () => say('success', __('WConvert Pro is activated on this site', 'wconvert-pro')), 'activate');
  };

  const replace = (key: string, field: 'replace' | 'rekey') => {
    lastKey.current[field] = key;
    void run(field, () => replaceKey(key), (answer) => say(
      answer.released?.removed_remotely === false ? 'warning' : 'success',
      __('The new key is active', 'wconvert-pro'),
      answer.released?.removed_remotely === false ? __('The old key’s site couldn’t be freed. Free it from your account.', 'wconvert-pro') : undefined,
    ), field);
  };

  const errorFor = (field: 'replace' | 'rekey') => {
    const error = errors[field];
    if (!error) return undefined;
    const copy = errorCopy(error);
    return <><span role="alert">{copy.text}</span><Ways ways={copy.ways} license={data} retry={() => replace(lastKey.current[field] ?? '', field)} signIn={startSignIn} /></>;
  };

  const dialog = confirm && (
    <ConfirmDialog open onOpenChange={(open) => { if (!open) setConfirm(null); }}
      title={confirm.title} description={confirm.description} confirmLabel={confirm.confirm}
      variant={confirm.destructive ? 'destructive' : 'default'} cancelLabel={__('Cancel', 'wconvert-pro')}
      onConfirm={() => { const go = confirm.run; setConfirm(null); go(); }} />
  );

  if (data.state === 'none') {
    return (
      <div className="wconvert-license wconvert-license--narrow">
        {notice}
        <ActivateCard license={data} busy={busy} keyError={errors.activate ?? null}
          onActivateKey={activate}
          onKeyEdit={() => setErrors((current) => (current.activate ? { ...current, activate: undefined } : current))}
          onChanged={(answer) => { settle(answer); say('success', __('WConvert Pro is activated on this site', 'wconvert-pro')); }} />
      </div>
    );
  }

  const here = data.domain_change?.now ?? '';
  const was = data.domain_change?.was ?? '';
  const used = data.plan?.used ?? data.sites.filter((site) => !site.dev).length;
  const max = data.plan?.max ?? null;
  const ofPlan = max === null ? sprintf(__('%d in use', 'wconvert-pro'), used + 1) : sprintf(__('%1$d of %2$d in use', 'wconvert-pro'), used + 1, max);

  const move = (keepOld?: boolean) => {
    // A staging copy (no "keep" either way): the SDK decides, and a copy uses no site.
    if (keepOld === undefined) {
      void run('move', () => moveLicense(), () => say('success', __('Updates are on for this copy', 'wconvert-pro')));
      return;
    }

    setConfirm(keepOld
      ? { title: __('Keep the license on both sites?', 'wconvert-pro'), description: sprintf(__('%1$s uses one more site: %2$s.', 'wconvert-pro'), here, ofPlan), confirm: __('Keep it on both', 'wconvert-pro'),
        run: () => void run('move', () => moveLicense(true), () => say('success', sprintf(__('The license is on %s too', 'wconvert-pro'), here))) }
      : { title: sprintf(__('Move the license to %s?', 'wconvert-pro'), here),
        description: data.domain_change?.was_dev
          ? <>{sprintf(__('%1$s will use one site on your license: %2$s.', 'wconvert-pro'), here, ofPlan)} {sprintf(__('%s stays as a dev site, which is free.', 'wconvert-pro'), was)}</>
          : sprintf(__('Frees %s. It stops getting updates; its Pro features keep working.', 'wconvert-pro'), was),
        confirm: __('Move license here', 'wconvert-pro'),
        run: () => void run('move', () => moveLicense(false), (answer) => say(answer.released?.removed_remotely === false ? 'warning' : 'success',
          sprintf(__('The license is on %s now', 'wconvert-pro'), here),
          answer.released?.removed_remotely === false ? sprintf(__('%s couldn’t be freed right now. Free it from your account.', 'wconvert-pro'), was) : undefined)) });
  };

  const removeOne = (site: LicenseSite) => setConfirm({
    title: sprintf(__('Remove %s?', 'wconvert-pro'), site.domain),
    description: sprintf(__('Frees one site on your license. %s stops getting updates; its Pro features keep working.', 'wconvert-pro'), site.domain),
    confirm: __('Remove', 'wconvert-pro'),
    destructive: true,
    run: () => {
      setSitesResult(null);
      void run(`site:${site.domain}`, () => removeSite(site.domain), () => setSitesResult(
        <Notice key={site.domain} tone="success" focus>{sprintf(__('%s was removed. One more site is free.', 'wconvert-pro'), site.domain)}</Notice>,
      ));
    },
  });

  const removeHere = () => setConfirm({
    title: __('Remove the license from this site?', 'wconvert-pro'),
    description: __('Frees one site on your license. Pro features keep working; updates stop.', 'wconvert-pro'),
    confirm: __('Remove from this site', 'wconvert-pro'),
    destructive: true,
    run: () => void run('remove', removeLicense, (answer) => answer.released?.removed_remotely === false
      ? say('warning', __('Removed from this site', 'wconvert-pro'), __('The license server couldn’t be reached, so the site may still count. Free it from your account.', 'wconvert-pro'))
      : say('success', __('Removed from this site', 'wconvert-pro'), __('One site on your license is free.', 'wconvert-pro'))),
  });

  return (
    <div className="wconvert-license">
      {notice}
      <StatusCard license={data} actions={{
        busy, checking, updatesFailed, onCheck: () => void checkNow(), onMove: move,
        onSites: () => { sitesHeading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); sitesHeading.current?.focus({ preventScroll: true }); },
        onRekey: (key) => replace(key, 'rekey'), rekeyError: errorFor('rekey'),
      }} />
      {data.managed ? (
        <p className="wconvert-license-managed"><Info aria-hidden="true" />{__('To change or remove the license, edit WCONVERT_LICENSE_KEY in wp-config.php.', 'wconvert-pro')}</p>
      ) : (
        <div className="wconvert-license-grid">
          <SitesCard license={data} busy={busy} onRemove={removeOne} result={sitesResult} headingRef={sitesHeading} />
          <KeyCard license={data} busy={busy} onReplace={(key) => replace(key, 'replace')} replaceError={errorFor('replace')} onRemove={removeHere} />
        </div>
      )}
      {dialog}
    </div>
  );
}

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Code, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '@/components/ui/admin-dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/shell/Field';
import { GuideLink } from '@/shell/GuideLink';
import { messageOf } from '@/shell/loadable';
import { regenerateConnection, saveConnection, type HeaderPair } from '@/destinations/api';
import type { ConnectionFormProps } from '@/destinations/connectionSetup';
import { HeadersEditor, headerProblem, headersToSend, storedHeaders } from '@/destinations/HeadersEditor';
import { RevealedSecret } from '@/destinations/RevealedSecret';
import { toolMarks, toolOfHost, type WebhookTool } from './marks';
import './webhook.css';

/** Where a webhook posts to: one of three no-code tools, or the merchant's own code. */
export type Receiver = WebhookTool | 'code';

/** The header Make's Custom webhook checks for its API key. */
export const MAKE_KEY_HEADER = 'x-make-apikey';

const RECEIVERS: readonly Receiver[] = ['zapier', 'make', 'n8n', 'code'];

/** Brand names stay as the companies write them; only "Your own code" is ours to translate. */
const nameOf = (receiver: Receiver): string => ({ zapier: 'Zapier', make: 'Make', n8n: 'n8n', code: __('Your own code', 'wconvert-pro') })[receiver];

const summaryOf = (receiver: Receiver): string => ({
  zapier: __('Paste a Catch Hook URL.', 'wconvert-pro'),
  make: __('Paste a Custom webhook URL, with an optional API key.', 'wconvert-pro'),
  n8n: __('Paste a Webhook node URL, with Header Auth if you use it.', 'wconvert-pro'),
  code: __('Any URL. Check each request with the signing secret.', 'wconvert-pro'),
})[receiver];

const urlHintOf = (receiver: Receiver): string => ({
  zapier: __('Webhooks by Zapier → Catch Hook. Copy the URL it shows.', 'wconvert-pro'),
  make: __('In Make, add Webhooks → Custom webhook and copy its address.', 'wconvert-pro'),
  n8n: __('A Webhook node with method POST. Set Respond to Immediately, or a slow workflow is sent again.', 'wconvert-pro'),
  code: __('Any address that accepts a JSON POST.', 'wconvert-pro'),
})[receiver];

const URL_PLACEHOLDER: Record<Receiver, string> = {
  zapier: 'https://hooks.zapier.com/hooks/catch/…',
  make: 'https://hook.eu1.make.com/…',
  n8n: 'https://your-n8n.example/webhook/…',
  code: 'https://example.com/webhooks/wconvert',
};

/** The header a tool's own field stands for — Make's API key, n8n's Header Auth — or none. */
export function toolHeaders(receiver: Receiver, typed: { makeKey: string; authName: string; authValue: string }): HeaderPair[] {
  if (receiver === 'make' && typed.makeKey.trim() !== '') return headersToSend([{ name: MAKE_KEY_HEADER, value: typed.makeKey }]);
  if (receiver === 'n8n' && typed.authName.trim() !== '') return headersToSend([{ name: typed.authName, value: typed.authValue }]);
  return [];
}

/** What the tailored fields amount to, as the one `headers` list the server keeps. */
export const credentialsFor = (receiver: Receiver, typed: { makeKey: string; authName: string; authValue: string; extra: readonly HeaderPair[] }): HeaderPair[] =>
  [...toolHeaders(receiver, typed), ...headersToSend(typed.extra)];

/** `http://` carries every lead, and any header, readable on the way. */
export const insecure = (url: string) => /^\s*http:\/\//i.test(url);

/**
 * **The webhook's account setup: pick the tool, then a form made for it**
 * (variant B of the approved prototype, claude.ai/artifact/KJWnB3Hym1VBiL2MpVbgh4;
 * ADR 0148).
 *
 * Step 1 asks where signups go — Zapier, Make, n8n or the merchant's own
 * code — as radio cards with the tools' own logos. Step 2 asks only what that
 * tool needs: a Catch Hook URL for Zapier, an optional API key Make sends as
 * `x-make-apikey`, n8n's Header Auth. Every one of them is the same webhook
 * underneath — a URL, a generated secret and up to five headers — so the
 * choice decides the words and the fields, never what is stored.
 *
 * An existing account skips the picker. Its tool is guessed from the host only
 * to choose the hint, its headers are rows whose blank values keep what they
 * hold, and Regenerate asks in the footer rather than in a second dialog (§9).
 *
 * The secret a save generates is reported through `onSaved` and shown by
 * free's {@see RevealedSecret} wherever the form was opened from.
 */
export function WebhookConnectionForm({ type, account, title, meta, back, onSaved, onCancel, onDirtyChange }: ConnectionFormProps) {
  const id = useId();
  const editing = account !== undefined;
  const headersField = type.connection_schema?.headers ?? { type: 'headers', label: __('Custom headers', 'wconvert-pro'), max: 5 };
  const secretField = type.connection_schema?.signing_secret;
  const max = headersField.max ?? 5;
  const stored = useMemo(() => storedHeaders(account?.credentials.headers), [account]);
  const [step, setStep] = useState<'choose' | 'form'>(editing ? 'form' : 'choose');
  const [receiver, setReceiver] = useState<Receiver>(editing ? toolOfHost(account.account_identity) ?? 'code' : 'zapier');
  const [named, setNamed] = useState<string | null>(account?.label ?? null);
  const label = named ?? (receiver === 'code' ? type.label : nameOf(receiver));
  const [url, setUrl] = useState('');
  const [makeKey, setMakeKey] = useState('');
  const [authName, setAuthName] = useState('');
  const [authValue, setAuthValue] = useState('');
  const [extra, setExtra] = useState<HeaderPair[]>(stored);
  const [otherHeaders, setOtherHeaders] = useState(editing && stored.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, [step]);

  // Anything typed asks before Escape throws it away. Choosing a tool is not typing.
  const dirty = (named !== null && named !== (account?.label ?? null)) || url !== '' || makeKey !== '' || authName !== '' || authValue !== ''
    || extra !== stored;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Editing shows every stored header in one list; a new account splits the tool's own off the rest.
  const own = editing ? [] : toolHeaders(receiver, { makeKey, authName, authValue });
  const headers = [...own, ...headersToSend(extra)];
  const listed = [...own, ...extra];
  const headerRefused = listed.some((pair) => headerProblem(pair, listed, headersField, editing ? stored.map((known) => known.name) : []) !== null);
  const urlMissing = !editing && url.trim() === '';
  const warnPlain = insecure(url) && (headers.length > 0 || (editing && stored.length > 0));

  const save = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void saveConnection({
      id: account?.id,
      type: type.id,
      label: label.trim(),
      credentials: { ...(url.trim() !== '' ? { url: url.trim() } : {}), headers },
    }).then(({ connection, revealed: secrets }) => onSaved(connection, secrets))
      .catch((cause: unknown) => setError(messageOf(cause)))
      .finally(() => setBusy(false));
  };
  const regenerate = () => {
    if (!account || busy) return;
    setBusy(true);
    setError(null);
    void regenerateConnection(account.id).then(({ revealed: secrets }) => { setRevealed(secrets); setConfirming(false); })
      .catch((cause: unknown) => setError(messageOf(cause)))
      .finally(() => setBusy(false));
  };

  const header = (heading: ReactNode, line: ReactNode) => title === undefined ? null : <AdminDialogHeader title={heading} meta={line} />;
  const cancel = back ?? <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
    {revealed !== null && !dirty ? __('Done', 'wconvert-pro') : __('Cancel', 'wconvert-pro')}
  </Button>;

  if (step === 'choose') {
    return <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); setStep('form'); }}>
      {header(title, __('Step 1 of 2', 'wconvert-pro'))}
      <AdminDialogBody>
        <fieldset className="wconvert-radio-cards wconvert-webhook-tools">
          <legend className="wconvert-webhook-tools__legend">{__('Where should signups go?', 'wconvert-pro')}</legend>
          {RECEIVERS.map((each, index) => <label key={each} className="wconvert-radio-card wconvert-webhook-tool">
            <input ref={index === 0 ? first : undefined} type="radio" name={`${id}-receiver`} value={each} checked={receiver === each}
              aria-labelledby={`${id}-${each}`} aria-describedby={`${id}-${each}-help`} onChange={() => setReceiver(each)} />
            <ReceiverMark receiver={each} />
            <span><span id={`${id}-${each}`}>{nameOf(each)}</span><span id={`${id}-${each}-help`}>{summaryOf(each)}</span></span>
          </label>)}
        </fieldset>
      </AdminDialogBody>
      <AdminDialogFooter back={cancel}>
        <Button type="submit">{__('Continue', 'wconvert-pro')}</Button>
      </AdminDialogFooter>
    </form>;
  }

  const field = (key: string) => `${id}-${key}`;
  return <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); if (!confirming) save(); }}>
    {editing ? header(title, meta) : header(
      <span className="wconvert-webhook-heading"><ReceiverMark receiver={receiver} /><span>{receiver === 'code'
        ? sprintf(/* translators: %s: a service, e.g. “Webhook”. */ __('Connect %s', 'wconvert-pro'), type.label)
        : sprintf(/* translators: %s: a tool, e.g. “Make”. */ __('Connect %s', 'wconvert-pro'), nameOf(receiver))}</span></span>,
      receiver === 'code'
        ? sprintf(/* translators: %s: “Your own code”. */ __('Step 2 of 2 · %s', 'wconvert-pro'), nameOf(receiver))
        : sprintf(/* translators: %s: a service, e.g. “Webhook”. */ __('Step 2 of 2 · %s', 'wconvert-pro'), type.label))}
    <AdminDialogBody>
      <fieldset disabled={busy} className="wconvert-webhook-form">
        {title === undefined && !editing && <p className="wconvert-webhook-form__step">
          <ReceiverMark receiver={receiver} />
          {sprintf(/* translators: %s: a tool, e.g. “Make”. */ __('Step 2 of 2 · %s', 'wconvert-pro'), nameOf(receiver))}
        </p>}
        <Field label={__('Account name', 'wconvert-pro')} htmlFor={field('label')}>
          <Input ref={first} id={field('label')} value={label} onChange={(event) => setNamed(event.target.value)} />
        </Field>
        <Field label={__('Webhook URL', 'wconvert-pro')} htmlFor={field('url')} hintId={field('url-hint')}
          hint={<>{urlHintOf(receiver)}{receiver === 'code' && secretField?.guide && <>{' '}<GuideLink href={secretField.guide}>{__('How to verify', 'wconvert-pro')}</GuideLink></>}</>}>
          <Input id={field('url')} inputMode="url" dir="ltr" autoComplete="off" spellCheck={false} value={url}
            placeholder={editing ? __('Stored; enter a replacement', 'wconvert-pro') : URL_PLACEHOLDER[receiver]}
            aria-describedby={[field('url-hint'), warnPlain ? field('url-warn') : ''].filter(Boolean).join(' ')}
            onChange={(event) => setUrl(event.target.value)} />
        </Field>
        {warnPlain && <p id={field('url-warn')} className="wconvert-webhook-warning">
          <TriangleAlert aria-hidden="true" />
          <span>{__('http:// isn’t encrypted, so your header and every lead travel readable. Use https://.', 'wconvert-pro')}</span>
        </p>}

        {!editing && receiver === 'make' && <Field label={<>{__('API key', 'wconvert-pro')} <span className="wconvert-webhook-optional">{__('· optional', 'wconvert-pro')}</span></>}
          htmlFor={field('make-key')} hintId={field('make-key-hint')}
          hint={<>{sprintf(/* translators: %s: a header name, x-make-apikey. */ __('Sent as the %s header.', 'wconvert-pro'), MAKE_KEY_HEADER)}{' '}
            {!otherHeaders && <OtherHeaders onOpen={() => setOtherHeaders(true)} />}</>}>
          <Input id={field('make-key')} type="password" autoComplete="off" dir="ltr" value={makeKey} aria-describedby={field('make-key-hint')}
            placeholder={__('Paste the key from the webhook’s settings', 'wconvert-pro')} onChange={(event) => setMakeKey(event.target.value)} />
        </Field>}

        {!editing && receiver === 'n8n' && <div className="wconvert-webhook-pair">
          <Field label={<>{__('Header Auth name', 'wconvert-pro')} <span className="wconvert-webhook-optional">{__('· optional', 'wconvert-pro')}</span></>} htmlFor={field('auth-name')}>
            <Input id={field('auth-name')} dir="ltr" autoComplete="off" spellCheck={false} value={authName} placeholder="X-N8N-Auth"
              onChange={(event) => setAuthName(event.target.value)} />
          </Field>
          <Field label={__('Header Auth value', 'wconvert-pro')} htmlFor={field('auth-value')}>
            <Input id={field('auth-value')} type="password" dir="ltr" autoComplete="off" value={authValue} disabled={authName.trim() === ''}
              onChange={(event) => setAuthValue(event.target.value)} />
          </Field>
          {authName.trim() !== '' && authValue.trim() === '' && <p className="wconvert-webhook-problem">{__('Enter the value n8n expects.', 'wconvert-pro')}</p>}
        </div>}

        {(editing || receiver === 'code' || otherHeaders)
          ? <HeadersEditor field={{ ...headersField, max: max - own.length }} value={extra} onChange={setExtra}
            stored={editing ? stored.map((pair) => pair.name) : []}
            label={!editing && receiver !== 'code' ? __('Other headers', 'wconvert-pro') : undefined} />
          : receiver !== 'make' && <div><OtherHeaders onOpen={() => setOtherHeaders(true)} /></div>}

        {editing && revealed === null && <div className="wconvert-webhook-secret">
          <div>
            <div className="wconvert-webhook-secret__label">{secretField?.label ?? __('Signing secret', 'wconvert-pro')}</div>
            <div className="wconvert-webhook-secret__state">{__('Stored. Shown only when it is made.', 'wconvert-pro')}</div>
          </div>
          <Button type="button" variant="outline" aria-pressed={confirming} onClick={() => { setError(null); setConfirming(true); }}>
            {__('Regenerate', 'wconvert-pro')}
          </Button>
        </div>}
        {revealed !== null && <RevealedSecret type={type} revealed={revealed} />}
      </fieldset>
    </AdminDialogBody>
    {confirming
      // The question takes the footer's place, never a dialog over this one (§9).
      ? <AdminDialogFooter error={error} note={<span role="status">{__('Regenerate now? The next request is signed with the new secret, and your receiver refuses it until you update it there.', 'wconvert-pro')}</span>}>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>{__('Keep current', 'wconvert-pro')}</Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={regenerate}>
          {busy ? __('Regenerating…', 'wconvert-pro') : __('Regenerate secret', 'wconvert-pro')}
        </Button>
      </AdminDialogFooter>
      : <AdminDialogFooter error={error} note={editing ? undefined : __('Creates a signing secret', 'wconvert-pro')}
        back={editing ? cancel : <Button type="button" variant="outline" disabled={busy} onClick={() => { setError(null); setStep('choose'); }}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back', 'wconvert-pro')}
        </Button>}>
        <Button type="submit" disabled={busy || label.trim() === '' || urlMissing || headerRefused
          || (receiver === 'n8n' && !editing && authName.trim() !== '' && authValue.trim() === '')}>
          {busy ? __('Checking…', 'wconvert-pro') : __('Check and save account', 'wconvert-pro')}
        </Button>
      </AdminDialogFooter>}
  </form>;
}

function OtherHeaders({ onOpen }: { onOpen: () => void }) {
  return <Button type="button" variant="link" className="h-auto p-0" onClick={onOpen}>{__('Other headers', 'wconvert-pro')}</Button>;
}

/** A tool's own logo, in colour; the webhook mark for the merchant's own code. */
function ReceiverMark({ receiver }: { receiver: Receiver }) {
  if (receiver === 'code') return <span className="wconvert-webhook-mark wconvert-webhook-mark--code" aria-hidden="true"><Code /></span>;
  return <img className="wconvert-webhook-mark" src={toolMarks[receiver]} alt="" aria-hidden="true" />;
}

export default WebhookConnectionForm;

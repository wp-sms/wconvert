import { Suspense, useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { Input } from '../components/ui/input';
import { Field } from '../shell/Field';
import { messageOf } from '../shell/loadable';
import { saveConnection, type HeaderPair } from './api';
import { connectionSetup, type ConnectionFormProps } from './connectionSetup';
import { HeadersEditor, headerProblem, headersToSend, storedHeaders } from './HeadersEditor';

/** Kinds the server fills itself: a generated secret, the site it was made on. Never a field. */
const GENERATED = ['secret', 'site_url'];

/**
 * The same checked credential form in site settings and destination setup.
 *
 * A type that registered its own form ({@see connectionSetup}) gets that,
 * with the same props; every other gets this one, drawn from its connection
 * schema.
 *
 * It draws a dialog's body and footer, and the header only when given a
 * `title` — and the error sits beside Check and save, where §9 puts it, rather
 * than at the top of the fields. `back` replaces the footer's Cancel where the
 * form is a step inside another (Back to the destination's settings).
 */
export function ConnectionForm(props: ConnectionFormProps) {
  const Own = connectionSetup.connectionForms[props.type.id];
  if (!Own) return <GenericConnectionForm {...props} />;
  // A registered form may be lazy: the header stays while its code loads.
  return <Suspense fallback={<>
    {props.title !== undefined && <AdminDialogHeader title={props.title} meta={props.meta} />}
    <AdminDialogBody><p role="status" className="m-0 text-note text-muted-foreground">{__('Loading…', 'wconvert')}</p></AdminDialogBody>
  </>}><Own {...props} /></Suspense>;
}

function GenericConnectionForm({ type, account, title, meta, back, onSaved, onCancel, onDirtyChange }: ConnectionFormProps) {
  const initialLabel = account?.label ?? type.label;
  const fields = Object.entries(type.connection_schema ?? {}).filter(([, field]) => !GENERATED.includes(field.type));
  const [label, setLabel] = useState(initialLabel);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<Record<string, HeaderPair[]>>(() => Object.fromEntries(fields
    .filter(([, field]) => field.type === 'headers').map(([key]) => [key, storedHeaders(account?.credentials[key])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);
  const initialHeaders = useRef(headers);
  const dirty = label !== initialLabel || Object.values(credentials).some((value) => value !== '') || headers !== initialHeaders.current;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const id = (key: string) => `wconvert-account-${type.id}-${key}`;
  const stored = (key: string) => storedHeaders(account?.credentials[key]).map((pair) => pair.name);
  const filled = fields.every(([key, field]) => field.optional || field.type === 'headers'
    || credentials[key]?.trim() || account?.credentials[key]);
  const refused = fields.some(([key, field]) => field.type === 'headers'
    && (headers[key] ?? []).some((pair) => headerProblem(pair, headers[key], field, stored(key)) !== null));

  return <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    void saveConnection({
      id: account?.id,
      type: type.id,
      label: label.trim(),
      credentials: {
        ...Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim() !== '')),
        ...Object.fromEntries(Object.entries(headers).map(([key, pairs]) => [key, headersToSend(pairs)])),
      },
    }).then(({ connection, revealed }) => onSaved(connection, revealed))
      .catch((cause: unknown) => setError(messageOf(cause)))
      .finally(() => setBusy(false));
  }}>
    {title !== undefined && <AdminDialogHeader title={title} meta={meta} />}
    <AdminDialogBody>
      <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <Field label={__('Account name', 'wconvert')} htmlFor={id('label')}>
          <Input ref={nameRef} id={id('label')} value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        {fields.map(([key, field]) => field.type === 'headers'
          ? <HeadersEditor key={key} field={field} value={headers[key] ?? []} stored={stored(key)}
            onChange={(next) => setHeaders({ ...headers, [key]: next })} />
          : <Field key={key} label={field.label} htmlFor={id(key)} hint={field.description} hintId={field.description ? `${id(key)}-hint` : undefined}>
            <Input id={id(key)} type={field.type === 'password' ? 'password' : 'text'} inputMode={field.type === 'url' ? 'url' : undefined}
              dir={field.type === 'url' ? 'ltr' : undefined} autoComplete="off"
              aria-describedby={field.description ? `${id(key)}-hint` : undefined}
              value={credentials[key] ?? ''} onChange={(event) => setCredentials({ ...credentials, [key]: event.target.value })}
              placeholder={account?.credentials[key] ? __('Stored; enter a replacement', 'wconvert') : ''} />
          </Field>)}
      </fieldset>
    </AdminDialogBody>
    <AdminDialogFooter
      back={back ?? <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>}
      error={error}
    >
      <Button type="submit" disabled={busy || label.trim() === '' || !filled || refused}>
        {busy ? __('Checking…', 'wconvert') : __('Check and save account', 'wconvert')}
      </Button>
    </AdminDialogFooter>
  </form>;
}

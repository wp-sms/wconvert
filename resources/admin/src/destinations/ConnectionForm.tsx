import { useEffect, useRef, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { AdminDialogBody, AdminDialogFooter } from '../components/ui/admin-dialog';
import { Input } from '../components/ui/input';
import { Field } from '../shell/Field';
import { messageOf } from '../shell/loadable';
import { saveConnection, type Connection, type DestinationType } from './api';

/**
 * The same checked credential form in site settings and destination setup.
 *
 * It draws a dialog's body and footer, so the caller owns only the header —
 * and the error sits beside Check and save, where §9 puts it, rather than at
 * the top of the fields. `back` replaces the footer's Cancel where the form is
 * a step inside another (Back to the destination's settings).
 */
export function ConnectionForm({ type, account, back, onSaved, onCancel, onDirtyChange }: {
  type: DestinationType;
  account?: Connection;
  back?: ReactNode;
  onSaved: (connection: Connection) => void | Promise<void>;
  onCancel: () => void;
  /** Whether anything was typed, for the dialog's "Discard changes?". */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initialLabel = account?.label ?? type.label;
  const [label, setLabel] = useState(initialLabel);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);
  const dirty = label !== initialLabel || Object.values(credentials).some((value) => value !== '');
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const id = (key: string) => `wconvert-account-${type.id}-${key}`;
  const hasCredentials = Object.keys(type.connection_schema ?? {}).every((key) =>
    credentials[key]?.trim() || account?.credentials[key]);

  return <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    void saveConnection({
      id: account?.id,
      type: type.id,
      label: label.trim(),
      credentials: Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim() !== '')),
    }).then(({ connection }) => onSaved(connection))
      .catch((cause: unknown) => setError(messageOf(cause)))
      .finally(() => setBusy(false));
  }}>
    <AdminDialogBody>
      <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <Field label={__('Account name', 'wconvert')} htmlFor={id('label')}>
          <Input ref={nameRef} id={id('label')} value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        {Object.entries(type.connection_schema ?? {}).map(([key, field]) => <Field key={key} label={field.label} htmlFor={id(key)}>
          <Input id={id(key)} type={field.type === 'password' ? 'password' : 'text'} autoComplete="off"
            value={credentials[key] ?? ''} onChange={(event) => setCredentials({ ...credentials, [key]: event.target.value })}
            placeholder={account?.credentials[key] ? __('Stored; enter a replacement', 'wconvert') : ''} />
        </Field>)}
      </fieldset>
    </AdminDialogBody>
    <AdminDialogFooter
      back={back ?? <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>}
      error={error}
    >
      <Button type="submit" disabled={busy || label.trim() === '' || !hasCredentials}>
        {busy ? __('Checking…', 'wconvert') : __('Check and save account', 'wconvert')}
      </Button>
    </AdminDialogFooter>
  </form>;
}

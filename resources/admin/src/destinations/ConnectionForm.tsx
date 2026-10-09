import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RegionError } from '../shell/Region';
import { messageOf } from '../shell/loadable';
import { saveConnection, type Connection, type DestinationType } from './api';

/** The same checked credential form in site settings and destination setup. */
export function ConnectionForm({ type, account, onSaved, onCancel }: {
  type: DestinationType;
  account?: Connection;
  onSaved: (connection: Connection) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(account?.label ?? type.label);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);
  const id = (key: string) => `wconvert-account-${type.id}-${key}`;
  const hasCredentials = Object.keys(type.connection_schema ?? {}).every((key) =>
    credentials[key]?.trim() || account?.credentials[key]);

  return <form className="flex flex-col gap-4" onSubmit={(event) => {
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
    {error && <RegionError message={error} />}
    <fieldset disabled={busy} className="m-0 flex flex-col gap-4 border-0 p-0">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id('label')}>{__('Account name', 'wconvert')}</Label>
        <Input ref={nameRef} id={id('label')} value={label} onChange={(event) => setLabel(event.target.value)} />
      </div>
      {Object.entries(type.connection_schema ?? {}).map(([key, field]) => <div key={key} className="flex flex-col gap-1.5">
        <Label htmlFor={id(key)}>{field.label}</Label>
        <Input id={id(key)} type={field.type === 'password' ? 'password' : 'text'} autoComplete="off"
          value={credentials[key] ?? ''} onChange={(event) => setCredentials({ ...credentials, [key]: event.target.value })}
          placeholder={account?.credentials[key] ? __('Stored; enter a replacement', 'wconvert') : ''} />
      </div>)}
    </fieldset>
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>
      <Button type="submit" disabled={busy || label.trim() === '' || !hasCredentials}>
        {busy ? __('Checking…', 'wconvert') : __('Check and save account', 'wconvert')}
      </Button>
    </div>
  </form>;
}

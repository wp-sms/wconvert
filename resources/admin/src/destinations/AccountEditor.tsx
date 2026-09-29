import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RegionError } from '../shell/Region';
import { messageOf } from '../shell/loadable';
import { checkConnection, deleteConnection, saveConnection, type Connection, type DestinationType, type TestReport } from './api';

export function AccountEditor({ types, connections, usage, onChange }: {
  types: readonly DestinationType[];
  connections: readonly Connection[];
  usage: Readonly<Record<string, readonly string[]>>;
  onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ type: DestinationType; account?: Connection } | null>(null);
  const [label, setLabel] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, TestReport>>({});
  const open = (type: DestinationType, account?: Connection) => {
    setEditing({ type, account }); setLabel(account?.label ?? type.label); setCredentials({}); setError(null);
  };
  const remoteTypes = types.filter((type) => type.needs_connection && type.availability === 'ready');
  return <>
    <div className="flex flex-wrap gap-2">
      {remoteTypes.map((type) => <Button key={type.id} size="sm" variant="outline" onClick={() => open(type)}>{__('Connect', 'wconvert')} {type.label}</Button>)}
    </div>
    {connections.length === 0 ? <p className="m-0 text-note text-muted-foreground">{__('No remote accounts are configured.', 'wconvert')}</p>
      : <ul className="m-0 list-none divide-y divide-border p-0">{connections.map((account) => {
        const type = types.find((candidate) => candidate.id === account.type);
        return <li key={account.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
          <div><strong className="block">{account.label}</strong><span className="text-note text-muted-foreground">{type?.label ?? account.type}</span>
            {account.checked_at && <p className="m-0 text-note text-muted-foreground">{account.check_outcome === 'success' ? __('Last account check passed', 'wconvert') : __('Last account check failed', 'wconvert')} · {new Date(account.checked_at).toLocaleString()}</p>}
            {checks[account.id] && <p className="m-0 text-note" role="status">{checks[account.id].message}</p>}
          </div>
          <div className="flex flex-col gap-1 text-note">{(usage[account.id] ?? []).map((name) => <span key={name}>{name}</span>)}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const result = await checkConnection(account.id); setChecks((old) => ({ ...old, [account.id]: result })); await onChange(); } catch (cause) { setChecks((old) => ({ ...old, [account.id]: { outcome: 'failed', message: messageOf(cause) } })); } finally { setBusy(false); } }}>{__('Check', 'wconvert')}</Button>
            {type && <Button size="sm" variant="outline" onClick={() => open(type, account)}>{__('Edit', 'wconvert')}</Button>}
            <Button size="sm" variant="outline" disabled={busy || (usage[account.id] ?? []).length > 0} onClick={async () => { setBusy(true); try { await deleteConnection(account.id); await onChange(); } catch (cause) { setChecks((old) => ({ ...old, [account.id]: { outcome: 'failed', message: messageOf(cause) } })); } finally { setBusy(false); } }}>{__('Remove', 'wconvert')}</Button>
          </div>
        </li>;
      })}</ul>}
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing?.account ? __('Edit account', 'wconvert') : __('Connect account', 'wconvert')}</DialogTitle><DialogDescription>{__('We check new credentials before saving them. Leave a key blank to keep the current one.', 'wconvert')}</DialogDescription></DialogHeader>
        {error && <RegionError message={error} />}
        {editing && <fieldset disabled={busy} className="flex flex-col gap-4 border-0 p-0">
          <div className="flex flex-col gap-1"><Label htmlFor="account-label">{__('Name', 'wconvert')}</Label><Input id="account-label" value={label} onChange={(event) => setLabel(event.target.value)} /></div>
          {Object.entries(editing.type.connection_schema ?? {}).map(([key, field]) => <div key={key} className="flex flex-col gap-1"><Label htmlFor={`account-${key}`}>{field.label}</Label><Input id={`account-${key}`} type="password" autoComplete="off" value={credentials[key] ?? ''} onChange={(event) => setCredentials({ ...credentials, [key]: event.target.value })} placeholder={editing.account ? __('Stored; enter a replacement', 'wconvert') : ''} /></div>)}
          <Button disabled={busy || label.trim() === ''} onClick={async () => {
            setBusy(true); setError(null);
            try { await saveConnection({ id: editing.account?.id, type: editing.type.id, label, credentials: Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim() !== '')) }); await onChange(); setEditing(null); }
            catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
          }}>{busy ? __('Checking…', 'wconvert') : __('Check and save account', 'wconvert')}</Button>
        </fieldset>}
      </DialogContent>
    </Dialog>
  </>;
}

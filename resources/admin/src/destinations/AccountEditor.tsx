import { useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { messageOf } from '../shell/loadable';
import { checkConnection, deleteConnection, type Connection, type DestinationType, type TestReport } from './api';
import { ConnectionForm } from './ConnectionForm';
import { ProviderMark } from './ProviderMark';

export function AccountEditor({ types, connections, usage, onChange }: {
  types: readonly DestinationType[];
  connections: readonly Connection[];
  usage: Readonly<Record<string, readonly string[]>>;
  onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ type: DestinationType; account?: Connection } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Record<string, TestReport>>({});
  const [removing, setRemoving] = useState<Connection | null>(null);
  const removeTrigger = useRef<HTMLElement | null>(null);
  const open = (type: DestinationType, account?: Connection) => {
    setEditing({ type, account });
  };
  const remoteTypes = types.filter((type) => type.needs_connection && type.availability === 'ready');
  return <>
    <div className="flex flex-wrap gap-2">
      {remoteTypes.map((type) => <Button key={type.id} variant="outline" onClick={() => open(type)}><ProviderMark type={type} className="size-5 shrink-0" />{__('Connect', 'wconvert')} {type.label}</Button>)}
    </div>
    {connections.length === 0 ? <p className="m-0 text-note text-muted-foreground">{__('No remote accounts are configured.', 'wconvert')}</p>
      : <ul className="m-0 list-none divide-y divide-border p-0">{connections.map((account) => {
        const type = types.find((candidate) => candidate.id === account.type);
        return <li key={account.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
          <div className="flex min-w-0 items-start gap-2 [overflow-wrap:anywhere]"><ProviderMark type={type} className="mt-0.5 size-5 shrink-0" /><div><strong className="block">{account.label}</strong><span className="text-note text-muted-foreground">{type?.label ?? account.type}</span>
            {account.checked_at && <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-note text-muted-foreground"><Badge variant={account.check_outcome === 'success' ? 'success' : 'warning'}>{account.check_outcome === 'success' ? __('Account check passed', 'wconvert') : __('Account check failed', 'wconvert')}</Badge>{new Date(account.checked_at).toLocaleString()}</p>}
            {checks[account.id] && <p className="m-0 text-note" role={checks[account.id].outcome === 'failed' ? 'alert' : 'status'}>{checks[account.id].message}</p>}
          </div></div>
          <div className="flex min-w-0 flex-col gap-1 text-note [overflow-wrap:anywhere]">{(usage[account.id] ?? []).length > 0 && <span className="text-muted-foreground">{__('Used by:', 'wconvert')}</span>}{(usage[account.id] ?? []).map((name) => <span key={name}>{name}</span>)}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const result = await checkConnection(account.id); setChecks((old) => ({ ...old, [account.id]: result })); await onChange(); } catch (cause) { setChecks((old) => ({ ...old, [account.id]: { outcome: 'failed', message: messageOf(cause) } })); } finally { setBusy(false); } }}>{__('Check', 'wconvert')}</Button>
            {type && <Button variant="outline" onClick={() => open(type, account)}>{__('Edit', 'wconvert')}</Button>}
            <Button variant="outline" disabled={busy || (usage[account.id] ?? []).length > 0} onClick={(event) => { removeTrigger.current = event.currentTarget; setRemoving(account); }}>{__('Remove', 'wconvert')}</Button>
          </div>
        </li>;
      })}</ul>}
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing?.account ? __('Edit account', 'wconvert') : __('Connect account', 'wconvert')}</DialogTitle><DialogDescription>{__('We check new credentials before saving them. Leave a key blank to keep the current one.', 'wconvert')}</DialogDescription></DialogHeader>
        {editing && <ConnectionForm key={editing.account?.id ?? editing.type.id} type={editing.type} account={editing.account}
          onCancel={() => setEditing(null)} onSaved={async () => { await onChange(); setEditing(null); }} />}
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null); }}
      title={__('Remove this account?', 'wconvert')}
      description={removing ? sprintf(__('The saved credentials for “%s” will be removed. Destinations using an account must be reassigned or removed first.', 'wconvert'), removing.label) : ''}
      confirmLabel={__('Remove account', 'wconvert')} returnFocusTo={removeTrigger}
      onConfirm={() => {
        const account = removing;
        setRemoving(null);
        if (!account) return;
        setBusy(true);
        void deleteConnection(account.id).then(onChange).catch((cause) => {
          setChecks((old) => ({ ...old, [account.id]: { outcome: 'failed', message: messageOf(cause) } }));
        }).finally(() => setBusy(false));
      }} />
  </>;
}

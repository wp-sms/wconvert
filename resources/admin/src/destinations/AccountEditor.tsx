import { useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AdminDialog, AdminDialogContent, AdminDialogHeader } from '../components/ui/admin-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { messageOf } from '../shell/loadable';
import { formatCount, formatWhen } from '../lib/format';
import { checkConnection, deleteConnection, type Connection, type DestinationType, type TestReport } from './api';
import { ConnectionForm } from './ConnectionForm';
import { ProviderMark } from './ProviderMark';
import { TestReportAlert } from './status';

/**
 * The site's connected accounts: one row each, with its last check, the
 * destinations that use it, and Check beside a ⋯ for Edit and Remove.
 *
 * **Busy is per account**, for the reason {@see Destinations} gives for its
 * routes: one boolean meant checking one account froze every row's buttons
 * for the length of that one request.
 */
export function AccountEditor({ types, connections, usage, onChange }: {
  types: readonly DestinationType[];
  connections: readonly Connection[];
  usage: Readonly<Record<string, readonly string[]>>;
  onChange: () => Promise<void>;
}) {
  const id = useId();
  const [editing, setEditing] = useState<{ type: DestinationType; account?: Connection } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<Readonly<Record<string, 'checking' | 'removing'>>>({});
  const [checks, setChecks] = useState<Record<string, TestReport>>({});
  const [removing, setRemoving] = useState<Connection | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  // Each row's ⋯, so a dialog opened from its menu returns focus to it — the
  // menu item that was focused is gone by then.
  const menus = useRef(new Map<string, HTMLButtonElement>());
  const hold = (account: string, what: 'checking' | 'removing' | null) => setBusy((current) => {
    const next = { ...current };
    if (what === null) delete next[account]; else next[account] = what;
    return next;
  });
  const open = (type: DestinationType, account?: Connection) => {
    setDirty(false);
    setEditing({ type, account });
  };
  const check = async (account: Connection) => {
    hold(account.id, 'checking');
    try {
      const result = await checkConnection(account.id);
      setChecks((old) => ({ ...old, [account.id]: result }));
      await onChange();
    } catch (cause) {
      setChecks((old) => ({ ...old, [account.id]: { outcome: 'failed', message: messageOf(cause) } }));
    } finally {
      hold(account.id, null);
    }
  };
  const remoteTypes = types.filter((type) => type.needs_connection && type.availability === 'ready');
  return <>
    {remoteTypes.length > 0 && <div className="flex flex-wrap gap-2">
      {remoteTypes.map((type) => <Button key={type.id} variant="outline" onClick={(event) => { trigger.current = event.currentTarget; open(type); }}>
        <ProviderMark type={type} className="size-5 shrink-0" />
        {sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Connect %s', 'wconvert'), type.label)}
      </Button>)}
    </div>}
    {connections.length === 0 ? <p className="m-0 text-note text-muted-foreground">{__('No accounts connected yet.', 'wconvert')}</p>
      : <ul className="m-0 list-none divide-y divide-border p-0">{connections.map((account) => {
        const type = types.find((candidate) => candidate.id === account.type);
        const usedBy = usage[account.id] ?? [];
        const state = busy[account.id];
        const blocked = `${id}-${account.id}-blocked`;
        return <li key={account.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
          <div className="flex min-w-0 flex-1 items-start gap-2 [overflow-wrap:anywhere]">
            <ProviderMark type={type} className="mt-0.5 size-5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <strong><bdi>{account.label}</bdi></strong>
              {type !== undefined && <span className="text-note text-muted-foreground">{type.label}</span>}
              {account.checked_at && <p className="m-0 flex flex-wrap items-center gap-2 text-note text-muted-foreground">
                <Badge variant={account.check_outcome === 'success' ? 'success' : 'warning'}>{account.check_outcome === 'success' ? __('Check passed', 'wconvert') : __('Check failed', 'wconvert')}</Badge>
                {formatWhen(account.checked_at, 'list')}
              </p>}
              {usedBy.length > 0 && <p className="m-0 text-note text-muted-foreground">
                {sprintf(
                  /* translators: %s: names of destinations, comma-separated. */
                  __('Used by %s', 'wconvert'),
                  usedBy.join(__(', ', 'wconvert')),
                )}
              </p>}
              {checks[account.id] && <TestReportAlert report={checks[account.id]} className="mt-1" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={state !== undefined} onClick={() => void check(account)}>
              {state === 'checking' ? __('Checking…', 'wconvert') : __('Check', 'wconvert')}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button ref={(node) => { if (node) menus.current.set(account.id, node); else menus.current.delete(account.id); }}
                  variant="ghost" size="icon" disabled={state !== undefined}
                  aria-label={sprintf(/* translators: %s: an account's name. */ __('Actions for %s', 'wconvert'), account.label)}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={5}>
                {type && <>
                  <DropdownMenuItem onSelect={() => { trigger.current = menus.current.get(account.id) ?? null; open(type, account); }}>
                    <Pencil aria-hidden="true" />{__('Edit', 'wconvert')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>}
                {/*
                  Refused, not disabled, while a destination still runs over
                  it: Radix skips a disabled item, which hides the reason with
                  the action (§14).
                */}
                <DropdownMenuItem variant={usedBy.length > 0 ? 'default' : 'destructive'}
                  aria-disabled={usedBy.length > 0 ? true : undefined}
                  aria-describedby={usedBy.length > 0 ? blocked : undefined}
                  className={usedBy.length > 0 ? 'text-muted-foreground' : undefined}
                  onSelect={(event) => {
                    if (usedBy.length > 0) { event.preventDefault(); return; }
                    trigger.current = menus.current.get(account.id) ?? null;
                    setRemoving(account);
                  }}>
                  <Trash2 aria-hidden="true" />
                  <span className="flex flex-col">
                    {__('Remove', 'wconvert')}
                    {usedBy.length > 0 && <span id={blocked} className="text-note">
                      {sprintf(
                        /* translators: %s: how many destinations use this account. */
                        _n('Used by %s destination. Remove it or move it to another account first.', 'Used by %s destinations. Remove them or move them to another account first.', usedBy.length, 'wconvert'),
                        formatCount(usedBy.length),
                      )}
                    </span>}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {state === 'removing' && <p role="status" className="m-0 basis-full text-note text-muted-foreground">{__('Removing…', 'wconvert')}</p>}
        </li>;
      })}</ul>}
    <AdminDialog open={editing !== null} onOpenChange={(next) => { if (!next) setEditing(null); }}>
      <AdminDialogContent size="sm" dirty={dirty}
        onCloseAutoFocus={(event) => { if (trigger.current?.isConnected) { event.preventDefault(); trigger.current.focus(); } }}>
        {editing && <>
          <AdminDialogHeader
            title={editing.account ? editing.account.label : sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Connect %s', 'wconvert'), editing.type.label)}
            meta={editing.account ? editing.type.label : __('One account can serve several destinations.', 'wconvert')}
          />
          <ConnectionForm key={editing.account?.id ?? editing.type.id} type={editing.type} account={editing.account}
            onDirtyChange={setDirty}
            onCancel={() => setEditing(null)} onSaved={async () => { await onChange(); setEditing(null); }} />
        </>}
      </AdminDialogContent>
    </AdminDialog>
    <ConfirmDialog open={removing !== null} onOpenChange={(next) => { if (!next) setRemoving(null); }}
      variant="destructive" title={__('Remove this account?', 'wconvert')}
      description={removing ? sprintf(
        /* translators: %s: an account's name. */
        __('The saved credentials for “%s” are deleted from this site. Leads already in WConvert stay.', 'wconvert'),
        removing.label,
      ) : ''}
      confirmLabel={__('Remove account', 'wconvert')} returnFocusTo={trigger}
      onConfirm={() => {
        const account = removing;
        setRemoving(null);
        if (!account) return;
        hold(account.id, 'removing');
        void deleteConnection(account.id).then(onChange).catch((cause) => {
          setChecks((old) => ({ ...old, [account.id]: { outcome: 'failed', message: messageOf(cause) } }));
        }).finally(() => hold(account.id, null));
      }} />
  </>;
}

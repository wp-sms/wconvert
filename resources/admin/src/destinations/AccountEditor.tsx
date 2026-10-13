import { useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChevronDown, CircleCheck, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogClose,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import { messageOf } from '../shell/loadable';
import { formatCount, formatWhen } from '../lib/format';
import { interpolate } from '../lib/interpolate';
import { checkConnection, deleteConnection, type Connection, type DestinationType, type TestReport } from './api';
import { ConnectionForm } from './ConnectionForm';
import { ProviderMark } from './ProviderMark';
import { RevealedSecret } from './RevealedSecret';
import { TestReportAlert } from './status';

/**
 * The site's connected accounts: one row each, with its last check, the
 * destinations that use it, and Check beside a ⋯ for Edit and Remove.
 *
 * **Below the destinations, and one door in rather than one per service.**
 * It used to be the screen's first region, with a Connect button for every
 * provider — a second way in beside *Add a destination* that created no
 * destination, so a first-time owner who pasted a key was left with nothing
 * that sends. An account is the means, not the thing the page is for: it sits
 * under the routes that use it, behind one *Connect an account* menu, and a
 * new connection ends on the next step — *Add a Mailchimp destination* —
 * rather than on a closed dialog. ADR 0091's split between accounts and
 * destinations stays; only the order and the hand-off changed.
 *
 * **Busy is per account**, for the reason {@see Destinations} gives for its
 * routes: one boolean meant checking one account froze every row's buttons
 * for the length of that one request.
 */
export function AccountEditor({ types, connections, usage, onChange, onAddDestination }: {
  types: readonly DestinationType[];
  connections: readonly Connection[];
  usage: Readonly<Record<string, readonly string[]>>;
  onChange: () => Promise<void>;
  /**
   * The step after a new connection: add a route of that type over it. The
   * trigger is where focus returns if that dialog is dismissed.
   */
  onAddDestination?: (type: DestinationType, account: Connection, trigger: HTMLElement | null) => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState<{ type: DestinationType; account?: Connection } | null>(null);
  /**
   * The account a CONNECT just saved, which turns the dialog into its result:
   * what happened and the next step. An edit of an existing account has no
   * next step, so it closes as it always did. `revealed` is a generated
   * secret, shown here once (ADR 0148).
   */
  const [connected, setConnected] = useState<{ account: Connection; revealed?: Record<string, string> } | null>(null);
  const connectMenu = useRef<HTMLButtonElement>(null);
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
    setConnected(null);
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
  return <Region>
    <RegionHeader title={__('Accounts', 'wconvert')}
      description={__('Sign in once per service. Destinations above use these accounts.', 'wconvert')}
      trailing={remoteTypes.length > 0 && <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button ref={connectMenu} variant="outline">
            {__('Connect an account', 'wconvert')}<ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={5}>
          {remoteTypes.map((type) => <DropdownMenuItem key={type.id}
            onSelect={() => { trigger.current = connectMenu.current; open(type); }}>
            <ProviderMark type={type} className="size-4 shrink-0" />{type.label}
          </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>} />
    <RegionBody className="flex flex-col gap-3">
    {connections.length === 0 ? <p className="m-0 text-note text-muted-foreground">{__('No accounts connected yet.', 'wconvert')}</p>
      : <ul className="m-0 list-none divide-y divide-border p-0">{connections.map((account) => {
        const type = types.find((candidate) => candidate.id === account.type);
        const usedBy = usage[account.id] ?? [];
        const said = metaOf(type, account);
        const state = busy[account.id];
        const blocked = `${id}-${account.id}-blocked`;
        return <li key={account.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
          <div className="flex min-w-0 flex-1 items-start gap-2 [overflow-wrap:anywhere]">
            <ProviderMark type={type} connection={account} className="mt-0.5 size-5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <strong><bdi>{account.label}</bdi></strong>
              {said !== '' && <span className="text-note text-muted-foreground">{said}</span>}
              {(account.checked_at || account.site_changed) && <p className="m-0 flex flex-wrap items-center gap-2 text-note text-muted-foreground">
                {account.checked_at && <Badge variant={account.check_outcome === 'success' ? 'success' : 'warning'}>{account.check_outcome === 'success' ? __('Check passed', 'wconvert') : __('Check failed', 'wconvert')}</Badge>}
                {account.site_changed && <Badge variant="warning">{__('On a copy of the site', 'wconvert')}</Badge>}
                {account.checked_at && formatWhen(account.checked_at, 'list')}
              </p>}
              {/* A badge and one line on the row, not a banner (§14): it still sends, and says so. */}
              {account.site_changed && <p className="m-0 text-note text-muted-foreground">
                {account.set_up_on
                  ? interpolate(/* translators: 1: a site's host, e.g. “shop.example”. 2: the word “staging”, emphasised. */
                    __('Set up on %1$s. Signups on this site still reach it, marked %2$s. To stop that, turn this destination off in the campaigns here.', 'wconvert'),
                    [<bdi key="site">{account.set_up_on}</bdi>, <em key="staging">{__('staging', 'wconvert')}</em>])
                  : interpolate(/* translators: %s: the word “staging”, emphasised. */
                    __('Set up on another site. Signups on this site still reach it, marked %s. To stop that, turn this destination off in the campaigns here.', 'wconvert'),
                    [<em key="staging">{__('staging', 'wconvert')}</em>])}
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
    </RegionBody>
    <AdminDialog open={editing !== null} onOpenChange={(next) => { if (!next) setEditing(null); }}>
      <AdminDialogContent size="sm" dirty={connected === null && dirty}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Null when the hand-off to Add took over: that dialog owns focus now.
          if (trigger.current?.isConnected) trigger.current.focus();
        }}>
        {editing && connected !== null ? <>
          {/*
            **A connection ends on the next step, not on nothing.** The account
            alone sends nowhere; the destination over it is what a campaign
            picks, so that is the one primary action here. A generated secret
            is shown above it, once, and never blocks Done.
          */}
          <AdminDialogHeader
            title={<span className="flex min-w-0 items-center gap-2">
              <ProviderMark type={editing.type} connection={connected.account} className="size-5 shrink-0" />
              <bdi className="truncate">{connected.account.label}</bdi>
            </span>}
            meta={metaOf(editing.type, connected.account)} />
          <AdminDialogBody className="flex flex-col gap-4">
            <p role="status" className="m-0 flex items-start gap-2">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              {/* A forwarding type has no "where in" it: the whole submission goes to one URL. */}
              {editing.type.forwards_submission
                ? __('Connected. Add a destination, then turn it on in a campaign and send a test there.', 'wconvert')
                : sprintf(
                  /* translators: %s: a service, e.g. “Mailchimp”. */
                  __('Connected. Add a destination to choose where in %s new leads go.', 'wconvert'),
                  editing.type.label,
                )}
            </p>
            {connected.revealed && <RevealedSecret type={editing.type} revealed={connected.revealed} />}
          </AdminDialogBody>
          <AdminDialogFooter back={<AdminDialogClose asChild><Button type="button" variant="outline">{__('Done', 'wconvert')}</Button></AdminDialogClose>}>
            {onAddDestination && <Button type="button" onClick={() => {
              const { type } = editing;
              const returnTo = trigger.current;
              trigger.current = null;
              setEditing(null);
              onAddDestination(type, connected.account, returnTo);
            }}>
              {sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Add a %s destination', 'wconvert'), editing.type.label)}
            </Button>}
          </AdminDialogFooter>
        </> : editing && <ConnectionForm key={editing.account?.id ?? editing.type.id} type={editing.type} account={editing.account}
          title={editing.account ? editing.account.label : sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Connect %s', 'wconvert'), editing.type.label)}
          meta={editing.account ? metaOf(editing.type, editing.account) : __('One account can serve several destinations.', 'wconvert')}
          onDirtyChange={setDirty}
          onCancel={() => setEditing(null)} onSaved={async (account, revealed) => {
            await onChange();
            if (editing.account === undefined) setConnected({ account, revealed }); else setEditing(null);
          }} />}
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
  </Region>;
}

/**
 * The muted line under an account's name: its service, and for a type that
 * forwards submissions to a URL, the host it posts to — `Webhook ·
 * hooks.zapier.com`. An email service's identity is an opaque account id, so
 * it is not said.
 */
function metaOf(type: DestinationType | undefined, account: Connection): string {
  const host = type?.forwards_submission && account.account_identity ? account.account_identity : null;
  return [type?.label, host].filter((part): part is string => typeof part === 'string' && part !== '').join(' · ');
}

import { useEffect, useRef, useState, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogClose,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import { ProviderTiles } from './ProviderTiles';
import { DestinationSettingsForm } from './DestinationSettingsForm';
import { ProviderMark } from './ProviderMark';
import type { Connection, DestinationType } from './api';

/**
 * **Name a route and point it, in one step.**
 *
 * ============================================================================
 * A DESTINATION IS A NAMED ROUTE, AND ADD USED TO MAKE AN ANONYMOUS ONE.
 * ============================================================================
 * *Add* posted `label: type.label` and an empty settings bag, so a merchant
 * got a [[Destination]] called "MailPoet" pointed at nothing, and then had to
 * find the form under it. With one route per type that was survivable. It is
 * not survivable with two: *"MailPoet"* and *"MailPoet"* is a list of two
 * checkboxes a merchant cannot tell apart, on the tab where they choose which
 * one an [[Optin]] feeds.
 *
 * So the three decisions that MAKE a route — what it is called, which account
 * it runs over, and what inside that account it points at — are asked
 * together, before it exists.
 *
 * ============================================================================
 * ONE MEDIUM DIALOG, TWO STEPS, AND BACK BETWEEN THEM.
 * ============================================================================
 * The provider list is the campaign editor's own {@see ProviderTiles}, so a
 * service reads and refuses the same way wherever a route is started. Step two
 * has Back to that list in its footer: it used to be a dead end that had to be
 * closed and reopened to pick another service.
 *
 * **Controlled, and `returnFocusTo` rather than a `DialogTrigger`**, for the
 * reason {@see ConfirmDialog} writes out: a triggerless dialog has nothing to
 * restore focus to, and closing one leaves a keyboard merchant on `<body>` at
 * the top of the document.
 *
 * It stays open on a failed save and closes on one that worked, because the
 * merchant's typed name is in it — dropping the dialog on a 500 would make
 * them type it again to find out whether the second attempt fails too. And it
 * asks before Escape throws typed input away (`dirty`).
 */
export function AddDestinationDialog({
  type,
  connection = null,
  choosing = false,
  types,
  connections,
  busy,
  error,
  returnFocusTo,
  onOpenChange,
  onChoose,
  onBack,
  onConfirm,
  onConnectionSaved,
}: {
  /** The selected service, or null while choosing or closed. */
  type: DestinationType | null;
  /**
   * The account to start on — the one just connected from Accounts, whose
   * next step is a route over it. Null leaves the form's own choice.
   */
  connection?: string | null;
  choosing?: boolean;
  /** Every type the payload carries; the tiles hide what a free install cannot buy. */
  types: readonly DestinationType[];
  /** Every Connection on the site — this filters to the type's own. */
  connections: readonly Connection[];
  busy: boolean;
  /** What the last attempt to create this failed with. */
  error: string | null;
  returnFocusTo: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onChoose: (type: DestinationType) => void;
  onBack: () => void;
  onConfirm: (draft: {
    label: string;
    connection: string | null;
    settings: Record<string, unknown>;
  }) => void;
  onConnectionSaved?: (connection: Connection) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const open = choosing || type !== null;
  useEffect(() => {
    // Choosing a service replaces the focused tile inside the same dialog,
    // and Back replaces the form: move into what replaced it rather than
    // leaving focus on <body>. Not while closing: the content outlives the
    // close by a commit, and focusing a tile in it took focus back from the
    // card an Add had just created.
    if (!open) return;
    const target = type === null ? 'button.wconvert-provider-tile' : '.wconvert-dialog__body input';
    content.current?.querySelector<HTMLElement>(target)?.focus();
  }, [type, open]);

  return (
    <AdminDialog open={open} onOpenChange={(open) => { if (!open && busy) return; onOpenChange(open); }}>
      <AdminDialogContent
        ref={content}
        size="md"
        dirty={type !== null && dirty}
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          // Always taken over: after an Add that worked the ref is emptied,
          // because focus belongs on the new route's card — and Radix's own
          // restore runs a tick later, after that card has taken it.
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <AdminDialogHeader
          title={type === null
            ? __('Add a destination', 'wconvert')
            : <span className="flex min-w-0 items-center gap-2">
              <ProviderMark type={type} className="size-5 shrink-0" />
              <span className="truncate">{sprintf(/* translators: %s: a service, e.g. “MailPoet”. */ __('New %s destination', 'wconvert'), type.label)}</span>
            </span>}
          /*
            **The one sentence that explains the model** (ADR 0042 rule 2): a
            merchant who does not know they may add a second MailPoet route
            will not go looking for it.
          */
          meta={type === null
            ? __('Choose a service. You can add more than one destination for the same service.', 'wconvert')
            : __('Name it and choose where submissions go. You’ll pick it in a campaign afterward.', 'wconvert')}
        />

        {/*
          Keyed by the type, so opening MailPoet after WP SMS seeds a fresh
          draft rather than editing the last one's.
        */}
        {type === null ? <>
          <AdminDialogBody>
            <ProviderTiles types={types} rule={null} suggested={[]} onChoose={(chosen) => onChoose(chosen)} />
          </AdminDialogBody>
          <AdminDialogFooter back={<AdminDialogClose asChild><Button type="button" variant="outline">{__('Cancel', 'wconvert')}</Button></AdminDialogClose>} />
        </> : (
          <DestinationSettingsForm
            key={`${type.id}-${connection ?? ''}`}
            type={type}
            initialConnection={connection ?? undefined}
            connections={connections.filter((connection) => connection.type === type.id)}
            busy={busy}
            error={error}
            back={<Button type="button" variant="outline" disabled={busy} onClick={onBack}>
              <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back', 'wconvert')}
            </Button>}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
            onConnectionSaved={onConnectionSaved}
            onDirtyChange={setDirty}
          />
        )}
      </AdminDialogContent>
    </AdminDialog>
  );
}

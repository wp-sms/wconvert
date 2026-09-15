import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { DestinationSettingsForm } from './DestinationSettingsForm';
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
 * A MODAL, BY ADR 0042 RULE 7'S OWN TEST.
 * ============================================================================
 * *"Something that owns the screen until it is answered"* — opened
 * deliberately, answered, closed. The alternative was a Destination created
 * empty and edited in place, which is the shape that produced defect 2 and is
 * what a merchant meets today.
 *
 * **Controlled, and `returnFocusTo` rather than a `DialogTrigger`**, for the
 * reason {@see ConfirmDialog} writes out: a triggerless dialog has nothing to
 * restore focus to, and closing one leaves a keyboard merchant on `<body>` at
 * the top of the document. The caller retains the Add button across both
 * steps, so closing either step returns to the same stable trigger.
 *
 * It stays open on a failed save and closes on one that worked, because the
 * merchant's typed name is in it — dropping the dialog on a 500 would make
 * them type it again to find out whether the second attempt fails too.
 */
export function AddDestinationDialog({
  type,
  choosing = false,
  children,
  connections,
  busy,
  error,
  returnFocusTo,
  onOpenChange,
  onConfirm,
}: {
  /** The selected service, or null while choosing or closed. */
  type: DestinationType | null;
  choosing?: boolean;
  children?: ReactNode;
  /** Every Connection on the site — this filters to the type's own. */
  connections: readonly Connection[];
  busy: boolean;
  /** What the last attempt to create this failed with. */
  error: string | null;
  returnFocusTo: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onConfirm: (draft: {
    label: string;
    connection: string | null;
    settings: Record<string, unknown>;
  }) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Selecting a service replaces the focused chooser button inside the
    // same dialog. Move into the new form rather than leaving focus on body.
    if (type !== null) content.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [type]);
  return (
    <Dialog open={choosing || type !== null} onOpenChange={onOpenChange}>
      <DialogContent
        ref={content}
        className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const node = returnFocusTo.current;

          if (node !== null && node !== undefined) {
            event.preventDefault();
            node.focus();
          }
        }}
      >
        <DialogHeader>
          <p className="m-0 text-note text-muted-foreground">{type === null
            ? __('Step 1 of 2 · Choose a service', 'wconvert')
            : __('Step 2 of 2 · Set up destination', 'wconvert')}</p>
          <DialogTitle>
            {type === null
              ? __('Add a destination', 'wconvert')
              : sprintf(
                  /* translators: %s: a destination type, e.g. “MailPoet”. */
                  __('Add a %s destination', 'wconvert'),
                  type.label,
                )}
          </DialogTitle>
          {/*
            **The one sentence, and it is the one that explains the model**
            (ADR 0042 rule 2). A merchant who does not know they may add a
            second MailPoet route will not go looking for the button that is
            now enabled — and *"how do I send this Optin to a specific list?"*
            is the question this whole screen failed to answer.
          */}
          <DialogDescription>
            {type === null
              ? __('Choose a service to send submissions to. Next, you’ll give this destination a name and choose its settings.', 'wconvert')
              : __('Give this destination a name and choose where submissions should go. You’ll select it in a campaign afterward.', 'wconvert')}
          </DialogDescription>
        </DialogHeader>

        {/*
          Keyed by the type, so opening MailPoet after WP SMS seeds a fresh
          draft rather than editing the last one's. The body is unmounted with
          the dialog anyway; the key is what covers a caller that swaps the
          type without closing.
        */}
        {type === null ? children : (
          <DestinationSettingsForm
            key={type.id}
            type={type}
            connections={connections.filter((connection) => connection.type === type.id)}
            busy={busy}
            error={error}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

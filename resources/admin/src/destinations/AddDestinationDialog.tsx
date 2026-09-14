import type { RefObject } from 'react';
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
 * the top of the document. The trigger is one row in a list of types, so the
 * caller names it.
 *
 * It stays open on a failed save and closes on one that worked, because the
 * merchant's typed name is in it — dropping the dialog on a 500 would make
 * them type it again to find out whether the second attempt fails too.
 */
export function AddDestinationDialog({
  type,
  connections,
  busy,
  error,
  returnFocusTo,
  onOpenChange,
  onConfirm,
}: {
  /** The type being added, or null while this is closed. */
  type: DestinationType | null;
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
  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const node = returnFocusTo.current;

          if (node !== null && node !== undefined) {
            event.preventDefault();
            node.focus();
          }
        }}
      >
        <DialogHeader>
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
            {__(
              'One destination is one route. Add as many as you have audiences, and bind each campaign to the one it feeds.',
              'wconvert',
            )}
          </DialogDescription>
        </DialogHeader>

        {/*
          Keyed by the type, so opening MailPoet after WP SMS seeds a fresh
          draft rather than editing the last one's. The body is unmounted with
          the dialog anyway; the key is what covers a caller that swaps the
          type without closing.
        */}
        {type !== null && (
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

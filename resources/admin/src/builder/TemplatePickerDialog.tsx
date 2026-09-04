import { __ } from '@wordpress/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { TemplatePicker, type TemplatePickerProps } from './TemplatePicker';

/**
 * The picker, on the surface it owns.
 *
 * ============================================================================
 * A MODAL IS FOR SOMETHING THAT OWNS THE SCREEN UNTIL IT IS ANSWERED.
 * ============================================================================
 * That is ADR 0042 rule 7's test, and picking a design passes it exactly:
 * opened deliberately, answered, closed. (Rule 7's complaint is about
 * `DropdownMenu` defaulting to `modal` — a menu that locks the page it is a
 * shortcut into — and not about dialogs, which is what this is.)
 *
 * It is also the only shape that gives the grid the width it needs. The Design
 * tab is one pane beside a pinned preview, so a gallery there is a column of
 * cards at ~600px; the builder caps at 1440 and ADR 0038's answer to a wider
 * screen is another pane or more air, never a longer line. A dialog at that cap
 * is the pane.
 *
 * **The builder is desktop-only below 782px** and says so through
 * `NarrowScreenNotice`, so this inherits that floor and needs no narrow layout
 * of its own. The creation flow is NOT the builder — its step has full width
 * and no pinned preview — so step 2 renders {@see TemplatePicker} inline and
 * has to work to 360px.
 *
 * ============================================================================
 * IT HAS NO ERROR STATE, AND THAT IS A FINDING RATHER THAN AN OMISSION.
 * ============================================================================
 * Three things can fail behind this dialog and none of them belongs here.
 *
 * The INDEX is fetched before the builder renders at all, so a failure there is
 * `BuilderSkeleton`'s and the merchant never reaches a picker. A TREE that does
 * not arrive leaves one card with its skeleton and is retried by the next look
 * — announcing it would be an error banner on a picker that is otherwise
 * working, which ADR 0042 rule 2 forbids. And the SAVE a merchant starts by
 * pressing *Use this design* is a failure of the Optin rather than of the
 * gallery: it lands in the builder's own `RegionError`, above the tab, beside
 * the design that is still the one in use (ADR 0039).
 */

export interface TemplatePickerDialogProps extends TemplatePickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function TemplatePickerDialog({ open, onOpenChange, ...picker }: TemplatePickerDialogProps) {
  /*
    **Whether a switch is even available from here**, which is what decides
    whether the sentence below is worth its line (ADR 0042 rule 2). Asked of the
    whole set for this [[Display Type]] rather than of the narrowed one, so
    filtering the other act off screen does not quietly retract a warning that
    is still true of the library the merchant is browsing.
  */
  const canChangeTheAct = picker.index.templates.some(
    (entry) =>
      entry.display_type === picker.displayType &&
      entry.availability === 'ready' &&
      entry.facets.act !== null &&
      entry.facets.act !== picker.fit.act,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        `max-w-[80rem]` rather than the vendored `sm:max-w-lg`, which is 32rem —
        a two-card grid on a 1440px screen. The dialog is capped where the
        builder is capped, and `max-h` plus the body's own scroll is what keeps
        a library of forty from pushing its own header off the top.
      */}
      <DialogContent className="wconvert-picker max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-[80rem]">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>{__('Browse designs', 'wconvert')}</DialogTitle>
          {/*
            **The one sentence this screen does say, and it is here because it
            is the sharp edge** (ADR 0042 rule 2). Picking a design carries the
            merchant's words across by [[Slot Role]] and carries their image and
            button destination across as their own — but blocks they ADDED,
            MOVED or DELETED are lost, and that is destructive.

            ADR 0039 says a destructive action confirms; the structure editor's
            amendment says undo buys the exception, and picking a design is
            already one undo entry. So there is no dialog in front of the
            dialog — the affordance states what it takes, exactly as the block
            delete states *"Delete, and the 2 inside it"*.
          */}
          <DialogDescription>
            {__(
              'Your words come with you. Blocks you added, moved or deleted do not — Undo brings them back.',
              'wconvert',
            )}
            {/*
              ==========================================================
              AND THE SECOND SHARP EDGE, WHICH DID NOT EXIST BEFORE.
              ==========================================================
              A design that converts the other way used to be REFUSED
              (ADR 0025), so switching one for the other was not a thing
              a merchant could do. It is now (ADR 0059), and it
              reinterprets the Optin's whole history: `wconvert_stats`
              carries no act, so a [[Conversion]] is read against the
              design the Optin holds now, and a hundred form submissions
              become a hundred click-throughs the moment the design does
              (ADR 0020).

              The COUNT stays right — a Conversion happened either way —
              which is why this is a sentence and not a refusal. ADR 0042
              rule 3: marked before the click, with the reason.

              **Only where such a design is actually on offer here.** On a
              library where everything for this Display Type converts the
              same way, this would be a line that taxes every visit and
              informs none.
            */}
            {canChangeTheAct && (
              <>
                {' '}
                {__(
                  'A design that converts the other way changes what this Optin counts — including everything it has already counted.',
                  'wconvert',
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="wconvert-picker__scroll">
          <TemplatePicker {...picker} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

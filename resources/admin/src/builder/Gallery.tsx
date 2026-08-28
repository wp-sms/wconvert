import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Description } from '../shell/Description';
import { Preview } from './Preview';
import { convertingActOf } from './structure/guards';
import type { ConvertingAct } from './structure/catalogue';
import type { TemplateEntry } from '../templates/api';

/**
 * The gallery: a set of designs per [[Display Type]].
 *
 * ============================================================================
 * TEMPLATES ARE GOAL-AGNOSTIC, WHICH IS WHY THIS LIST IS SHORT.
 * ============================================================================
 * A Template is the design of an Optin **with no words in it** — copy comes
 * from the [[Playbook]] that prefilled it, or from the merchant (CONTEXT.md,
 * Template). With the copy held elsewhere the library is a set of designs per
 * Display Type rather than a design for every pairing of Display Type and
 * [[Goal]], which is the matrix this boundary exists to collapse.
 *
 * So there is no Goal filter here, and adding one would be asserting a pairing
 * that does not exist.
 *
 * **Picking a design saves immediately.** It is the one edit that is not a
 * value in a field: it takes a fresh SNAPSHOT of the design, carrying the
 * merchant's words across by [[Slot Role]], and the snapshot boundary is the
 * server's (ADR 0010). Taking it at the moment of the click is what lets the
 * panel underneath show the design that was actually stored rather than a
 * guess at what the save will produce.
 *
 * ============================================================================
 * A DESIGN THE SAVE WILL REFUSE IS NOT OFFERED. IT IS MARKED, WITH THE REASON.
 * ============================================================================
 * **This gallery offered a choice the model forbids.** A design converting on a
 * click cannot serve a [[Goal]] that counts submissions — `OptinController`
 * refuses that pairing outright (ADR 0025) — so a merchant pressed *Use this
 * design*, waited, and got a red bar telling them to "pick a design that
 * matches the Goal, **or change the Goal**". There is no control on this screen
 * that changes the Goal. An error naming a door that is not on the screen is an
 * error the merchant cannot act on, which is the same dead end
 * {@see EmptyState} refuses for an empty region.
 *
 * The admin already has a doctrine for an option that cannot be taken:
 * {@see renderingFor} marks a [[Destination]] and a Goal *before* the click,
 * with the reason, rather than accepting and then refusing. This is that
 * doctrine applied one surface over. `convertingActOf` is the same reading
 * `problemsIn` and the server both take, so the three cannot disagree about
 * which designs match.
 *
 * **Marked and not hidden.** A merchant comparing three designs and finding two
 * has no way to know the third exists or why it is gone — and the reason is
 * about their Goal rather than about the install, so it is worth reading. That
 * is `explain` in the same vocabulary, and it is what a settings list does with
 * an absence for exactly this reason.
 */

export interface GalleryProps {
  readonly templates: readonly TemplateEntry[];
  readonly displayType: string;
  readonly chosen: string | undefined;
  /**
   * What this Optin's [[Goal]] counts, which is what a design has to produce.
   *
   * The Goal is chosen at creation and this screen cannot change it, so this is
   * a constraint on the gallery rather than a filter the merchant set.
   */
  readonly act: ConvertingAct;
  readonly busy: boolean;
  readonly onChoose: (id: string) => void;
}

/**
 * Can this design serve the Goal, and if not, why not — in the merchant's
 * words.
 *
 * `null` where it can. The two failures are different and are worth telling
 * apart: a design offering the WRONG act is a design built for a different job,
 * and one offering NOTHING renders, publishes and reports zero forever
 * (ADR 0020) — which looks like a working Optin, which is why it is the worse
 * of the two.
 */
function refusalFor(template: TemplateEntry, act: ConvertingAct): string | null {
  const offered = convertingActOf(template.tree);

  if (offered.length === 0) {
    return __('Nothing on this design counts as a conversion.', 'wconvert');
  }

  if (offered.length === 1 && offered[0] === act) {
    return null;
  }

  return act === 'submit'
    ? __('Converts on a click. Your goal counts form submissions.', 'wconvert')
    : __('Converts on a form submission. Your goal counts click-throughs.', 'wconvert');
}

export function Gallery({ templates, displayType, chosen, act, busy, onChoose }: GalleryProps) {
  // One Template serves exactly one Display Type (CONTEXT.md, Template), so
  // this is a filter over a property of the entry rather than a question the
  // merchant is asked twice.
  const shown = templates.filter((template) => template.display_type === displayType);

  if (shown.length === 0) {
    return (
      <p className="m-0 text-muted-foreground">
        {/* translators: %s: a Display Type, e.g. "popup". */}
        {sprintf(__('No designs for “%s” on this site.', 'wconvert'), displayType)}
      </p>
    );
  }

  return (
    <ul className="wconvert-gallery">
      {shown.map((template) => {
        const inUse = template.id === chosen;
        const refused = refusalFor(template, act);

        return (
          <li
            key={template.id}
            /*
              **`aria-current` is what says "this one" to a screen reader.** It
              was said by a `Badge` and by a border colour, neither of which is
              in the accessibility tree as a state — so the chosen card was
              chosen only if you could see it.
            */
            aria-current={inUse ? 'true' : undefined}
            data-refused={refused !== null ? 'true' : undefined}
            className={`wconvert-gallery__card${inUse ? ' is-chosen' : ''}`}
          >
            {/*
              The real design at real width, scaled down rather than reflowed:
              reflowing would show the merchant a layout no visitor gets, which
              is the one thing a live-rendered gallery exists to avoid.
            */}
            <Preview template={template} />

            {/*
              **The name is on its own line and the action under it**, which is
              the only arrangement that is the same on every card. Side by side,
              a name one word longer either wrapped the button onto a second
              line — leaving that card taller than the one beside it — or, once
              wrapping was off, truncated a name as short as "Stacked signup".
              A gallery is read by comparing designs, and cards that are not the
              same shape compare badly.

              `aria-describedby` is what tells three identically labelled "Use
              this design" buttons apart in the accessibility tree, without
              putting the design's name on every button face.

              **And the comment above was not true until now.** The chosen card
              rendered a `Badge` where every other rendered a `Button` — 22px
              against 32px — so it was ~10px shorter than its neighbours, which
              is exactly the ragged row this layout is described as preventing.
              It is always a `Button size="sm"`; the state is carried by
              `variant`, `disabled` and the `aria-current` on the card, none of
              which changes the box.
            */}
            <div className="flex flex-col items-start gap-2 border-t border-border px-3 py-2.5">
              <span id={`wconvert-design-${template.id}`} className="font-medium text-foreground">
                {template.name}
              </span>
              {/*
                **The reason sits with the control it disables**, not in a bar
                that appears after the click. It is `aria-describedby` as well
                as visible, so the button announces why it cannot be pressed
                rather than announcing only that it cannot.
              */}
              {refused !== null && (
                <Description id={`wconvert-refused-${template.id}`}>{refused}</Description>
              )}
              <Button
                variant={inUse ? 'secondary' : 'outline'}
                size="sm"
                aria-describedby={
                  refused !== null
                    ? `wconvert-design-${template.id} wconvert-refused-${template.id}`
                    : `wconvert-design-${template.id}`
                }
                disabled={busy || inUse || refused !== null}
                onClick={inUse || refused !== null ? undefined : () => onChoose(template.id)}
              >
                {inUse ? __('In use', 'wconvert') : __('Use this design', 'wconvert')}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

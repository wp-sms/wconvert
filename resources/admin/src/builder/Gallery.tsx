import { __, sprintf } from '@wordpress/i18n';
import { ExternalLink, Lock } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useShownAfterDelay } from '../shell/skeletonDelay';
import { renderingFor, tierName } from '../goals/availability';
import { TemplateCard } from './TemplateCard';
import { nameOf, type TemplateIndexEntry, type TemplateLabelsWithFacets } from '../templates/api';
import type { ConvertingAct } from './structure/catalogue';
import type { Template } from '@renderer/types';

/** Design grid. Goal fit is suggested by derived facets, never authored tags.
 * All designs remain browsable; publication checks the edited Outcome contract.
 * Bound destinations and A/B siblings still constrain draft replacement.
 */

export interface GalleryProps {
  /** The narrowed set, in index order — this component does no filtering. */
  readonly entries: readonly TemplateIndexEntry[];
  /** The designs that have arrived, keyed by id. */
  readonly trees: ReadonlyMap<string, Template>;
  readonly labels: TemplateLabelsWithFacets;
  readonly chosen: string | undefined;
  /** What this particular Optin needs of a design — see {@link Fit}. */
  readonly fit: Fit;
  readonly busy: boolean;
  readonly onChoose: (id: string) => void;
  readonly onNear: (id: string) => void;
  /** Inspect before applying; omitted by callers whose cards still choose directly. */
  readonly onPreview?: (id: string) => void;
  readonly failed?: ReadonlySet<string>;
  readonly onRetry?: (id: string) => void;
}

/** Constraints and publication guidance for this edited Optin. */
export interface Fit {
  readonly outcome?: import('../goals/outcome').OutcomeContract;
  /** Whether this Optin binds [[Destination]]s, which need a [[Lead]] to send. */
  readonly bound: boolean;
  /**
   * What the other arms of this A/B test convert on, or null where this Optin
   * is not part of one.
   *
   * **The guarantee the shared Goal used to smuggle in** (ADR 0059): two arms
   * shared an act because they shared a Goal and the Goal declared one. An arm
   * holding a form beside an arm holding a click CTA would put a ~3%
   * submission rate against a ~25% click rate and call one of them the winner.
   */
  readonly sibling: ConvertingAct | null;
  /**
   * What this Optin converts on today, read off the design it holds.
   *
   * It refuses nothing. It is what lets the picker say, before the click, that
   * a switch changes what this Optin counts — including what it has already
   * counted.
   */
  readonly act: ConvertingAct;
}

/**
 * Why this design cannot be used on this Optin, in the merchant's words.
 *
 * `null` where it can, and null on a locked card: one that is not offered is
 * never refused, and a sentence about a design the merchant cannot have would
 * be a sentence about nothing.
 *
 * **Worst first**, because a card shows one reason. A design that counts
 * nothing renders, publishes and reports zero forever (ADR 0020) — which looks
 * like a working Optin, and is the worst of the four. The two capture failures
 * come next; the arm one last, because it is the only one that is not about
 * this Optin on its own.
 */
export function refusalFor(entry: TemplateIndexEntry, fit: Fit): string | null {
  if (entry.availability !== 'ready') {
    return null;
  }

  const offered = entry.facets.act;

  if (offered === null) {
    return __('Nothing on this design counts as a conversion.', 'wconvert');
  }

  if (entry.facets.captures.length === 0) {
    if (fit.bound) {
      return __(
        'This design captures nothing, so there would be no leads to send to this Campaign’s destinations.',
        'wconvert',
      );
    }
  }

  if (fit.sibling !== null && offered !== fit.sibling) {
    return fit.sibling === 'submit'
      ? __(
          'Converts on a click, and the other arm of this test converts on a form submission.',
          'wconvert',
        )
      : __(
          'Converts on a form submission, and the other arm of this test converts on a click.',
          'wconvert',
        );
  }

  return null;
}

/**
 * What taking THIS design would change about what the Optin counts, or null.
 *
 * ============================================================================
 * A NOTE BESIDE THE APPLY ACTION, NOT ABOVE THE WHOLE LIBRARY.
 * ============================================================================
 * **Not a refusal, and it disables nothing.** Switching is allowed and is the
 * whole point of the change; what it does is reinterpret the Optin's history,
 * because `wconvert_stats` carries no act and a [[Conversion]] is read against
 * the design the Optin holds NOW (ADR 0020). A hundred form submissions on an
 * Optin switched to a click design read as a hundred click-throughs.
 *
 * That was impossible before, because the swap was refused outright. It is now
 * something a merchant does casually, so it is said before the apply click
 * (ADR 0042 rule 3). The preview-first library puts it in the design detail;
 * a direct-choice caller keeps it on the card that applies it. It shipped for a
 * day as one clause appended to the dialog's header, which was wrong three
 * ways: it showed before anything was picked, it stayed up while the merchant
 * hovered a design that changes nothing, and it could not say which direction
 * because it was not about any particular card.
 *
 * It is distinct from a refusal: a reason dims the render and says the design
 * cannot be applied. A change in what it counts still permits the switch.
 */
export function actChangeOf(entry: TemplateIndexEntry, fit: Fit): string | null {
  if (fit.outcome && (entry.facets.act !== fit.outcome.action || (fit.outcome.capture_any_of.length > 0
    && !fit.outcome.capture_any_of.some((field) => entry.facets.captures.includes(field))))) {
    return fit.outcome.requirement;
  }
  if (fit.outcome) return null;
  if (entry.availability !== 'ready' || entry.facets.act === null || entry.facets.act === fit.act) {
    return null;
  }

  return entry.facets.act === 'click'
    ? __(
        'Counts click-throughs instead of submissions — including everything this Campaign has already counted.',
        'wconvert',
      )
    : __(
        'Counts submissions instead of click-throughs — including everything this Campaign has already counted.',
        'wconvert',
      );
}

/**
 * What a locked design IS, since there is no render of it to look at.
 *
 * The facets in the merchant's own words, in the order the manifest offers
 * them, so a locked card can be compared against the real ones beside it on the
 * same three questions. A facet the design does not answer contributes nothing
 * rather than an "n/a" chip.
 */
function marksFor(entry: TemplateIndexEntry, labels: TemplateLabelsWithFacets): string[] {
  const words = [];

  if (entry.facets.shape !== null) {
    words.push(nameOf(labels.facetValues, `shape.${entry.facets.shape}`));
  }

  for (const captures of entry.facets.captures) {
    words.push(nameOf(labels.facetValues, `captures.${captures}`));
  }

  if (entry.facets.has_image) {
    words.push(nameOf(labels.facetValues, 'has_image.true'));
  }

  return words;
}

export function Gallery({
  entries,
  trees,
  labels,
  chosen,
  fit,
  busy,
  onChoose,
  onNear,
  onPreview,
  failed,
  onRetry,
}: GalleryProps) {
  return (
    <ul className="wconvert-gallery" data-preview-first={onPreview !== undefined || undefined}>
      {entries.map((entry) => {
        const locked = renderingFor(entry.availability, 'settings_list') === 'upsell';
        const inUse = entry.id === chosen;
        const refused = refusalFor(entry, fit);
        /*
          **Only where the card can actually be taken.** A refused card already
          says the one thing that matters about it, and a design this install
          does not have is not one anybody is switching to — two sentences
          about one card is what ADR 0042 rule 2 forbids.
        */
        const changes = locked || refused !== null ? null : actChangeOf(entry, fit);
        const fields = entry.facets.captures.map((field) =>
          labels.fields?.[field] ?? nameOf(labels.facetValues, `captures.${field}`),
        );
        const summary = fields.length > 0
          ? sprintf(
              /* translators: %s: field names, such as Email address and Phone number. */
              __('Collects %s', 'wconvert'), fields.join(', '),
            )
          : entry.facets.act === 'click'
            ? __('Follows a link', 'wconvert')
            : __('No form fields', 'wconvert');

        return (
          <TemplateCard
            displayType={entry.display_type}
            key={entry.id}
            id={entry.id}
            name={entry.name}
            template={trees.get(entry.id)}
            current={inUse}
            reason={refused}
            // Browse cards describe their fields; the detail explains the
            // effect of applying one. Direct-choice callers keep that warning
            // here, immediately beside their apply action.
            notes={onPreview !== undefined && !locked ? summary : changes ?? undefined}
            onNear={locked ? undefined : onNear}
            loadError={!locked && failed?.has(entry.id)}
            onRetry={onRetry === undefined ? undefined : () => onRetry(entry.id)}
            /*
              **Grey and a lock, never amber** (ADR 0037). Amber is the
              reserved meaning that the SITE is holding something back, and
              spending it on a PRICE made it mean two opposite things on two
              screens. `StartingPoints` states the rule and already draws it
              this way.
            */
            marks={
              locked ? (
                <Badge variant="secondary">
                  <Lock aria-hidden="true" />
                  {tierName(entry.tier)}
                </Badge>
              ) : undefined
            }
            absent={
              locked ? (
                <ul className="wconvert-facets">
                  {marksFor(entry, labels).map((word) => (
                    <li key={word}>{word}</li>
                  ))}
                </ul>
              ) : undefined
            }
            action={(describedBy) =>
              locked && !entry.preview_url ? (
                <span className="text-sm text-muted-foreground">{__('Included in Pro', 'wconvert')}</span>
              ) : locked ? (
                /*
                  **A link, never a `disabled` button.** The design is not on
                  this install to be used, so an "unavailable" control would be
                  a control for something that is not there — which is the
                  trialware shape issue #7 names and the one Guideline 9 fires
                  on. What a merchant can do from here is look at it, so that is
                  the affordance.

                  `rel="noreferrer"` alongside `noopener` because this leaves
                  wp-admin, and `target="_blank"` because it leaves a screen the
                  merchant is in the middle of using.
                */
                <Button asChild variant="outline" size="sm">
                  <a
                    href={entry.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-describedby={describedBy}
                  >
                    {__('See this design', 'wconvert')}
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              ) : onPreview !== undefined ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-describedby={describedBy}
                  disabled={busy}
                  onClick={() => onPreview(entry.id)}
                >
                  {__('Preview design', 'wconvert')}
                </Button>
              ) : (
                /*
                  **`busy` takes the real attribute and the other two do not.**
                  A save in flight is transient and wants the control out of
                  the way; *in use* and a refusal are states of this install
                  that the merchant may want to read, and a real `disabled`
                  would put the reason beside them out of the focus order.
                */
                <Button
                  variant={inUse ? 'secondary' : 'outline'}
                  size="sm"
                  aria-describedby={describedBy}
                  disabled={busy}
                  aria-disabled={inUse || refused !== null}
                  onClick={inUse || refused !== null ? undefined : () => onChoose(entry.id)}
                >
                  {inUse ? __('In use', 'wconvert') : __('Use this design', 'wconvert')}
                </Button>
              )
            }
          />
        );
      })}
    </ul>
  );
}

/**
 * The grid's own shape, while the index is still arriving.
 *
 * **Loading is not empty** (ADR 0039). The pair mirrors `ChoiceGrid` and
 * `ChoiceSkeleton` one surface over: a shape, and a placeholder built to that
 * shape so the screen does not jump when the data lands — and, more
 * importantly, so a picker that has not answered yet never says *"No designs
 * match"*, which is a false statement about the merchant's library at the exact
 * moment they are deciding whether this product has anything for them.
 */
export function GallerySkeleton({ cards = 6 }: { cards?: number }) {
  /*
    **It delays**, for {@see ChoiceSkeleton}'s reason: the creation flow's step
    two is re-entered whenever the merchant picks a different [[Goal]], so this
    can replace a grid that was already full.
  */
  if (!useShownAfterDelay()) {
    return null;
  }

  return (
    <>
      {/*
        **The announcement is the component's, not the call site's.** It had
        none at all and neither did two of its three callers, so a merchant on
        a screen reader met a silent wait. `aria-hidden` on the grid below is
        what makes one `role="status"` the right number: six placeholder cards
        have nothing to say and the word "Loading" has everything.
      */}
      <span role="status" className="sr-only">
        {__('Loading…', 'wconvert')}
      </span>

      <ul className="wconvert-gallery" aria-hidden="true">
      {Array.from({ length: cards }, (_each, index) => (
        <li key={index} className="wconvert-gallery__card">
          <div className="wconvert-gallery__waiting">
            <Skeleton className="size-full" />
          </div>
          <div className="flex flex-col items-start gap-2 border-t border-border px-3 py-2.5">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-8 w-28" />
          </div>
        </li>
      ))}
      </ul>
    </>
  );
}

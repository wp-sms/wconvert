import { __ } from '@wordpress/i18n';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { renderingFor, tierName } from '../goals/availability';
import { TemplateCard } from './TemplateCard';
import { nameOf, type TemplateIndexEntry, type TemplateLabelsWithFacets } from '../templates/api';
import type { ConvertingAct } from './structure/catalogue';
import type { Template } from '@renderer/types';

/**
 * The grid of designs — the picker's contents, and nothing else.
 *
 * ============================================================================
 * TEMPLATES ARE GOAL-AGNOSTIC, AND THAT IS WHY THE FACETS ARE WHAT THEY ARE.
 * ============================================================================
 * A Template is the design of an Optin **with no words in it** — copy comes
 * from the [[Playbook]] that prefilled it, or from the merchant (CONTEXT.md,
 * Template). With the copy held elsewhere the library is a set of designs per
 * [[Display Type]] rather than a design for every pairing of Display Type and
 * [[Goal]], which is the matrix that boundary exists to collapse.
 *
 * **So there is no Goal filter, and there never will be.** Every facet the
 * toolbar offers is derived from the tree — what it captures, how it is
 * arranged, whether it has a picture — because those are the questions a design
 * with no words in it can actually answer. A Goal chip, or an Industry one,
 * would be asserting a pairing that does not exist (ADR 0043).
 *
 * ============================================================================
 * THE ACT REFUSES NOTHING NOW, AND THAT IS MOST OF THIS FILE'S HISTORY GONE.
 * ============================================================================
 * This greyed out **five of seven popup designs** on an Optin whose Goal
 * counted click-throughs, each saying *"Converts on a form submission. Your
 * goal counts click-throughs."* — naming no goal and offering no way to change
 * one. It was marking a refusal the server really made, and the server made it
 * because a Goal declared a converting act as well as the design did.
 *
 * **It does not any more** (ADR 0059). The act belongs to the design, so under
 * four of the five Goals nothing on a standalone Optin is greyed at all, and
 * the picker is what it always claimed to be: designs for one [[Display
 * Type]], compared on what they look like.
 *
 * ============================================================================
 * WHAT IS STILL MARKED, AND EVERY ONE OF IT IS ABOUT SOMETHING REAL.
 * ============================================================================
 * Four, and the save refuses all four — this is the near side of that net,
 * never a replacement for it (ADR 0026):
 *
 * - **A design that counts nothing.** It renders, publishes and reports zero
 *   forever (ADR 0020), which looks like a working Optin.
 * - **A design that captures nothing, under a Goal read from deliveries.**
 *   There is no address to deliver to.
 * - **A design that captures nothing, on an Optin that binds a
 *   [[Destination]].** There would be no [[Lead]] to send.
 * - **A design converting the other way from an A/B sibling's.** The two rates
 *   would not be comparable (ADR 0045).
 *
 * The reading still comes from the index: `act` and `captures` are facets the
 * server derived at registration, from the same walks the save consults, so
 * the two cannot disagree — and the card does not need its tree to say so.
 *
 * **Marked and not hidden.** A merchant comparing designs and finding one gone
 * has no way to know it existed or why — and the reason is about their own
 * Optin rather than about the install, so it is worth reading.
 *
 * ============================================================================
 * A LOCKED CARD IS A LINK. IT IS NEVER A DISABLED BUTTON.
 * ============================================================================
 * Free ships the CARD for a premium design and never the design: shipping the
 * tree and refusing the save is trialware (issue #7), and rendering a real
 * control `disabled` is what wp.org Guideline 9 fires on. So a locked card
 * carries its facets, a `Pro` badge, and *"See this design"* pointing at a live
 * preview on wconvert.com — an admin-side link to your own site, which
 * Guideline 10 explicitly welcomes.
 *
 * A Pro install sees none of them, and not because of a test here:
 * `availability` resolves on the server, and Pro registering the real design
 * takes the stub's id (ADR 0026, ADR 0043). A paying customer is never shown an
 * advertisement for what they bought.
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
}

/**
 * What THIS Optin needs of a design — the whole of what can refuse one, and
 * the whole of what can warn about one.
 *
 * ============================================================================
 * ONE OBJECT RATHER THAN FOUR PROPS THREADED THROUGH THREE COMPONENTS.
 * ============================================================================
 * It replaces the single `act` the picker used to take. That prop was the
 * Optin's [[Goal]] wearing a design's vocabulary — the Goal declared an act,
 * and the gallery refused every design offering the other one — and with the
 * act off the Goal there is no such constraint left. What is left is smaller,
 * plural, and about the OPTIN rather than about its Goal alone, which is
 * exactly the shape one value could not carry.
 *
 * Nothing in here is a filter. Every field marks a card and leaves it on
 * screen, because a merchant comparing designs and finding one gone has no way
 * to know it existed (ADR 0043).
 */
export interface Fit {
  /**
   * This Optin's Goal reads its headline from deliveries, so a design with no
   * field on it has no address to deliver to.
   *
   * Resolved on the server and travelling as `needs_a_capture`, never derived
   * from a Goal id here: this bundle names none, and `GoalParityTest` fails
   * the day one appears — comments included.
   */
  readonly needsACapture: boolean;
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
    if (fit.needsACapture) {
      return __('This design captures nothing, and your goal counts deliveries.', 'wconvert');
    }

    if (fit.bound) {
      return __(
        'This design captures nothing, so there would be no leads to send to this Optin’s destinations.',
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
 * Would taking this design change what the Optin counts?
 *
 * **Not a refusal, and it disables nothing.** Switching is allowed and is the
 * whole point of the change; what it does is reinterpret the Optin's history,
 * because `wconvert_stats` carries no act and a [[Conversion]] is read against
 * the design the Optin holds NOW (ADR 0020). A hundred form submissions on an
 * Optin switched to a click design read as a hundred click-throughs.
 *
 * That was impossible before, because the swap was refused outright. It is now
 * something a merchant does casually, so it is said before the click
 * (ADR 0042 rule 3).
 */
export const changesTheAct = (entry: TemplateIndexEntry, fit: Fit): boolean =>
  entry.availability === 'ready' && entry.facets.act !== null && entry.facets.act !== fit.act;

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
}: GalleryProps) {
  return (
    <ul className="wconvert-gallery">
      {entries.map((entry) => {
        const locked = renderingFor(entry.availability, 'settings_list') === 'upsell';
        const inUse = entry.id === chosen;
        const refused = refusalFor(entry, fit);

        return (
          <TemplateCard
            key={entry.id}
            id={entry.id}
            name={entry.name}
            template={trees.get(entry.id)}
            current={inUse}
            reason={refused}
            onNear={locked ? undefined : onNear}
            marks={locked ? <Badge variant="warning">{tierName(entry.tier)}</Badge> : undefined}
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
              locked ? (
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
              ) : (
                <Button
                  variant={inUse ? 'secondary' : 'outline'}
                  size="sm"
                  aria-describedby={describedBy}
                  disabled={busy || inUse || refused !== null}
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
  return (
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
  );
}

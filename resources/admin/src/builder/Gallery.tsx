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
 * A DESIGN THE SAVE WILL REFUSE IS MARKED, WITH THE REASON. IT IS NOT HIDDEN.
 * ============================================================================
 * A design converting on a click cannot serve a Goal that counts submissions —
 * `OptinController` refuses that pairing outright (ADR 0025) — so a merchant
 * pressed *Use this design*, waited, and got a red bar telling them to "pick a
 * design that matches the Goal, **or change the Goal**", with no control on
 * this screen that changes a Goal.
 *
 * The admin already had the doctrine: {@see renderingFor} marks an option that
 * cannot be taken *before* the click, with the reason. This is that, one surface
 * over. What changed with the index/tree split is where the reading comes from:
 * the act is a facet the server derived at registration, from the same
 * `ConvertingAct::offeredIn()` the save consults, so the two cannot disagree
 * about which designs match — and the card does not need its tree to say so.
 *
 * **Marked and not hidden.** A merchant comparing designs and finding one gone
 * has no way to know it existed or why — and the reason is about their Goal
 * rather than about the install, so it is worth reading.
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
  /**
   * What this Optin's [[Goal]] counts, which is what a design has to produce.
   *
   * The Goal is chosen at creation and this screen cannot change it, so it is a
   * constraint on the gallery rather than a filter the merchant set.
   */
  readonly act: ConvertingAct;
  readonly busy: boolean;
  readonly onChoose: (id: string) => void;
  readonly onNear: (id: string) => void;
}

/**
 * Can this design serve the Goal, and if not, why not — in the merchant's
 * words.
 *
 * `null` where it can, and null on a locked card: one that is not offered is
 * never refused, and a second sentence about a Goal it cannot serve would be a
 * sentence about a design the merchant cannot have.
 *
 * The two failures are different and worth telling apart. A design offering the
 * WRONG act is built for a different job; one offering NOTHING renders,
 * publishes and reports zero forever (ADR 0020) — which looks like a working
 * Optin, which is why it is the worse of the two.
 */
export function refusalFor(entry: TemplateIndexEntry, act: ConvertingAct): string | null {
  if (entry.availability !== 'ready') {
    return null;
  }

  const offered = entry.facets.act;

  if (offered === null) {
    return __('Nothing on this design counts as a conversion.', 'wconvert');
  }

  if (offered === act) {
    return null;
  }

  return act === 'submit'
    ? __('Converts on a click. Your goal counts form submissions.', 'wconvert')
    : __('Converts on a form submission. Your goal counts click-throughs.', 'wconvert');
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
  act,
  busy,
  onChoose,
  onNear,
}: GalleryProps) {
  return (
    <ul className="wconvert-gallery">
      {entries.map((entry) => {
        const locked = renderingFor(entry.availability, 'settings_list') === 'upsell';
        const inUse = entry.id === chosen;
        const refused = refusalFor(entry, act);

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

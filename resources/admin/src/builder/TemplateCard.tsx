import { useCallback, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Description } from '../shell/Description';
import { DesignStage } from '../stage/DesignStage';
import type { Template } from '@renderer/types';

/**
 * One design on a card: the real render, its name, and one action.
 *
 * ============================================================================
 * TWO SCREENS DRAW THIS, AND THEY ARE DRAWING DIFFERENT OBJECTS.
 * ============================================================================
 * The picker's grid shows a [[Template]] — a design **with no words in it**,
 * whose placeholder text exists only so the gallery has something to show. The
 * creation flow's step 2 shows a [[Playbook]]'s template *with that Playbook's
 * copy bound into it*, which is a different object that happens to render the
 * same way.
 *
 * So what is shared is the CARD and never the facets: a live render at real
 * width, a name under a rule, one action, and an optional sentence saying why
 * the action cannot be taken. Step 2 renders Playbooks and had been drawing
 * them as `ChoiceCard`s — "a heading, a paragraph and a button" — while the
 * product's whole claim is that there are no thumbnails because the real thing
 * is cheap to draw (ADR 0010, #68, #79).
 *
 * ============================================================================
 * THE STAGE DRAWS IT, AND DRAWS IT ONLY NEAR THE VIEWPORT (ADR 0170).
 * ============================================================================
 * The card's picture is a {@see DesignStage} at its card size: the design on a
 * faint page, in its format's slot, 4:3. The stage owns the viewport gate this
 * card used to — one observer deciding both when a tree is worth fetching
 * (`onNear`) and when the render is worth building — and because a stage has
 * a fixed shape, a card no longer changes height when its design leaves the
 * viewport, so there is no height to hold. `content-visibility: auto` in the
 * stylesheet is the other half: it stops a card that exists from being laid out.
 */

export interface TemplateCardProps {
  readonly displayType: string;
  /** Namespaces the ids this card owns, so forty cards do not collide. */
  readonly id: string;
  readonly name: string;
  /**
   * The design, or undefined while its tree is still arriving — which is an
   * ordinary state here rather than a failure, because trees are fetched for
   * what is on screen (ADR 0043).
   */
  readonly template?: Template;
  /** Drawn as the one in use, and said as `aria-current` rather than by colour. */
  readonly current?: boolean;
  /**
   * Why this design cannot be used, in the merchant's words.
   *
   * A REFUSAL, which is why it dims the render and joins the action's
   * description: what it explains is that pressing the button will not work.
   * A sentence that merely describes the card is {@link notes}.
   */
  readonly reason?: string | null;
  /**
   * What this card IS, in one line — a [[Playbook]]'s *"why it works"*.
   *
   * Held apart from {@link reason} because they read the same and mean opposite
   * things: a note is an invitation and a reason is a refusal. Folding them
   * into one prop would have dimmed every Playbook card in the creation flow
   * and told a screen reader that its button could not be pressed.
   */
  readonly notes?: string;
  /** Facet chips, a Pro badge — whatever this surface puts beside the name. */
  readonly marks?: ReactNode;
  readonly saveAction?: ReactNode;
  readonly selection?: ReactNode;
  readonly selected?: boolean;
  /**
   * What stands where the design would be, on a card whose design this install
   * **does not have and will never be sent**.
   *
   * The distinction from a missing `template` is the whole of it: a tree still
   * arriving gets the skeleton, because it is coming. A locked design is not
   * coming — free ships the card and never the design, because shipping the
   * design and refusing the save is trialware (issue #7) — so a skeleton there
   * would be a card that loads forever.
   *
   * It is where the facet chips go, which is the honest substitute: with no
   * render and no picture to look at, *"Side by side · Email · With a
   * picture"* is what a merchant can compare.
   */
  readonly absent?: ReactNode;
  /** The catalogue's picture of a design this site does not have (ADR 0156, ADR 0170). */
  readonly picture?: { readonly '1x': string; readonly '2x'?: string };
  /**
   * The action, handed the id of the element that NAMES this card.
   *
   * Forty buttons reading *Use this design* are forty buttons a screen reader
   * cannot tell apart, and putting the design's name on every button face is
   * the other way to fix that and the worse one — it makes the row of buttons
   * ragged and says the name twice to everybody who can see it (ADR 0038).
   */
  readonly action: (describedBy: string) => ReactNode;
  /** This card is near the viewport and its design is worth fetching. */
  readonly onNear?: (id: string) => void;
  readonly loadError?: boolean;
  readonly onRetry?: () => void;
}

export function TemplateCard({
  displayType,
  id,
  name,
  template,
  current = false,
  reason = null,
  notes,
  marks,
  saveAction,
  selection,
  selected = false,
  absent,
  picture,
  action,
  onNear,
  loadError = false,
  onRetry,
}: TemplateCardProps) {
  // Asked for once the stage is near, and only while the tree is still missing.
  const near = useCallback(() => {
    if (template === undefined) onNear?.(id);
  }, [template, onNear, id]);

  const nameId = `wconvert-design-${id}`;
  const reasonId = `wconvert-refused-${id}`;
  const notesId = `wconvert-design-notes-${id}`;

  return (
    <li
      /*
        **`aria-current` is what says "this one" to a screen reader.** It was
        said by a `Badge` and by a border colour, neither of which is in the
        accessibility tree as a state — so the chosen card was chosen only if
        you could see it.
      */
      aria-current={current ? 'true' : undefined}
      data-compared={selected || undefined}
      data-refused={reason !== null ? 'true' : undefined}
      className={`wconvert-gallery__card${current ? ' is-chosen' : ''}`}
    >
      {/*
        The real design at real width, scaled down rather than reflowed:
        reflowing would show the merchant a layout no visitor gets, which is the
        one thing a live-rendered gallery exists to avoid.
      */}
      {absent !== undefined ? (
        <div className="wconvert-gallery__absent">{absent}</div>
      ) : loadError ? (
        <div className="wconvert-gallery__waiting wconvert-gallery__error">
          <Description>{__('Preview could not be loaded.', 'wconvert')}</Description>
          {/* "Try again", the one retry word, described by this card's name so a list of failures can be told apart. */}
          {onRetry !== undefined && <Button variant="outline" onClick={onRetry} aria-describedby={nameId}>{__('Try again', 'wconvert')}</Button>}
        </div>
      ) : (
        <div className="wconvert-gallery__preview" aria-hidden="true">
          <DesignStage
            displayType={displayType}
            size="card"
            source={picture !== undefined ? { image: picture } : template !== undefined ? { live: { template } } : undefined}
            onNear={near}
          />
        </div>
      )}

      {/*
        **The name is on its own line and the action under it**, which is the
        arrangement that is the same on every comparison card. Side by side, a name
        one word longer either wrapped the button onto a second line — leaving
        that card taller than the one beside it — or, once wrapping was off,
        truncated a name as short as "Stacked signup". A gallery is read by
        comparing designs, and cards that are not the same shape compare badly.
      */}
      <div className="wconvert-gallery__caption">
        <div className="wconvert-gallery__identity">
          <h3 id={nameId}>
            {name}
          </h3>
          {saveAction}
        </div>
        {marks && <div className="wconvert-gallery__marks">{marks}</div>}
        {/*
          **The reason sits with the control it refuses**, not in a bar that
          appears after the click. It is `aria-describedby` as well as visible,
          so the button announces why it cannot be pressed rather than
          announcing only that it cannot.
        */}
        {notes !== undefined && <Description id={notesId}>{notes}</Description>}
        {reason !== null && <Description id={reasonId}>{reason}</Description>}
        <div className="wconvert-gallery__actions wconvert-toolbar">
          {action([nameId, reason !== null ? reasonId : null, notes !== undefined ? notesId : null].filter(Boolean).join(' '))}
          {selection}
        </div>
      </div>
    </li>
  );
}

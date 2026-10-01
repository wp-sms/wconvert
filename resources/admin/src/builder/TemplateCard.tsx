import { useEffect, useRef, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Description } from '../shell/Description';
import { Preview } from './Preview';
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
 * IT MOUNTS WHEN IT IS NEAR THE VIEWPORT, AND UNMOUNTS WHEN IT IS NOT.
 * ============================================================================
 * `Preview` mounts whatever it is handed the moment it is rendered, and that is
 * right for the one preview the builder pins beside its tabs. It is not right
 * for forty cards: forty closed shadow roots, forty stylesheets and forty trees
 * fetched, none of which anybody has scrolled to.
 *
 * So the gate is here, where the element that scrolls actually is, and it is
 * ONE observer doing both halves of the job — it decides when the tree is
 * WORTH FETCHING (`onNear`) and when the render is worth building (by rendering
 * `Preview` at all). Two observers, one per question, would be two answers to
 * "is this card near the viewport" that could disagree.
 *
 * **Unmounting is affordable because the render is a pure function.**
 * `Preview`'s own comment is the argument: `mount()` reads nothing ambient — no
 * network, no layout measurement — so a card that leaves and comes back
 * rebuilds from the same tree and draws the same pixels. There is nothing to
 * lose, because a card is a picture.
 *
 * **What it does cost is the card's HEIGHT, and that has to be given back.**
 * Measured in a browser: an unmounted card stood at 212px where the mounted one
 * had been 348px, so scrolling down pulled every row above it up by 136px — the
 * document shortening under the merchant's thumb, which is the failure
 * virtualization libraries spend most of their code on. So a card that has
 * rendered once keeps the height it measured and holds it while it is away.
 * `contain-intrinsic-size` in the stylesheet is the floor beneath that, for a
 * card that has never rendered at all.
 *
 * **`content-visibility: auto` is the other half, in `index.css`.** The observer
 * stops a card BUILDING; the property stops one that already exists from being
 * laid out. Neither reaches where the pair does — and neither is a
 * virtualization library, which is the third option: the grid is a responsive
 * `auto-fill` and adding a dependency to a bundle whose halves are reported per
 * build (ADR 0038) to arrive at the same place is a bad trade.
 */

/**
 * How far outside the viewport still counts as near.
 *
 * A screen's worth, roughly: far enough that a card is drawn before a merchant
 * scrolls it into view at any ordinary speed, near enough that a library of
 * forty is never all mounted at once.
 */
const NEARBY = '600px';

export interface TemplateCardProps {
  readonly displayType?: string;
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
   * render to look at, *"Side by side · Email · With a picture"* is what a
   * merchant can compare. **Never a thumbnail** — ADR 0010's *no static
   * thumbnails anywhere* is untouched, because a locked card carries no image
   * at all.
   */
  readonly absent?: ReactNode;
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
  action,
  onNear,
  loadError = false,
  onRetry,
}: TemplateCardProps) {
  const card = useRef<HTMLLIElement>(null);
  /*
   * **True where nothing can observe.** jsdom has none of this and neither does
   * a browser old enough to matter; in both cases the honest answer is to draw
   * the card, because a picker that renders nothing is a worse failure than one
   * that renders everything.
   */
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
  /*
   * The height this card stood at while it was rendered, held so leaving the
   * viewport does not shorten the document. A ref rather than state because it
   * is written in the same callback that calls `setNear` and read by the render
   * that call schedules — a second `setState` would be a second render for a
   * value the first one already has.
   */
  const held = useRef<number | null>(null);

  useEffect(() => {
    const node = card.current;

    if (node === null || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const arriving = entry?.isIntersecting === true;

        // Measured on the way OUT, while the card is still laid out. Read after
        // the unmount it would be the skeleton's height, which is the number
        // this exists to stop being used.
        if (!arriving && node.offsetHeight > 0) {
          held.current = node.offsetHeight;
        }

        setNear(arriving);
      },
      { rootMargin: NEARBY },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  /*
   * **Asked for as a side effect of being near, and never inside the
   * observer's callback.** The picker coalesces these into one batched request
   * per frame, so a merchant scrolling past ten cards makes one request rather
   * than ten.
   */
  useEffect(() => {
    if (near && template === undefined) {
      onNear?.(id);
    }
  }, [near, template, id, onNear]);

  const nameId = `wconvert-design-${id}`;
  const reasonId = `wconvert-refused-${id}`;
  const notesId = `wconvert-design-notes-${id}`;

  return (
    <li
      ref={card}
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
      style={!near && held.current !== null ? { minBlockSize: held.current } : undefined}
    >
      {/*
        The real design at real width, scaled down rather than reflowed:
        reflowing would show the merchant a layout no visitor gets, which is the
        one thing a live-rendered gallery exists to avoid.

        **The skeleton is in the card's own shape rather than a spinner**, and
        it is what a card shows both while its tree is arriving and while it is
        far from the viewport — so scrolling back to a card does not make it
        jump, and neither does its design landing (ADR 0039).
      */}
      {absent !== undefined ? (
        <div className="wconvert-gallery__absent">{absent}</div>
      ) : near && template !== undefined ? (
        <div className="wconvert-gallery__preview flex min-w-0 flex-1" inert aria-hidden="true">
          <Preview template={template} displayType={displayType} />
        </div>
      ) : loadError ? (
        <div className="wconvert-gallery__waiting wconvert-gallery__error">
          <Description>{__('Preview could not be loaded.', 'wconvert')}</Description>
          {onRetry !== undefined && <Button variant="outline" size="sm" onClick={onRetry} aria-describedby={nameId}>{__('Retry preview', 'wconvert')}</Button>}
        </div>
      ) : (
        <div className="wconvert-gallery__waiting">
          <Skeleton aria-hidden="true" className="size-full" />
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

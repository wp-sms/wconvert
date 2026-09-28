import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChevronDown, ChevronRight, EyeOff, GripVertical } from 'lucide-react';
import { losesWordsOnSwitch } from './structure/catalogue';
import { isConvertingAct } from './structure/guards';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Block } from './structure/tree';
import type { BlockDrag } from './useBlockDrag';

/**
 * One row of the block tree: what this block is, and what it says.
 *
 * ============================================================================
 * A ROW IS NAMED BY WHAT IT SAYS. NEVER "ITEM 3 OF 5".
 * ============================================================================
 * `Preview.tsx` already refuses that on the other surface — it labels a
 * clickable preview slot *"Edit “Get 10% off your first order”"* rather than by
 * position — and the reason is the same here and stronger: a design has three
 * `text` blocks in it, so a tree read out as *"text, text, text"* tells a
 * screen-reader user which node they are on and nothing about which block.
 *
 * Position IS announced, and by the right mechanism: `aria-level`,
 * `aria-posinset` and `aria-setsize` on the row, which a screen reader reads
 * after the name rather than instead of it.
 *
 * ============================================================================
 * IT IS A `treegrid`, WHICH IS NOT A STYLING CHOICE.
 * ============================================================================
 * A row carries several focusable controls — the name, ↑, ↓, a menu — and that
 * is precisely the case `tree` cannot express and `treegrid` exists for. It is
 * also what Gutenberg's List View uses, for exactly this row shape, so a
 * merchant who knows WordPress already knows the keys: ↑↓ between rows, ←→
 * between the controls in a row, Home/End to the ends (ADR 0036 — vendor the
 * behaviour, do not take the dependency).
 */

/** Which controls a row carries, in the order ←→ walks them. */
export type Control = 'name' | 'up' | 'down' | 'more';

/**
 * The controls this block's row has.
 *
 * **A step has only its name**, because a step is not a block a merchant
 * arranges: how many a design has follows from its metric — two for a submit,
 * one for a click (ADR 0025) — so there is nothing to move it above and
 * nothing to delete it into.
 *
 * One function rather than two, because the tree needs the COUNT to know where
 * → stops and the row needs the list to draw them. Two spellings of that would
 * be a right-arrow that walks past the last button on some rows and not others.
 */
export const controlsOf = (block: Block): readonly Control[] =>
  block.level === 1 ? ['name'] : ['name', 'up', 'down', 'more'];

export interface BlockRowProps {
  readonly block: Block;
  readonly labels: TemplateLabels;
  /** Which control holds the row's tab stop, or null where the row is not the one. */
  readonly focused: number | null;
  /** Whether that control should be given focus now, rather than merely made tabbable. */
  readonly takeFocus: boolean;
  readonly selected: boolean;
  /** Null where the block holds nothing, so there is nothing to expand. */
  readonly expanded: boolean | null;
  readonly onExpand: (expanded: boolean) => void;
  readonly onSelect: () => void;
  readonly onFocusControl: (control: number) => void;
  /** ↑, ↓ and the menu. Absent while the tree is read-only. */
  readonly actions?: (props: { control: Control; tabIndex: number }) => ReactNode;
  /**
   * Dragging, where it is switched on.
   *
   * **Optional, and the row does not need it.** Drag is strictly additive
   * (WCAG 2.2 SC 2.5.7): passing nothing leaves a row that moves by its ↑↓
   * buttons exactly as it did, which is the acceptance criterion
   * {@see useBlockDrag} is written against.
   */
  readonly drag?: BlockDrag;
}

export function BlockRow({
  block,
  labels,
  focused,
  takeFocus,
  selected,
  expanded,
  onExpand,
  onSelect,
  onFocusControl,
  actions,
  drag,
}: BlockRowProps) {
  const controls = controlsOf(block);
  const name = nameOfBlock(block, labels);
  const summary = summaryOf(block, labels);
  const pane = paneName(block);
  const row = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLSpanElement>(null);
  const path = block.path.join('.');
  /*
   * **A step gets no handle, rather than an inert one.** Steps are not
   * draggable — how many a design has follows from its metric (ADR 0025), and
   * `canDrag` already refuses them — so a grip drawn on one would be an
   * affordance that lies. Nothing is attached either: a step is never a valid
   * drop target, because a drop only lands between siblings.
   */
  const draggable = block.level > 1;

  /*
   * **Keyed on the path string, never on the block.** `nodesOf` builds fresh
   * objects on every render, so an effect depending on `block` would tear down
   * and rebuild every drag listener in the tree on every keystroke — including
   * mid-drag, which ends the drag.
   */
  useEffect(() => {
    if (drag === undefined || !draggable || row.current === null || handle.current === null) {
      return;
    }

    return drag.attach(path, row.current, handle.current);
  }, [drag, draggable, path]);

  return (
    <div
      ref={row}
      role="row"
      aria-level={block.level}
      aria-posinset={block.position}
      aria-setsize={block.setSize}
      aria-expanded={expanded ?? undefined}
      aria-selected={selected}
      className="wconvert-block"
      data-selected={selected ? 'true' : undefined}
      data-step={block.level === 1 ? 'true' : undefined}
      data-dragging={drag?.dragging === path ? 'true' : undefined}
      /*
        Which side the block would land on, as an attribute the stylesheet
        turns into a rule across the row. Vertical, so it is the one measurement
        in this editor that does not invert under RTL — a list runs top to
        bottom in Persian too.
      */
      data-drop-edge={drag?.over?.path === path ? drag.over.edge : undefined}
      /*
        **Depth is a custom property, not a class per level.** The tree nests as
        deep as the vocabulary lets a merchant nest it, so a `.depth-4` ladder
        would have a floor nobody chose. `padding-inline-start` is what makes it
        invert under `fa_IR` without a second rule (ADR 0038).
      */
      /*
        **A hidden block is marked in the LIST, not only in its own panel.**
        *Show this* is a per-block switch whose only trace was the inspector for
        the one block selected — so a merchant who hid the fine print and
        clicked away had no way to find it again except by opening every row,
        and the preview cannot help because the block is not in it. The row is
        the one place that can say so.
      */
      data-hidden={block.hidden ? 'true' : undefined}
      style={{ '--wconvert-depth': block.level - 1 } as CSSProperties}
    >
      {/*
        ====================================================================
        THE GRIP IS THE DRAG SOURCE, AND IT IS POINTER-ONLY ON PURPOSE.
        ====================================================================
        It was the NAME button, which also selects — one control with two
        meanings, wearing `cursor: grab` while its click did something else. So
        the grip is its own thing and the name went back to selecting.

        Out of the tab order and out of the accessibility tree, because a drag
        is the one capability the keyboard already has twice: ↑↓ on the row,
        Alt+↑↓ anywhere on it, and Move up / Move down in the menu. Announcing
        a drag a screen-reader user cannot perform is noise on every row.

        Not a `gridcell` either: the treegrid's cell count must not change, or
        → would walk a different number of controls on a step than on a block.
      */}
      {draggable && (
        <span
          ref={handle}
          aria-hidden="true"
          className="wconvert-block__grip"
        >
          <GripVertical />
        </span>
      )}

      <span role="gridcell" className="wconvert-block__name">
        {expanded === null ? (
          <span aria-hidden="true" className="wconvert-block__twist" />
        ) : (
          /*
            **The twisty is not a control of its own**, deliberately. It would
            be a fifth tab stop per row on a screen that already has four, and
            the treegrid pattern puts expand and collapse on → and ← from the
            row's first cell — which is where a keyboard merchant looks for
            them. A pointer still needs something to hit, so it is a click
            target inside the name cell rather than a button beside it.
          */
          <button
            type="button"
            /*
              Out of the tab order and out of the accessibility tree, because
              the keyboard already has this: → expands and ← collapses from the
              row's first cell. A second announcement of the same function is
              a second thing to walk past on every row.
            */
            tabIndex={-1}
            aria-hidden="true"
            className="wconvert-block__twist"
            onClick={(event) => {
              event.stopPropagation();
              onExpand(!expanded);
            }}
          >
            {/*
              **Mirrored, and its own component already mirrors the arrow
              KEYS.** {@see BlockTree}'s `mirrored()` swaps ← and → under a
              right-to-left locale and has a test proving it; the twist beside
              those keys pointed the same way whichever direction the tree ran,
              so the glyph and the key it stands for disagreed.
            */}
            {expanded ? <ChevronDown /> : <ChevronRight className="rtl:-scale-x-100" />}
          </button>
        )}

        <Control
          focused={focused === 0}
          takeFocus={takeFocus}
          onFocus={() => onFocusControl(0)}
        >
          {(tabIndex) => (
            <button
              type="button"
              tabIndex={tabIndex}
              className="wconvert-block__label"
              onClick={onSelect}
            >
              {pane !== null && <span className="wconvert-block__pane">{pane}</span>}
              <span className="wconvert-block__kind">{name}</span>
              {/*
                What it says, what it holds, or — for a layout holding nothing —
                the sentence and the fact that fixes it. ADR 0039 asks an empty
                region for one sentence and the action; the action is the row's
                own **Add a block inside**, one cell along, which is nearer than
                a button drawn under the tree would be.
              */}
              {summary !== null && <span className="wconvert-block__says">{summary}</span>}

              {/*
                An icon rather than a chip: it is a STATE of the row rather than
                a fact about the block, so it reads as a property of the whole
                line — and it is the eye's affordance, with the word carried for
                a screen reader, which cannot see the dimming.
              */}
              {block.hidden && (
                <span className="wconvert-block__off">
                  <EyeOff aria-hidden="true" />
                  <span className="sr-only">{__('Hidden', 'wconvert')}</span>
                </span>
              )}

              {/*
                ================================================================
                TWO CHIPS, AND NEITHER IS DECORATION.
                ================================================================
                **counted** marks the one block this Optin's numbers depend on.
                It is said once in the status line and then forgotten, and
                deleting it leaves an Optin that renders, publishes and reports
                zero forever (ADR 0020) — a list of blocks that does not point
                at it is a list missing its most important row.

                **words will be lost** is the sharp version of a limit that is
                otherwise invisible until the fourth template. Slot Roles are a
                closed list of thirteen, unique across the tree, so there is
                exactly one fillable body slot — and a block that got none has
                no seam for its words to travel on. The merchant can type a
                second paragraph, switch design, and find it gone.
              */}
              {/*
                **`counted` alone is a word with no referent.** It is the only
                chip in the admin naming a concept the merchant has not met — a
                merchant reading it asks *"counted where? by what?"* — so the
                sentence travels with it: as a `title` for a pointer and in the
                accessibility tree for everyone else. The chip stays two
                syllables because it is on every row of a list that is read by
                scanning.
              */}
              {isConvertingAct(block) && (
                <span
                  className="wconvert-block__chip wconvert-block__chip--counted"
                  title={__('This Campaign’s conversions are counted on this block.', 'wconvert')}
                >
                  {__('counted', 'wconvert')}
                  <span className="sr-only">
                    {' '}
                    {__('— this Campaign’s conversions are counted on this block.', 'wconvert')}
                  </span>
                </span>
              )}
              {/*
                **The same treatment `counted` gets, and it was missing for the
                same reason it was needed.** *words will be lost* names a
                mechanism a merchant has never met — Slot Roles are the seam
                copy travels on and nothing on this screen says the word — so
                four syllables on a row read as a warning with no subject. The
                chip stays four words because it is on every row of a list read
                by scanning; the sentence travels beside it, as a `title` for a
                pointer and in the accessibility tree for everyone else.
              */}
              {/*
                ================================================================
                A RESTYLED BOX LOOKS EXACTLY LIKE AN UNTOUCHED ONE OTHERWISE.
                ================================================================
                A bag applies to a box and everything inside it (ADR 0062), and
                nothing about a row said which boxes carried one — so after
                restyling a design box by box, finding the nine tokens set on
                the second panel meant selecting every panel and reading the
                reset buttons.

                **A count and not a dot**, because the number is the fact a
                merchant acts on: *nine* says this box is where the design's
                look actually lives, and *one* says somebody nudged a padding.
                `9+2` is nine at full width and two more at narrow (ADR 0064),
                which is also the payload's shape.
              */}
              {block.sets > 0 && (
                <span
                  className="wconvert-block__chip wconvert-block__chip--sets"
                  title={
                    block.setsNarrow > 0
                      ? sprintf(
                          /* translators: 1: how many style settings this block carries. 2: how many more it carries for narrow widths. */
                          __(
                            'This block sets %1$d thing(s) about how it and everything inside it looks, and %2$d more when the design is narrow.',
                            'wconvert',
                          ),
                          block.sets,
                          block.setsNarrow,
                        )
                      : sprintf(
                          /* translators: %d: how many style settings this block carries. */
                          __(
                            'This block sets %d thing(s) about how it and everything inside it looks.',
                            'wconvert',
                          ),
                          block.sets,
                        )
                  }
                >
                  {block.setsNarrow > 0
                    ? sprintf(
                        /* translators: 1: a count of style settings. 2: a count of extra settings for narrow widths. Kept as digits because it is on every row of a scanned list. */
                        __('%1$d+%2$d', 'wconvert'),
                        block.sets,
                        block.setsNarrow,
                      )
                    : String(block.sets)}
                </span>
              )}
              {losesWordsOnSwitch(block) && (
                <span
                  className="wconvert-block__chip wconvert-block__chip--warn"
                  title={__(
                    'This block has no Slot Role, so what you type in it is dropped when you switch design.',
                    'wconvert',
                  )}
                >
                  {__('words will be lost', 'wconvert')}
                  <span className="sr-only">
                    {' '}
                    {__(
                      '— this block has no Slot Role, so what you type in it is dropped when you switch design.',
                      'wconvert',
                    )}
                  </span>
                </span>
              )}
            </button>
          )}
        </Control>
      </span>

      {actions !== undefined &&
        controls.slice(1).map((control, at) => (
          <span role="gridcell" key={control} className="wconvert-block__action">
            <Control
              focused={focused === at + 1}
              takeFocus={takeFocus}
              onFocus={() => onFocusControl(at + 1)}
            >
              {(tabIndex) => actions({ control, tabIndex })}
            </Control>
          </span>
        ))}
    </div>
  );
}

/**
 * One cell's control, with the roving tabindex applied to it.
 *
 * **Exactly one element in the whole grid is tabbable**, which is the half of
 * the treegrid pattern a `tabindex="0"` per button quietly breaks: a design
 * with fifteen blocks would otherwise be sixty tab stops between the tab strip
 * and the Save button.
 *
 * Focus is moved imperatively rather than by rendering `autoFocus`, because the
 * thing being expressed is *"the arrow key moved focus"* — and `autoFocus`
 * would also fire the first time the tree drew itself, stealing focus from
 * whatever the merchant was on.
 */
function Control({
  focused,
  takeFocus,
  onFocus,
  children,
}: {
  focused: boolean;
  takeFocus: boolean;
  onFocus: () => void;
  children: (tabIndex: number) => ReactNode;
}) {
  const cell = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!focused || !takeFocus) {
      return;
    }

    cell.current?.querySelector<HTMLElement>('button,a[href],input')?.focus();
  }, [focused, takeFocus]);

  return (
    <span ref={cell} onFocus={onFocus} className="contents">
      {children(focused ? 0 : -1)}
    </span>
  );
}

/**
 * What this block is CALLED, in the vocabulary's own words.
 *
 * The same three-step answer {@see nameOfSlot} gives — [[Slot Role]] first,
 * capture kind where a `field` has no Role of its own, node type where neither
 * — because a block called "Headline" on the row and "Heading" in the inspector
 * under it is two names for one thing, six inches apart.
 */
export function nameOfBlock(block: Block, labels: TemplateLabels): string {
  if (block.level === 1) {
    return block.screenName || sprintf(__('Screen %d', 'wconvert'), block.position);
  }

  if (block.role !== null) {
    return nameOf(labels.roles, block.role);
  }

  if (block.captures !== null) {
    return nameOf(labels.fields, block.captures);
  }

  // A layout's words live in their own map, because a layout is not a leaf and
  // the parity test that keeps each map honest is asked of the manifest section
  // it names. `nameOf` falls back to the key either way, so a build whose
  // vocabulary is ahead of its translations shows `grid` rather than nothing.
  return block.leaf ? nameOf(labels.nodes, block.type) : nameOf(labels.layouts, block.type);
}

/**
 * The one line under the name: what this block says, or what it holds.
 *
 * Three answers, because a row has to be identifiable at a glance and three
 * kinds of block are identifiable by three different things:
 *
 * - **A leaf says its words**, which is what {@link Block.says} already reads
 *   off the manifest's `copy` keys. A `button` adds what it DOES — *"Send my
 *   code · sends the form"* — because two buttons with the same label that
 *   differ in `action` are two different designs, and it is the param that
 *   decides whether this Optin converts on a submission or on a click.
 * - **A layout says how much is in it.** Not *"side by side"*: the row is
 *   already NAMED "Side by side", and repeating the arrangement would be the
 *   name twice with a number in front. What a merchant cannot see from a
 *   collapsed row is the count.
 * - **An empty layout says it is empty**, and the fix is one cell along.
 */
export function summaryOf(block: Block, labels: TemplateLabels): string | null {
  if (block.says !== null) {
    return block.action === null
      ? block.says
      : sprintf(
          /* translators: 1: what the button says, e.g. “Send my code”. 2: what it does, e.g. “Sends the form”. */
          __('%1$s · %2$s', 'wconvert'),
          block.says,
          nameOf(labels.params, block.action),
        );
  }

  if (!block.holder) {
    return null;
  }

  return block.holds === 0
    ? __('Empty — add a block inside it.', 'wconvert')
    : sprintf(
        /* translators: %d: how many blocks sit inside this one, at any depth. */
        _n('%d block inside', '%d blocks inside', block.holds, 'wconvert'),
        block.holds,
      );
}

/**
 * Which pane of a `split` this block sits in, or null where the question does
 * not arise.
 *
 * **A `split` is the one layout whose children are two lists**, and a tree that
 * indented both under the same parent with nothing between them would show a
 * merchant four rows and no boundary. Named first and second rather than left
 * and right, which is the only naming that survives `fa_IR` — the panes swap
 * sides and the order does not.
 */
export function paneName(block: Block): string | null {
  if (block.pane === 'start') {
    return __('First pane', 'wconvert');
  }

  return block.pane === 'end' ? __('Second pane', 'wconvert') : null;
}

/**
 * The row's whole accessible name, for a live region that has to say it out
 * loud away from the row itself.
 *
 * Announcing a move needs the block named in one string — *"Headline, moved
 * down, 3 of 6"* — and a screen reader assembling that from `aria-posinset` is
 * reading the row, which is not where the merchant's focus is at that moment.
 */
export function sentenceFor(block: Block, labels: TemplateLabels): string {
  const name = nameOfBlock(block, labels);

  return block.says === null
    ? name
    : sprintf(
        /* translators: 1: what kind of block it is, 2: the words it currently shows. */
        __('%1$s, “%2$s”', 'wconvert'),
        name,
        block.says,
      );
}

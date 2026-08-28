import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Block } from './structure/tree';

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
}: BlockRowProps) {
  const controls = controlsOf(block);
  const name = nameOfBlock(block, labels);

  return (
    <div
      role="row"
      aria-level={block.level}
      aria-posinset={block.position}
      aria-setsize={block.setSize}
      aria-expanded={expanded ?? undefined}
      aria-selected={selected}
      className="wconvert-block"
      data-selected={selected ? 'true' : undefined}
      data-step={block.level === 1 ? 'true' : undefined}
      /*
        **Depth is a custom property, not a class per level.** The tree nests as
        deep as the vocabulary lets a merchant nest it, so a `.depth-4` ladder
        would have a floor nobody chose. `padding-inline-start` is what makes it
        invert under `fa_IR` without a second rule (ADR 0038).
      */
      style={{ '--wconvert-depth': block.level - 1 } as CSSProperties}
    >
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
            {expanded ? <ChevronDown /> : <ChevronRight />}
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
              <span className="wconvert-block__kind">{name}</span>
              {block.says !== null && (
                <span className="wconvert-block__says">{block.says}</span>
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
 * The same three-step answer the settings panel gives — [[Slot Role]] first,
 * capture kind where a `field` has no Role of its own, node type where neither
 * — because a block called "Headline" in one column and "Heading" in the other
 * is two names for one thing on one screen.
 */
export function nameOfBlock(block: Block, labels: TemplateLabels): string {
  if (block.level === 1) {
    return stepName(block.position);
  }

  if (block.role !== null) {
    return nameOf(labels.roles, block.role);
  }

  return block.captures !== null
    ? nameOf(labels.fields, block.captures)
    : nameOf(labels.nodes, block.type);
}

/**
 * What a step is called, from its position.
 *
 * **Terminal is STRUCTURAL** — the success state is the last step rather than a
 * flagged one (ADR 0025) — so the name follows from where the step sits and
 * there is no second spelling to keep in step. Shared with the preview's own
 * step buttons, which said the same two words in their own file.
 */
export const stepName = (position: number): string =>
  position === 1 ? __('The form', 'wconvert') : __('After they submit', 'wconvert');

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

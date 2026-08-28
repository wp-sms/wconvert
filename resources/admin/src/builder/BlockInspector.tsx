import { useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { SlotFields } from './SlotFields';
import { nameOfBlock } from './BlockRow';
import { slotsOf, withHidden, withValue, type Path } from './panel';
import { nodesOf, samePath } from './structure/tree';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

/**
 * The selected block's own controls, under the list it was selected in.
 *
 * ============================================================================
 * A BLOCK IS EDITED WHERE IT IS SELECTED. THAT IS THE WHOLE POINT.
 * ============================================================================
 * The tree shipped without this, and selecting a row highlighted it in the
 * preview and stopped — so changing a headline meant leaving for another tab,
 * finding that block among all of them, typing, and coming back. Two places to
 * look for one act.
 *
 * So the controls come to the selection. The tab column is 616px at its widest
 * and ~392px at 1024px (`main` is `max-w-6xl`), which is not enough for a
 * side-by-side split — the inspector goes underneath, which is where a list and
 * its detail belong anyway, and it settles the placement rule ADR 0039's table
 * only answered for bulk actions: **a control that acts on a selection lives
 * under the list the selection is made in.**
 *
 * ============================================================================
 * IT IS NEVER EMPTY, AND IT NEVER DRAWS AN EMPTY BOX.
 * ============================================================================
 * A merchant arriving has the first block selected, so they are already editing
 * rather than reading an instruction about what to click. And a block that says
 * nothing — a step, a `row`, a `split` — is named and explained rather than
 * given a box with no fields in it: `slotsOf` walks leaves, so a layout has no
 * slot, and a panel that drew one anyway would be a control promising an edit
 * it cannot make.
 *
 * ============================================================================
 * IT ADDRESSES BY PATH, WHICH IS WHAT MADE THE SELECTION CHANGE NECESSARY.
 * ============================================================================
 * A block with no [[Slot Role]] has no `SlotKey`, and two role-less blocks of
 * one type are indistinguishable by one — so a key-based selection would leave
 * exactly those blocks uneditable. `slots.ts` says the rest; what matters here
 * is that the address arriving is a `Path`, which is what `panel.ts` has
 * written through since it was written.
 */

export interface BlockInspectorProps {
  readonly template: Template;
  readonly labels: TemplateLabels;
  /** Which block is being edited, or null while the design holds none. */
  readonly path: Path | null;
  /**
   * The design, changed.
   *
   * `coalesce` names the control the change came from, so a burst of typing is
   * one undo entry rather than one per character — see `structure/history.ts`.
   * Absent for anything that is not typing, which is what breaks the chain.
   */
  readonly onChange: (template: Template, coalesce?: string) => void;
}

export function BlockInspector({ template, labels, path, onChange }: BlockInspectorProps) {
  const heading = useId();
  const block = path === null ? null : nodesOf(template.tree).find((each) => samePath(each.path, path)) ?? null;
  const slot = path === null ? null : slotsOf(template.tree).find((each) => samePath(each.path, path)) ?? null;

  if (block === null || path === null) {
    return (
      <div className="wconvert-inspector">
        <p className="m-0 text-pretty text-muted-foreground">
          {__('Pick a block above to edit what it says.', 'wconvert')}
        </p>
      </div>
    );
  }

  const name = nameOfBlock(block, labels);

  return (
    /*
      **A named group, because it is a set of controls about one thing.** A
      screen reader arriving by Tab out of the tree hears which block these
      belong to before the first field, and it is named by the heading rather
      than by a second copy of the same words.
    */
    <div role="group" aria-labelledby={heading} className="wconvert-inspector">
      <div className="wconvert-inspector__head">
        {/*
          **A heading, not a bolded line.** The inspector is a second region
          under the tree and a screen reader walking headings has to be able to
          land on it — and it is where the merchant's focus arrives when they
          Tab out of the grid.
        */}
        <h4 id={heading} className="wconvert-inspector__name">
          {name}
        </h4>

        {/*
          What KIND of block it is, where the name did not already say so. A
          slot named by its Slot Role reads "Headline", and a merchant who has
          to reason about what may go where is helped by knowing that is a
          heading.
        */}
        {block.leaf && block.role !== null && (
          <span className="wconvert-inspector__kind">{nameOf(labels.nodes, block.type)}</span>
        )}
      </div>

      {slot === null ? (
        <p className="m-0 text-pretty text-muted-foreground">
          {block.level === 1
            ? __(
                'A step is what the blocks are in. Pick one of the blocks listed under it to edit what it says.',
                'wconvert',
              )
            : sprintf(
                /* translators: %s: what the layout is called, e.g. “Row”. */
                __('%s holds blocks rather than words. Pick one of the blocks inside it.', 'wconvert'),
                name,
              )}
        </p>
      ) : (
        /*
          **Keyed by the path**, so switching blocks builds fresh controls and
          switching nothing keeps the caret exactly where it was. The prototype
          needed a `data-focuskey` attribute to hold a caret across a redraw
          because it rebuilt the DOM by hand; React reconciling by key is why
          this does not.
        */
        <SlotFields
          key={path.join('.')}
          slot={slot}
          labels={labels}
          onValue={(key, value) =>
            onChange(
              { ...template, tree: withValue(template.tree, slot.path, key, value) },
              typingKey(slot.path, key),
            )
          }
          onHidden={(hidden) => onChange({ ...template, tree: withHidden(template.tree, slot.path, hidden) })}
        />
      )}
    </div>
  );
}

/**
 * Which control a keystroke came from, as the string the history coalesces on.
 *
 * A path and a key, because that is exactly what "the same box" means: typing
 * into a headline and then into a body must be two undo entries, and typing
 * into the same headline twice must be one.
 */
export const typingKey = (path: Path, key: string): string => `text:${path.join('.')}:${key}`;

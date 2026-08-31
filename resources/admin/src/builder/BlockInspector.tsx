import { useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeftRight, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { SlotFields } from './SlotFields';
import { nameOfBlock } from './BlockRow';
import { LAYOUTS, slotsOf, withHidden, withValue, type Path } from './panel';
import { nodeAt, nodesOf, samePath } from './structure/tree';
import { swapLabel, swapNameOf, swapSaid, swapsFor, withSwapped } from './structure/swap';
import type { ConvertingAct } from './structure/catalogue';
import { Description } from '../shell/Description';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

/**
 * The selected block's own controls, beside the list it was selected in — or
 * under it, where there is no room beside.
 *
 * ============================================================================
 * A BLOCK IS EDITED WHERE IT IS SELECTED. THAT IS THE WHOLE POINT.
 * ============================================================================
 * The tree shipped without this, and selecting a row highlighted it in the
 * preview and stopped — so changing a headline meant leaving for another tab,
 * finding that block among all of them, typing, and coming back. Two places to
 * look for one act.
 *
 * So the controls come to the selection, and it settles the placement rule
 * ADR 0039's table only answered for bulk actions: **a control that acts on a
 * selection lives WITH the list the selection is made in.**
 *
 * ============================================================================
 * "616px, MEASURED RATHER THAN PREFERRED" WAS TRUE AND IS NOT ANY MORE.
 * ============================================================================
 * This said the split was unavailable: *"the tab column is 616px at its widest
 * (`main` is `max-w-6xl`) and ~392px at 1024px"*. The measurement was honest,
 * and 616 was arithmetic off a number chosen for a different kind of screen —
 * `1152 − 48 padding − 24 gap − 464 aside` — not a decision about an editor.
 * The builder now holds a measure of its own (`Shell`'s `wide`), and above
 * 48rem of container `index.css` puts the tree and this panel side by side.
 *
 * **Beside, and not merely wider.** The fields in here are `widefat`, so a
 * single column given the extra 288px would spend it turning a *Placeholder*
 * box into an 870px field for `you@example.com`. The width buys a second
 * column, and the second column is also what stops a selection made low in a
 * long tree from putting these controls below the fold.
 *
 * Under it below the breakpoint, which is exactly what shipped and is where a
 * list and its detail belong when there is one column to put them in.
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
   * Which act this Optin's [[Goal]] is measured by.
   *
   * **Told rather than derived**, for the reason {@see StructureView} gives: a
   * button swapped to `link` on a submit-metered Optin fails the WHOLE save,
   * and the merchant must meet the refusal here rather than a red bar there.
   */
  readonly act: ConvertingAct;
  /**
   * The design, changed.
   *
   * `coalesce` names the control the change came from, so a burst of typing is
   * one undo entry rather than one per character — see `structure/history.ts`.
   * Absent for anything that is not typing, which is what breaks the chain.
   */
  readonly onChange: (template: Template, coalesce?: string) => void;
  /**
   * A block was changed into something else.
   *
   * Separate from {@link onChange} because a swap is worth SAYING: it renames
   * the row, and it changes the [[Slot Role]]s derived from what a field
   * captures — so the preview's key changes under a selection that has not
   * moved. One live region says both, in the words the tree already uses.
   */
  readonly onSwap: (template: Template, said: string) => void;
}

export function BlockInspector({ template, labels, path, act, onChange, onSwap }: BlockInspectorProps) {
  const heading = useId();
  const block = path === null ? null : nodesOf(template.tree).find((each) => samePath(each.path, path)) ?? null;
  const slot = path === null ? null : slotsOf(template.tree).find((each) => samePath(each.path, path)) ?? null;

  if (block === null || path === null) {
    return (
      <div className="wconvert-inspector">
        <Description>{__('Pick a block to edit what it says.', 'wconvert')}</Description>
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
          in this tab — under the tree in a narrow container and beside it in a
          wide one — and a screen reader walking headings has to be able to land
          on it either way. It is also where the merchant's focus arrives when
          they Tab out of the grid.
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

        <SwapMenu template={template} labels={labels} path={path} act={act} onSwap={onSwap} />
      </div>

      {slot === null ? (
        <>
          <Description>
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
          </Description>

          {/*
            **A layout holds no words and it does have SETTINGS**, and the
            editor offered none of them. `split` declares `ratio`, the renderer
            reads it, and no control in this admin reached it — so a Side by
            side was a fixed 50/50 forever and the manifest described a
            capability nobody had. (`grid`'s `columns` was the same, and is one
            of the reasons that layout is gone rather than fixed.)

            "Holds blocks rather than words" was true and was being used as a
            reason to draw nothing.
          */}
          <LayoutParams
            type={block.type}
            labels={labels}
            onParam={(key, value) =>
              onChange({ ...template, tree: withValue(template.tree, path, key, value) })
            }
            valueOf={(key) => (nodeAt(template.tree, path) as Record<string, unknown> | null)?.[key]}
          />
        </>
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
 * A layout's own settings, as the controls the manifest says it has.
 *
 * ============================================================================
 * THE SAME DISPATCH THE DESIGN PANEL MAKES, ONE LEVEL IN.
 * ============================================================================
 * A control that ENUMERATES reads its enumeration from the manifest (ADR 0010,
 * ADR 0042). `split.choices.ratio` is the list, `TemplateLabels` has the words,
 * and neither is spelled in this bundle — so a param added to a layout arrives
 * with a control and nothing here is edited.
 *
 * **And it is a suggestion, never a limit.** The renderer takes any fraction
 * for `ratio`, so a design shipping `0.4` keeps it and simply shows nothing
 * checked — the same bargain the token panel makes, for the same reason.
 */
function LayoutParams({
  type,
  labels,
  valueOf,
  onParam,
}: {
  type: string;
  labels: TemplateLabels;
  valueOf: (key: string) => unknown;
  onParam: (key: string, value: unknown) => void;
}) {
  const declared = LAYOUTS[type];
  const params: readonly string[] = declared?.params ?? [];

  if (params.length === 0) {
    return null;
  }

  return (
    <>
      {params.map((param: string) => {
        const offered: readonly string[] = declared?.choices?.[param] ?? [];

        if (offered.length === 0) {
          return null;
        }

        const held = valueOf(param);
        const shown = held === undefined ? '' : String(held);

        return (
          <div key={param} className="wconvert-token">
            <span id={`wconvert-param-${type}-${param}`}>
              {nameOf(labels.layoutParams, `${type}.${param}`)}
            </span>
            <span
              role="group"
              aria-labelledby={`wconvert-param-${type}-${param}`}
              className="wconvert-choice-set"
            >
              {offered.map((choice: string) => (
                <label key={choice} className="wconvert-choice">
                  <input
                    type="radio"
                    className="sr-only"
                    name={`wconvert-param-${type}-${param}`}
                    value={choice}
                    /*
                      Compared as NUMBERS, because the manifest spells the
                      offered values as strings and the tree stores them as
                      numbers — `0.5` and `"0.50"` are the same split and a
                      string compare would leave nothing checked on a design
                      that shipped one.
                    */
                    checked={shown !== '' && Number(shown) === Number(choice)}
                    onChange={() => onParam(param, Number(choice))}
                  />
                  <span className="wconvert-choice__label">
                    {nameOf(labels.layoutParamValues, `${type}.${param}.${choice}`)}
                  </span>
                </label>
              ))}
            </span>
          </div>
        );
      })}
    </>
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

/**
 * The ⇄ control: what this block could be instead.
 *
 * ============================================================================
 * IT IS ONLY DRAWN WHERE THERE IS SUCH A QUESTION.
 * ============================================================================
 * A `field`'s capture kind and a `button`'s action are the two params that
 * decide what a block IS, and neither has had a control anywhere in this plugin
 * — so an email field could never become a phone field except by deleting it,
 * which loses the merchant's wording. A `heading` has no such axis: it and
 * `text` differ in what the renderer draws rather than in a param.
 *
 * **Refusals are shown rather than filtered out**, which is the Add menu's own
 * rule and matters more here: the refusals are the only place a merchant ever
 * learns why their button is the kind of button it is, and *"your goal counts
 * submissions"* is an answer where a missing row is not.
 */
function SwapMenu({
  template,
  labels,
  path,
  act,
  onSwap,
}: {
  template: Template;
  labels: TemplateLabels;
  path: Path;
  act: ConvertingAct;
  onSwap: (template: Template, said: string) => void;
}) {
  const name = swapNameOf(template.tree, path);
  const swaps = swapsFor(template.tree, path, act);

  if (name === null || swaps.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="wconvert-inspector__swap">
          <ArrowLeftRight aria-hidden="true" />
          {name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-xs">
        {swaps.map((swap) => {
          const said = swapLabel(template.tree, path, swap.to, labels);

          return (
            <DropdownMenuItem
              key={swap.to}
              disabled={swap.refused !== null || swap.current}
              className="flex-col items-start gap-0.5"
              onSelect={() =>
                onSwap(
                  { ...template, tree: withSwapped(template.tree, path, swap.to, act, labels) },
                  swapSaid(said),
                )
              }
            >
              <span className="flex items-center gap-2">
                {/*
                  A tick on what it already is, rather than the row being left
                  out: a menu of two that shows one is a menu that looks broken,
                  and "this is what it is" is the answer to half of why anyone
                  opened it.
                */}
                {swap.current ? <Check aria-hidden="true" /> : <span className="size-4" aria-hidden="true" />}
                {said}
              </span>
              {swap.refused !== null && (
                <span className="text-pretty whitespace-normal text-muted-foreground">{swap.refused}</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

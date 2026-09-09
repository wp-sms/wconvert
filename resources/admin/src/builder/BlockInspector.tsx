import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeftRight, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ParamChoice } from './ParamChoice';
import { SlotFields } from './SlotFields';
import { nameOfBlock } from './BlockRow';
import { LAYOUTS, slotsOf, withHidden, withValue, type Path, type Slot } from './panel';
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
  /**
   * When this Optin stops running, as the merchant typed it — or undefined.
   *
   * Passed through rather than read here: a `countdown` counts to the Optin's
   * `ends_at` (ADR 0052), so the block with no setting of its own is the one
   * that needs a value from another tab ({@see SlotFields}).
   */
  readonly endsAt?: string;
  /** Take the merchant to the field that sets it. */
  readonly onSetEndDate?: () => void;
  /**
   * How the selected block LOOKS, as the second half of this panel.
   *
   * ==========================================================================
   * THE DESIGN TAB DISSOLVED IN HERE, EXACTLY AS `SettingsPanel` DISSOLVED.
   * ==========================================================================
   * There was a tab called *Design* holding the token controls for the whole
   * Optin, and a tab called *Content* holding this. Since ADR 0062 a token has a
   * SCOPE — the design's own, or one box's — and "which box" is a selection,
   * which is the question this panel already answers. So the controls come to
   * the selection like every other control on this screen, and one concept
   * replaces two.
   *
   * Passed in rather than built here because what it draws depends on what is
   * selected — the design's own tokens at a step root, one box's bag inside
   * one — and both need state this panel does not hold (which picker is open,
   * what the library entry declared). This panel's job is the two tabs and the
   * heading over them.
   *
   * Absent means no second tab at all, which is what the panel was before and
   * what it still is anywhere a design has not been chosen.
   */
  readonly look?: ReactNode;
}

export function BlockInspector({
  template,
  labels,
  path,
  act,
  onChange,
  onSwap,
  endsAt,
  onSetEndDate,
  look,
}: BlockInspectorProps) {
  const heading = useId();
  /*
    **Which half is open is remembered across selections, and that is the
    point.** A merchant restyling three boxes in a row presses *Style* once;
    one who is writing copy never sees it move. Resetting to *Content* on every
    click would make the second box a second press, which is the *"one click
    short"* failure ADR 0054 rule 4 names.
  */
  const [half, setHalf] = useState('content');
  const block = path === null ? null : nodesOf(template.tree).find((each) => samePath(each.path, path)) ?? null;
  const slot = path === null ? null : slotsOf(template.tree).find((each) => samePath(each.path, path)) ?? null;

  if (block === null || path === null) {
    return (
      <div className="wconvert-inspector">
        {/*
          **The pane keeps a head band with nothing selected, and it names what
          the panel is actually showing** — which is the DESIGN's own tokens,
          not an empty panel. A third column that loses its head while the two
          beside it keep theirs reads as a pane that failed to load.
        */}
        <div className="wconvert-pane__head">{__('The design', 'wconvert')}</div>
        <div className="wconvert-inspector__body">
          <Description>{__('Pick a block to edit what it says.', 'wconvert')}</Description>
          {/*
            **The look is still reachable with nothing selected**, because with
            nothing selected the look on offer is the DESIGN's — which is what
            the Design tab used to be, and losing it behind "select something
            first" would be a tab that vanished rather than one that moved.
          */}
          {look}
        </div>
      </div>
    );
  }

  const name = nameOfBlock(block, labels);
  const body = contentBody({
    template,
    labels,
    path,
    block,
    slot,
    name,
    onChange,
    endsAt,
    onSetEndDate,
  });

  /*
    ==========================================================================
    THE HEAD IS THIS PANE'S HEAD BAND, AND THE TAB STRIP IS IN IT (ADR 0066).
    ==========================================================================
    The three panes each say what they are in a band across their top —
    STRUCTURE, PREVIEW, and this one, named by the block because the block is
    what the whole pane is about. *Content* and *Style* belong in it for the
    same reason the tree's count does: they say what the pane is SHOWING, which
    is a pane head's job, and a strip on its own line under the band was a
    second row of chrome on the narrowest of the three columns.
  */
  const head = (
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

      {look !== undefined && (
        <TabsList
          className="wconvert-inspector__halves"
          aria-label={sprintf(
            /* translators: %s: what the selected block is called, e.g. “Headline”. */
            __('%s: what it says, or how it looks', 'wconvert'),
            name,
          )}
        >
          <TabsTrigger value="content">{__('Content', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="style">{__('Style', 'wconvert')}</TabsTrigger>
        </TabsList>
      )}

      <SwapMenu template={template} labels={labels} path={path} act={act} onSwap={onSwap} />
    </div>
  );

  /*
    **A named group, because it is a set of controls about one thing.** A screen
    reader arriving by Tab out of the tree hears which block these belong to
    before the first field, and it is named by the heading rather than by a
    second copy of the same words.
  */
  if (look === undefined) {
    return (
      <div role="group" aria-labelledby={heading} className="wconvert-inspector">
        {head}
        <div className="wconvert-inspector__body">{body}</div>
      </div>
    );
  }

  return (
    /*
      **Two halves of one panel, and the head stays above both.** *What it says*
      and *how it looks* are two questions about the SAME selected block, which
      is exactly what a tab strip is for — and the alternative, both stacked,
      puts the token controls a scroll below the words on a 22rem column.

      The `Tabs` root is the pane now rather than a box inside it, because the
      strip and the panels are in different bands and Radix needs one ancestor
      over the pair.
    */
    <Tabs
      value={half}
      onValueChange={setHalf}
      role="group"
      aria-labelledby={heading}
      className="wconvert-inspector"
    >
      {head}
      <div className="wconvert-inspector__body">
        <TabsContent value="content">{body}</TabsContent>
        <TabsContent value="style">{look}</TabsContent>
      </div>
    </Tabs>
  );
}

/**
 * The controls for what the selected block SAYS — the panel as it was before
 * the look moved in beside it.
 *
 * Split out as a variable rather than a component so the two halves reconcile
 * as the same elements they always did: `SlotFields` is keyed by path to hold a
 * caret across a redraw, and a new component around it would remount the tree
 * under that key on the first render after the split.
 */
function contentBody({
  template,
  labels,
  path,
  block,
  slot,
  name,
  onChange,
  endsAt,
  onSetEndDate,
}: {
  template: Template;
  labels: TemplateLabels;
  path: Path;
  block: { readonly type: string; readonly level: number };
  slot: Slot | null;
  name: string;
  onChange: (template: Template, coalesce?: string) => void;
  endsAt?: string;
  onSetEndDate?: () => void;
}) {
  return (
    <>
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
          /*
            **No coalescing key**, which is the whole reason this is not
            `onValue`. A setting is a radio press rather than a keystroke, and
            folding one into the burst of typing beside it would make a single
            ⌘Z take back both the sentence and the choice.
          */
          endsAt={endsAt}
          onSetEndDate={onSetEndDate}
          onParam={(param, value) =>
            onChange({ ...template, tree: withValue(template.tree, slot.path, param, value) })
          }
          onHidden={(hidden) => onChange({ ...template, tree: withHidden(template.tree, slot.path, hidden) })}
        />
      )}
    </>
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
 * **The control itself is {@see ParamChoice}, shared with the LEAF settings**
 * that landed beside these. It was written out here, with a `Number(choice)`
 * comparison and a comment about `0.50`: correct for the one param that
 * existed, and the wrong coercion for a boolean and a keyword. `panel.ts`
 * reads the value's shape instead, and both levels of the vocabulary now go
 * through one radio group rather than two with their own idea of what
 * *selected* looks like (ADR 0042 rule 5).
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

  /*
   * ==========================================================================
   * A PARAM WITHOUT `choices` IS NOT A CONTROL THIS COMPONENT DRAWS.
   * ==========================================================================
   * `choices` is what says "this param enumerates", and {@see ParamChoice} is a
   * radio group — so a param that names a BAG rather than a value (`tokens`,
   * since ADR 0062) would render an empty group under a translated legend,
   * which is the shape ADR 0054 rule 1 refuses: a control must have the shape
   * of its value. The bag has its own editor; this filter is what keeps the two
   * from drawing each other's.
   */
  const params: readonly string[] = (declared?.params ?? []).filter(
    (param) => (declared?.choices?.[param] ?? []).length > 0,
  );

  return (
    <>
      {params.map((param: string) => (
        <ParamChoice
          key={param}
          id={`${type}-${param}`}
          label={nameOf(labels.layoutParams, `${type}.${param}`)}
          offered={declared?.choices?.[param] ?? []}
          held={valueOf(param)}
          fallback={declared?.defaults?.[param]}
          nameOfValue={(choice) => nameOf(labels.layoutParamValues, `${type}.${param}.${choice}`)}
          onChange={(value) => onParam(param, value)}
        />
      ))}
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
 * learns why their button is the kind of button it is, and *"a design that
 * submits has a second step for what the visitor sees afterwards"* is an answer
 * where a missing row is not.
 *
 * That sentence used to name the [[Goal]] — *"your goal counts submissions …
 * change the goal to change this"* — and both halves were wrong: a Goal counts
 * no act (ADR 0059), and the door it named did not exist. The step count is
 * what actually refuses the flip (ADR 0025).
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
        {/*
          **`xs` and not `sm`: it is the only reason this head stood 33px**
          against the tree's 27, and a head is one band at one height now.

          `xs` rather than the `icon-xs` the plan named, because this button
          carries the swap's NAME beside its arrows — *Image*, *Column* — and
          `icon-xs` is a 24 x 24 square that would clip it. `xs` is the same
          24px floor with room for the word, which is what was actually being
          asked for.
        */}
        <Button type="button" variant="ghost" size="xs" className="wconvert-inspector__swap">
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
              {/*
                **12px, matching the other refusal in a menu.**
                {@see StructureView}'s `MenuAction` spends twelve lines
                measuring this: a reason at body size under a body-size label is
                a token apart and a hierarchy nowhere, so a menu of several
                rows with second lines reads as a wall. This one rendered at
                body size — the exact thing that measurement rejected — beside
                a sibling menu that had already been fixed.

                `font-normal tracking-normal` take back the small-caps register
                `text-micro` carries for table headers and stat labels, which is
                wrong for a sentence.
              */}
              {swap.refused !== null && (
                <span className="text-micro font-normal tracking-normal text-pretty whitespace-normal text-muted-foreground">
                  {swap.refused}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

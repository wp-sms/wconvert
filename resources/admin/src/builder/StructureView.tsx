import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Copy,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Description } from '../shell/Description';
import { EmptyState } from '../shell/EmptyState';
import { RegionBody } from '../shell/Region';
import { BlockInspector } from './BlockInspector';
import { BlockTree } from './BlockTree';
import { useBlockDrag } from './useBlockDrag';
import { nameOfBlock, sentenceFor, type Control } from './BlockRow';
import { additionsIn, freeRoleFor, nodeFor, type ConvertingAct } from './structure/catalogue';
import { whyDuplicationIsRefused, whyRemovalIsRefused } from './structure/guards';
import {
  countAt,
  nodeAt,
  nodesOf,
  rolesLostBy,
  samePath,
  spotOf,
  withDuplicated,
  withInserted,
  withMoved,
  withRemoved,
  type Block,
  type Spot,
} from './structure/tree';
import { LEAVES, childKeysOf, type Path } from './panel';
import { nameOf, type TemplateLabels } from '../templates/api';
import { keyOfSlot, type SlotKey } from './slots';
import type { Template, TemplateTree } from '@renderer/types';

/**
 * The **Content** tab: what this design is made of, where each part sits, the
 * five things a merchant may do to it — and, beside the list or under it, the
 * words of whichever block is selected.
 *
 * ============================================================================
 * UNDO, REDO AND THE VERDICT ARE NOT IN HERE. THEIR SCOPE IS THE DESIGN.
 * ============================================================================
 * They were, in this file's own `Toolbar`, and every one of them acts on the
 * whole draft rather than on this tab: a token changed on **Design** is a full
 * undo entry, picking a design is another, and the contrast failures the
 * verdict reports are caused by colours chosen there. So a merchant who applied
 * a preset and wanted it back had no Undo, because Undo was on another tab.
 *
 * {@see DesignToolbar} is the same three controls, rendered by the screen on
 * both tabs that edit the design. What is left here is what genuinely belongs
 * to the tree: the list, the row controls and the panel for the selected block.
 * {@link StructureViewProps.focus} is the one thread back — following a problem
 * to the block it names still has to land focus on that block's row.
 *
 * ============================================================================
 * IT IS ONE SCREEN. IT USED TO BE TWO, AND THAT WAS THE MISTAKE.
 * ============================================================================
 * *Content* and *Structure* shipped as separate tabs over one `template`, on
 * the argument that a merchant fixing a typo must not walk past a move button
 * to reach the sentence. That argument was true of a Structure tab **you could
 * not type in** — and the fix for that is to let a block be edited where it is
 * selected, not to keep a second copy of the document on another tab.
 *
 * With {@see BlockInspector} under the tree, the two were one screen drawn
 * twice, and a merchant changing a headline had to pick which copy to open. So
 * there is one, and it keeps the word merchants already have. The look went the
 * other way, to **Design**, which is what that word already promised.
 *
 * ============================================================================
 * ↑ AND ↓ ARE MANDATORY. DRAG IS THE ADDITION.
 * ============================================================================
 * **WCAG 2.2 SC 2.5.7 (AA) requires a single-pointer alternative to any drag**,
 * and W3C is explicit that a keyboard equivalent does not satisfy it *"unless
 * that equivalent keyboard operation also provides controls that can be clicked
 * or tapped"* — its own cited example being *"sortable lists: adjacent controls
 * for moving elements up or down"*. ADR 0038 sets AA as this admin's bar.
 *
 * So the buttons are the mechanism and a drag handle is a second way to reach
 * it. A version of this that replaced the buttons with a handle would have
 * failed the criterion outright.
 *
 * ============================================================================
 * DELETE DOES NOT CONFIRM, AND UNDO IS WHAT PAYS FOR THAT.
 * ============================================================================
 * ADR 0039 requires a confirm on every destructive action, and it is right
 * about the actions it was written for. A dialog per block-delete is a dialog a
 * merchant rearranging a design learns to dismiss without reading, which is
 * strictly worse than none. Undo is the precondition rather than a nicety, and
 * the amendment is recorded in ADR 0039 rather than assumed here.
 *
 * ============================================================================
 * THE PREVIEW IS NOT IN HERE. IT IS THE SCREEN'S (ADR 0040).
 * ============================================================================
 * It is pinned beside every tab, which is the mistake the settings panel made
 * before #69 and the one this must not repeat: a second preview drawn inside
 * this tab would be a second render of the same tree, disagreeing with the
 * first the moment either got a keystroke ahead.
 */

export interface StructureViewProps {
  readonly template: Template;
  readonly labels: TemplateLabels;
  /**
   * Which act this Optin's [[Goal]] is measured by, as
   * `GET /wconvert/v1/goals` reports it.
   *
   * **Told rather than derived.** A `link` button on a submit-metered Optin
   * fails the WHOLE save through `refuseAMetricItCannotReport`, and a merchant
   * should never meet that: it would be a red bar over an editor that had
   * happily let them do it.
   */
  readonly act: ConvertingAct;
  /** Which block is live, as its path. Null only while the design holds none. */
  readonly selected: Path | null;
  readonly onSelect: (key: SlotKey | null, path: Path) => void;
  /**
   * The design, changed. `coalesce` names the control a keystroke came from,
   * so a burst of typing in the inspector is one undo entry — see
   * `structure/history.ts`.
   */
  readonly onChange: (template: Template, coalesce?: string) => void;
  /**
   * A row the SCREEN has asked this tree to put focus on, as a fresh object
   * each time it asks.
   *
   * **It exists because the verdict left this file.** Following a problem to
   * the block it names is a selection *and* focus on that block's row, and the
   * chip that offers it now sits in {@see DesignToolbar}, on either of two tabs
   * — so the request crosses the boundary rather than the focus state being
   * lifted out of the tree that owns it. Identity is the signal: a new object
   * means a new request, and null means none has been made.
   *
   * Nothing else may use it. Selecting a row must NOT pull focus down or
   * around, which is what keeps ↑↓ working after a click.
   */
  readonly focus: { readonly path: Path } | null;
}

export function StructureView({
  template,
  labels,
  act,
  selected,
  onSelect,
  onChange,
  focus,
}: StructureViewProps) {
  /*
   * **One line that is both the visible answer and the announced one.**
   *
   * A move has to be announced — *"Headline, moved down, 3 of 6"* — and a
   * refusal has to be READ, by everyone. Two elements would be one sentence a
   * sighted merchant sees and a different one a screen reader hears, and the
   * refusals are exactly where those must not diverge: *"you cannot delete
   * this"* with no reason on screen is a support ticket.
   *
   * `role="status"` is polite, so it never interrupts what the merchant is
   * doing, and it is announced without moving focus — which is the whole point,
   * because focus is on the button they just pressed.
   */
  const [said, setSaid] = useState<string | null>(null);
  /*
   * Where focus goes after the tree redraws, as a path.
   *
   * **It must never land on `<body>`.** A deleted block takes its row with it,
   * and only the caller that deleted it knows what should hold focus instead.
   */
  const [focusOn, setFocusOn] = useState<{ path: Path; control: number } | null>(null);

  /*
   * The screen asked for a row. **Control 0 is the row's own name button**,
   * which is the one that selects — the same control the verdict chip aimed at
   * when it lived in this file.
   */
  useEffect(() => {
    if (focus !== null) {
      setFocusOn({ path: focus.path, control: 0 });
    }
  }, [focus]);

  const blocks = useMemo(() => nodesOf(template.tree), [template.tree]);

  /**
   * Write the design, say what happened, and put focus where the merchant
   * would reach for it next.
   *
   * `control` is the row's control index. A move asks for the button that was
   * just pressed, so pressing ↓ three times moves a block three places; every
   * other act asks for the block's name, because the block under focus is a
   * different block from the one the act was aimed at.
   */
  const write = (tree: TemplateTree, path: Path, control: number, sentence: string) => {
    onChange({ ...template, tree });
    setFocusOn({ path, control });
    setSaid(sentence);

    /*
     * **The selection follows the act, not the position it used to hold.** A
     * key survived a move for free — it named the slot rather than the place —
     * and a path does not, so the block moved is re-addressed here. It is the
     * same call for a delete, where the path is deliberately whatever took
     * focus: the next sibling, else the parent. Either way the inspector shows
     * a block rather than blanking.
     */
    const landed = nodesOf(tree).find((block) => samePath(block.path, path));

    onSelect(landed === undefined ? null : keyOfSlot(landed), path);
  };

  const refuse = (reason: string) => {
    setFocusOn(null);
    setSaid(reason);
  };

  const move = (block: Block, by: number, control: number) => {
    const moved = withMoved(template.tree, block.path, by);
    const spot = spotOf(block.path);

    // Unchanged by identity is the end of the array. The button is already
    // `aria-disabled` there, so this is the belt to that brace rather than a
    // case a merchant reaches.
    if (moved === template.tree || spot === null) {
      return;
    }

    write(
      moved,
      [...spot.parent, spot.key, spot.index + by],
      control,
      sprintf(
        /* translators: 1: the block, e.g. “Headline, “Join””. 2: “up” or “down”. 3: its new position. 4: how many blocks share the list. */
        __('%1$s, moved %2$s, %3$d of %4$d', 'wconvert'),
        sentenceFor(block, labels),
        by < 0 ? __('up', 'wconvert') : __('down', 'wconvert'),
        spot.index + by + 1,
        block.setSize,
      ),
    );
  };

  const remove = (block: Block) => {
    const refused = whyRemovalIsRefused(template.tree, block.path);
    const spot = spotOf(block.path);

    if (refused !== null || spot === null) {
      refuse(refused ?? '');

      return;
    }

    const removed = withRemoved(template.tree, block.path);
    const sibling: Path = [...spot.parent, spot.key, spot.index];

    write(
      removed,
      // The next sibling has shifted into the index this one held. Where there
      // is none, the block that was holding it — never `<body>`.
      nodeAt(removed, sibling) === null ? spot.parent : sibling,
      0,
      sprintf(
        /* translators: %s: the block that was removed. */
        __('%s removed. Undo brings it back.', 'wconvert'),
        sentenceFor(block, labels),
      ),
    );
  };

  const duplicate = (block: Block) => {
    const refused = whyDuplicationIsRefused(template.tree, block.path);
    const spot = spotOf(block.path);

    if (refused !== null || spot === null) {
      refuse(refused ?? '');

      return;
    }

    const lost = rolesLostBy(template.tree, block.path);

    write(
      withDuplicated(template.tree, block.path),
      [...spot.parent, spot.key, spot.index + 1],
      0,
      lost === 0
        ? sprintf(
            /* translators: %s: the block that was copied. */
            __('%s copied.', 'wconvert'),
            sentenceFor(block, labels),
          )
        : /*
           * **The copy comes back nameless whatever the editor does.** Slot
           * Roles are unique across the whole tree, so
           * `TemplateVocabulary::normalize()` keeps the first node claiming one
           * and drops it from every later one. The tree strips it here so the
           * editor is telling the truth at the moment of the act, which is the
           * only moment the merchant is looking.
           */
          sprintf(
            /* translators: %s: the block that was copied. */
            __(
              '%s copied. The copy has no name of its own, so it is listed on the Content tab by its kind and clicking it in the preview will not jump to it.',
              'wconvert',
            ),
            sentenceFor(block, labels),
          ),
    );
  };

  const add = (at: Spot, type: string) => {
    const bare = nodeFor(template.tree, type, at, act);

    if (bare === null) {
      return;
    }

    /*
      ========================================================================
      A NEW FIELD ARRIVES WORDED, BECAUSE THE WORDS ALREADY EXIST.
      ========================================================================
      `nodeFor` gave a field its `name` and `required` and nothing else, so it
      landed on the design as an unlabelled box with an empty placeholder — and
      the merchant's first act after adding one was always to type the two most
      predictable strings in the product.

      **This is not a new decision, it is the same one made a second time.** The
      ⇄ control already rewrites both from `labels.fields` and
      `labels.placeholders` when a field changes kind ({@see rewritten}), on the
      argument that *"an email field that becomes a phone field must not keep
      `you@example.com` in front of the visitor"*. An email field that is BORN
      must not arrive with nothing in front of the visitor either.

      It stays out of `nodeFor` because that function is pure over the tree and
      the vocabulary, and these are the vocabulary's WORDS — which are the
      server's, translated, and reach this screen as `labels`.
    */
    const node =
      type === 'field' && typeof (bare as { name?: string }).name === 'string'
        ? ({
            ...bare,
            label: nameOf(labels.fields, (bare as { name: string }).name),
            placeholder: nameOf(labels.placeholders, (bare as { name: string }).name),
          } as typeof bare)
        : bare;

    const nameless = LEAVES[type] !== undefined && LEAVES[type].roles.length > 0 && freeRoleFor(template.tree, type) === null;
    const kind = LEAVES[type] === undefined ? nameOf(labels.layouts, type) : nameOf(labels.nodes, type);

    write(
      withInserted(template.tree, at, node),
      [...at.parent, at.key, at.index],
      0,
      nameless
        ? sprintf(
            /* translators: 1: the kind of block added, e.g. “Heading”. 2: the same word again. */
            __(
              '%1$s added. Every name a %2$s can have is already used in this design, so this one is not linked to the preview.',
              'wconvert',
            ),
            kind,
            kind,
          )
        : sprintf(
            /* translators: %s: the kind of block added, e.g. “Heading”. */
            __('%s added.', 'wconvert'),
            kind,
          ),
    );
  };

  /*
   * **Drag, over the same `withMoved` the buttons call.** It is switched on
   * here and nowhere else: {@see useBlockDrag} writes no tree of its own, and
   * removing this call and the effect in {@see BlockRow} leaves an editor that
   * moves, adds, deletes and copies exactly as it did. That is the acceptance
   * criterion, and it is what "strictly additive" has to mean for WCAG 2.2
   * SC 2.5.7 to be satisfied by the ↑↓ buttons rather than merely accompanied.
   */
  const drag = useBlockDrag({
    // A drop leaves focus nowhere in particular — the pointer did the work —
    // so it asks for the moved block's name rather than a button beside it.
    onMove: (block, by) => move(block, by, 0),
    blocks,
  });

  if (template.tree.steps.length === 0) {
    return (
      <RegionBody>
        <EmptyState icon={Blocks} title={__('This design has nothing in it yet.', 'wconvert')}>
          {__('Pick a design on the Design tab and its blocks will be listed here.', 'wconvert')}
        </EmptyState>
      </RegionBody>
    );
  }

  return (
    <RegionBody className="wconvert-structure">
      {/*
        **"Beside it" rather than "below it".** The inspector is under the tree
        in a narrow container and beside it in a wide one, so the sentence names
        neither — a hint that says *below* on a screen where the panel is to the
        right is a hint the merchant checks and disbelieves.
      */}
      <Description>
        {__(
          'Pick a block to edit it and see it highlighted in the preview. Arrow keys move through the list; the buttons on each row move a block within the one it is in, and it can be dragged there by its name.',
          'wconvert',
        )}
      </Description>

      {/*
        **The region is always here; the SENTENCE is only here when there is
        one.**

        Present from the first render is not negotiable: a live region a screen
        reader has not been watching announces nothing the first time it fills,
        so mounting it when something happens is the same as not having it. But
        `min-h-[1lh]` reserved a blank line under the hint on every visit — ~45px
        of nothing between the instructions and the tree, permanently, for a
        sentence that appears after a move and then goes.

        So the live region takes the `sr-only` recipe and reserves no layout at
        all, and a second, plain paragraph prints the same words visibly only
        while there are words. Both read the one `said`, so they cannot say
        different things — and the visible one is `aria-hidden` because the
        first one has already announced it.
      */}
      <p role="status" className="sr-only">
        {said}
      </p>

      {said !== null && (
        <p aria-hidden="true" className="m-0 text-pretty text-note text-foreground">
          {said}
        </p>
      )}

      <BlockTree
        tree={template.tree}
        labels={labels}
        selected={selected}
        onSelect={onSelect}
        onMove={move}
        focusOn={focusOn}
        drag={drag}
        actions={(block, { control, tabIndex }) => (
          <RowAction
            block={block}
            control={control}
            tabIndex={tabIndex}
            labels={labels}
            tree={template.tree}
            act={act}
            onMove={move}
            onAdd={add}
            onDuplicate={duplicate}
            onRemove={remove}
          />
        )}
      />

      {/*
        **After the tree in the DOM, and therefore after it in the tab order.**
        Selecting a row must not pull focus into here — focus belongs on the row
        the merchant is on, which is what makes ↑↓ keep working after a click —
        so `Tab` is the documented way in and the source order is what makes it
        land.

        That holds at both arrangements, which is why the split is a grid over
        this order rather than a reordering of it: the tree takes column one and
        this takes column two, so *beside* and *under* read the same to a
        keyboard and to a screen reader.
      */}
      <BlockInspector
        template={template}
        labels={labels}
        path={selected}
        act={act}
        onChange={onChange}
        /*
          A swap is worth saying out loud: it renames the row and it changes
          the Slot Roles derived from what a field captures, so the preview's
          key moves under a selection that has not. The row keeps focus — the
          merchant is in the inspector, and yanking them back to the list
          after an edit they made in the panel would be the tree answering a
          question they asked somewhere else.
        */
        onSwap={(next, sentence) => {
          onChange(next);
          setSaid(sentence);
        }}
      />
    </RegionBody>
  );
}

/**
 * One of a row's controls, drawn as what it does.
 *
 * ============================================================================
 * A DISABLED CONTROL IS `aria-disabled`, NEVER `disabled`.
 * ============================================================================
 * The tree is a roving tabindex: exactly one control in the whole grid is
 * tabbable and ← → walk between the controls in a row. A real `disabled`
 * attribute takes an element out of the focus order entirely, so ↓ onto the
 * first row and then → would step over a Move-up that is merely at the top of
 * its list — and on some rows and not others, which is worse than either.
 *
 * `aria-disabled` announces the state, keeps the control reachable, and the
 * handler declines. This is the shape the ARIA practices give for exactly this
 * case.
 */
function RowAction({
  block,
  control,
  tabIndex,
  labels,
  tree,
  act,
  onMove,
  onAdd,
  onDuplicate,
  onRemove,
}: {
  block: Block;
  control: Control;
  tabIndex: number;
  labels: TemplateLabels;
  tree: TemplateTree;
  act: ConvertingAct;
  onMove: (block: Block, by: number, control: number) => void;
  onAdd: (at: Spot, type: string) => void;
  onDuplicate: (block: Block) => void;
  onRemove: (block: Block) => void;
}) {
  const name = nameOfBlock(block, labels);

  if (control === 'up' || control === 'down') {
    const up = control === 'up';
    const stuck = up ? block.position === 1 : block.position === block.setSize;

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={tabIndex}
        aria-disabled={stuck}
        /*
          The control index is handed back so focus returns to THIS button
          after the row moves: pressing ↓ three times moves a block three
          places, rather than costing two arrow presses per move.
        */
        onClick={() => (stuck ? undefined : onMove(block, up ? -1 : 1, up ? 1 : 2))}
      >
        {up ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
        {/*
          **Named for the block it moves, not "Move up".** Fifteen buttons
          reading "Move up" are fifteen buttons a screen-reader user cannot tell
          apart — the `ChoiceGrid` problem, met again on a list ten times as
          long. Here the name carries it rather than `aria-describedby`, because
          a row is not a card with a heading to point at.
        */}
        <span className="sr-only">
          {up
            ? sprintf(
                /* translators: %s: which block, e.g. “Headline”. */
                __('Move %s up', 'wconvert'),
                name,
              )
            : sprintf(
                /* translators: %s: which block, e.g. “Headline”. */
                __('Move %s down', 'wconvert'),
                name,
              )}
        </span>
      </Button>
    );
  }

  const removal = whyRemovalIsRefused(tree, block.path);
  const copying = whyDuplicationIsRefused(tree, block.path);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" tabIndex={tabIndex}>
          <MoreHorizontal aria-hidden="true" />
          {/*
            Named for the block, like the arrows above it: fifteen buttons
            reading "More" are fifteen buttons a screen-reader user cannot tell
            apart.
          */}
          <span className="sr-only">
            {sprintf(
              /* translators: %s: which block, e.g. “Headline”. */
              __('Add, copy or delete %s', 'wconvert'),
              name,
            )}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-xs">
        {/*
          ==================================================================
          MOVE UP AND MOVE DOWN, FIRST, AND THEY ARE NOT A DUPLICATE.
          ==================================================================
          The row's ↑↓ buttons are hidden at rest and revealed on hover, focus
          and selection — which is a cleaner list and, on a touch screen, two
          controls that appear only after the row has been tapped. WCAG 2.2
          SC 2.5.7 asks for a single-pointer alternative to the drag that is
          **clickable or tappable**, and the menu is the path that is reachable
          without hovering anything and without knowing the tools are there.

          So the capability has three pointer paths and two keyboard ones, and
          the criterion is satisfied several times over rather than narrowly.
        */}
        {block.level > 1 && (
          <>
            <DropdownMenuItem
              disabled={block.position === 1}
              onSelect={() => onMove(block, -1, 0)}
            >
              <ArrowUp aria-hidden="true" />
              {__('Move up', 'wconvert')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={block.position === block.setSize}
              onSelect={() => onMove(block, 1, 0)}
            >
              <ArrowDown aria-hidden="true" />
              {__('Move down', 'wconvert')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {childKeysOf(block.type).map((key) => (
          <AddMenu
            key={key}
            tree={tree}
            act={act}
            labels={labels}
            at={{ parent: block.path, key, index: countAt(tree, block.path, key) }}
            label={
              childKeysOf(block.type).length > 1
                ? sprintf(
                    /* translators: %s: which pane of a side-by-side layout. */
                    __('Add to the %s', 'wconvert'),
                    key === 'start' ? __('first pane', 'wconvert') : __('second pane', 'wconvert'),
                  )
                : __('Add a block inside', 'wconvert')
            }
            onAdd={onAdd}
          />
        ))}

        {block.level > 1 && (
          <AddMenu
            tree={tree}
            act={act}
            labels={labels}
            at={nextTo(block)}
            label={__('Add a block after this', 'wconvert')}
            onAdd={onAdd}
          />
        )}

        {block.level > 1 && (
          <>
            <DropdownMenuSeparator />
            <Refusable reason={copying} onSelect={() => onDuplicate(block)}>
              <Copy aria-hidden="true" />
              {__('Duplicate', 'wconvert')}
            </Refusable>
            <Refusable reason={removal} destructive onSelect={() => onRemove(block)}>
              <Trash2 aria-hidden="true" />
              {block.holds === 0
                ? __('Delete', 'wconvert')
                : sprintf(
                    /* translators: %d: how many blocks are inside the one being deleted. */
                    __('Delete, and the %d inside it', 'wconvert'),
                    block.holds,
                  )}
            </Refusable>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A menu item that may be refused, with the refusal where the pointer already
 * is.
 *
 * **A greyed-out Delete with no explanation is a support ticket.** `guards.ts`
 * answers with a sentence rather than a boolean precisely so this can print it,
 * and printing it inside the item is what puts it in front of the merchant
 * without a second click — and in front of a screen reader, which reads the
 * whole item.
 */
function Refusable({
  reason,
  destructive = false,
  onSelect,
  children,
}: {
  reason: string | null;
  destructive?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenuItem
      variant={destructive && reason === null ? 'destructive' : 'default'}
      disabled={reason !== null}
      onSelect={onSelect}
      className="flex-col items-start gap-0.5"
    >
      <span className="flex items-center gap-2">{children}</span>
      {reason !== null && (
        <span className="text-pretty whitespace-normal text-muted-foreground">{reason}</span>
      )}
    </DropdownMenuItem>
  );
}

/**
 * Everything the vocabulary lets a merchant put here, and why the rest is not
 * on offer.
 *
 * The list is the manifest's, so a node type added to
 * `resources/templates/manifest.json` appears here with nothing edited — and a
 * refusal is shown rather than the row being dropped, because *"you cannot add
 * a second email field"* is an answer and a missing menu row is not.
 */
function AddMenu({
  tree,
  act,
  labels,
  at,
  label,
  onAdd,
}: {
  tree: TemplateTree;
  act: ConvertingAct;
  labels: TemplateLabels;
  at: Spot;
  label: string;
  onAdd: (at: Spot, type: string) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Plus aria-hidden="true" />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-w-xs">
        {additionsIn(tree, at, act).map((addition) => (
          <Refusable
            key={addition.type}
            reason={addition.refused}
            onSelect={() => onAdd(at, addition.type)}
          >
            {addition.leaf
              ? nameOf(labels.nodes, addition.type)
              : nameOf(labels.layouts, addition.type)}
          </Refusable>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** The spot immediately after a block, which is where an Add lands. */
function nextTo(block: Block): Spot {
  const spot = spotOf(block.path);

  return spot === null
    ? { parent: block.path, key: 'children', index: 0 }
    : { ...spot, index: spot.index + 1 };
}

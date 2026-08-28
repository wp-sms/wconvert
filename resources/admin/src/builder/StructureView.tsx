import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Copy,
  MoreHorizontal,
  Plus,
  Redo2,
  Trash2,
  Undo2,
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
import { EmptyState } from '../shell/EmptyState';
import { RegionBody } from '../shell/Region';
import { Toolbar } from '../shell/Toolbar';
import { BlockTree } from './BlockTree';
import { nameOfBlock, sentenceFor, type Control } from './BlockRow';
import { additionsIn, freeRoleFor, nodeFor, type ConvertingAct } from './structure/catalogue';
import { whyDuplicationIsRefused, whyRemovalIsRefused } from './structure/guards';
import {
  countAt,
  nodeAt,
  rolesLostBy,
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
import type { SlotKey } from './slots';
import type { Template, TemplateTree } from '@renderer/types';

/**
 * The **Structure** tab: what this design is made of, where each part sits, and
 * the five things a merchant may do to it.
 *
 * ============================================================================
 * IT IS A SECOND VIEW OF ONE DOCUMENT, NOT A SECOND DOCUMENT.
 * ============================================================================
 * Content and Structure edit the same `template`. Content answers *what does
 * this say*; Structure answers *what is here and in what order*. Splitting them
 * is what keeps the Content tab a readable column of words rather than a column
 * of words interleaved with move buttons — and it is why both stay: a merchant
 * fixing a typo should never have to walk past an arrangement control to reach
 * the sentence.
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
  readonly selected: SlotKey | null;
  readonly onSelect: (key: SlotKey | null, path: Path) => void;
  readonly onChange: (template: Template) => void;
  /** Undo and redo, held by the screen because they move the whole draft. */
  readonly history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
  };
}

export function StructureView({
  template,
  labels,
  act,
  selected,
  onSelect,
  onChange,
  history,
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
  const [focusOn, setFocusOn] = useState<Path | null>(null);

  if (template.tree.steps.length === 0) {
    return (
      <RegionBody>
        <EmptyState icon={Blocks} title={__('This design has nothing in it yet.', 'wconvert')}>
          {__('Pick a design on the Design tab and its blocks will be listed here.', 'wconvert')}
        </EmptyState>
      </RegionBody>
    );
  }

  const write = (tree: TemplateTree, focus: Path, sentence: string) => {
    onChange({ ...template, tree });
    setFocusOn(focus);
    setSaid(sentence);
  };

  const refuse = (reason: string) => {
    setFocusOn(null);
    setSaid(reason);
  };

  const move = (block: Block, by: number) => {
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
    const node = nodeFor(template.tree, type, at, act);

    if (node === null) {
      return;
    }

    const nameless = LEAVES[type] !== undefined && LEAVES[type].roles.length > 0 && freeRoleFor(template.tree, type) === null;
    const kind = LEAVES[type] === undefined ? nameOf(labels.layouts, type) : nameOf(labels.nodes, type);

    write(
      withInserted(template.tree, at, node),
      [...at.parent, at.key, at.index],
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

  return (
    <>
      {/*
        **Undo and redo are the region's, not a row's.** They act on the whole
        design rather than on one block, which is exactly the scope test
        ADR 0039 gives for a toolbar — and putting them beside a Delete they
        exist to reverse is what makes "no confirm" legible rather than
        reckless.
      */}
      <Toolbar>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 aria-hidden="true" />
          {__('Undo', 'wconvert')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!history.canRedo}
          onClick={history.redo}
        >
          <Redo2 aria-hidden="true" />
          {__('Redo', 'wconvert')}
        </Button>
      </Toolbar>

      <RegionBody className="wconvert-structure">
        <p className="m-0 text-pretty text-muted-foreground">
          {__(
            'Click a block to see it highlighted in the preview. Arrow keys move through the list; the buttons on each row move a block within the one it is in.',
            'wconvert',
          )}
        </p>

        {/*
          Present from the first render rather than mounted when there is
          something to say: a live region a screen reader has not been watching
          announces nothing the first time it fills.
        */}
        <p role="status" className="m-0 min-h-[1lh] text-pretty text-foreground">
          {said}
        </p>

        <BlockTree
          tree={template.tree}
          labels={labels}
          selected={selected}
          onSelect={onSelect}
          focusOn={focusOn}
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
      </RegionBody>
    </>
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
  onMove: (block: Block, by: number) => void;
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
        onClick={() => (stuck ? undefined : onMove(block, up ? -1 : 1))}
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

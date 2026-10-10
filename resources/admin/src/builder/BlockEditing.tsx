import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
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
import { referencedJourney } from './structure/journey';
import { useBlockDrag } from './useBlockDrag';
import { BlockTree } from './BlockTree';
import { nameOfBlock, sentenceFor, type Control } from './BlockRow';
import { additionsIn, nodeFor, type ConvertingAct, type Addition } from './structure/catalogue';
import { whyDuplicationIsRefused, whyRemovalIsRefused } from './structure/guards';
import {
  countAt,
  capturesTaken,
  nodeAt,
  nodesOf,
  spotOf,
  withDuplicated,
  withInserted,
  withMoved,
  withRemoved,
  type Block,
  type Spot,
} from './structure/tree';
import { FIELDS, LEAVES, childKeysOf, type Path } from './panel';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template, TemplateTree } from '@renderer/types';

/**
 * Moving, copying, removing and adding the blocks of one design, as one hook.
 *
 * Extracted from the Design tab's `StructureView` when the Edit tab's left
 * tree took over its job (ADR 0134): the operations, their refusals and the
 * sentences they announce are the same wherever a block list is drawn, so
 * they live once. What a caller draws — a tree inside a screen row, a list in
 * a drawer — is its own.
 */
export interface BlockEditsOptions {
  readonly template: Template;
  readonly labels: TemplateLabels;
  readonly act: ConvertingAct;
  readonly step?: number;
  readonly selected: Path | null;
  readonly onSelect: (path: Path) => void;
  readonly onChange: (template: Template, coalesce?: string) => void;
  readonly onUndo?: () => void;
  /** The whole draft, so an edit elsewhere retires a stale "Undo delete". */
  readonly draft?: unknown;
  /** A request to move focus to one row, e.g. from the readiness review. */
  readonly focus?: { readonly path: Path } | null;
}

export function useBlockEdits({ template, labels, act, step, selected, onSelect, onChange, onUndo, draft, focus = null }: BlockEditsOptions) {
  const [said, setSaid] = useState<string | null>(null);
  /*
   * A removal Undo can take back. Shown until the next change to the design —
   * an edit, a move or the Undo itself — because after that "Undo" would undo
   * something else. `fresh` lets the removal's own change through.
   */
  const [removal, setRemoval] = useState<{ path: Path; name: string } | null>(null);
  const fresh = useRef(false);
  const seen = useRef({ template, draft });
  useEffect(() => {
    if (seen.current.template === template && seen.current.draft === draft) return;
    seen.current = { template, draft };
    if (fresh.current) fresh.current = false;
    else setRemoval(null);
  }, [template, draft]);

  const [focusOn, setFocusOn] = useState<{ path: Path; control: number } | null>(null);

  useEffect(() => {
    if (focus !== null) {
      setFocusOn({ path: focus.path, control: 0 });
    }
  }, [focus]);

  const blocks = useMemo(() => nodesOf(template.tree), [template.tree]);
  const insertionBlock = blocks.find(block => block.path.join('.') === selected?.join('.'))
    ?? blocks.find(block => block.level === 1 && block.path[0] === (step ?? 0));

  const write = (tree: TemplateTree, path: Path, control: number, sentence: string) => {
    onChange({ ...template, tree: referencedJourney(tree) });
    setFocusOn({ path, control });
    setSaid(sentence);
    setRemoval(null);

    onSelect(path);
  };

  const refuse = (reason: string) => {
    setFocusOn(null);
    setSaid(reason);
    setRemoval(null);
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
      sprintf(__('%s removed. Undo brings it back.', 'wconvert'), sentenceFor(block, labels)),
    );
    // Read at render rather than now: the screen offers Undo only once there
    // is a step to go back to, which a first edit is what creates.
    setRemoval({ path: block.path, name: sentenceFor(block, labels) });
    fresh.current = true;
  };

  const undoRemoval = () => {
    if (removal === null || onUndo === undefined) return;
    // The block is back where it was, so focus goes to its row rather than
    // to `<body>` when this button leaves the screen. The selection follows
    // on its own: it moved to the sibling now at this path.
    setFocusOn({ path: removal.path, control: 0 });
    setRemoval(null);
    setSaid(null);
    onUndo();
  };

  const duplicate = (block: Block) => {
    const refused = whyDuplicationIsRefused(template.tree, block.path);
    const spot = spotOf(block.path);

    if (refused !== null || spot === null) {
      refuse(refused ?? '');

      return;
    }

    write(
      withDuplicated(template.tree, block.path),
      [...spot.parent, spot.key, spot.index + 1],
      0,
      sprintf(__('%s copied.', 'wconvert'), sentenceFor(block, labels)),
    );
  };

  const add = (at: Spot, type: string, capture?: string) => {
    const bare = nodeFor(template.tree, type, at, act, capture);

    if (bare === null) {
      return;
    }

    const node =
      type === 'field' && typeof (bare as { name?: string }).name === 'string'
        ? ({
            ...bare,
            label: nameOf(labels.fields, (bare as { name: string }).name),
            placeholder: nameOf(labels.placeholders, (bare as { name: string }).name),
          } as typeof bare)
        : bare;

    const kind = capture ? nameOf(labels.fields, capture) : LEAVES[type] === undefined ? nameOf(labels.layouts, type) : nameOf(labels.nodes, type);

    write(
      withInserted(template.tree, at, node),
      [...at.parent, at.key, at.index],
      0,
      sprintf(__('%s added.', 'wconvert'), kind),
    );
  };

  const drag = useBlockDrag({
    // A drop leaves focus nowhere in particular — the pointer did the work —
    // so it asks for the moved block's name rather than a button beside it.
    onMove: (block, by) => move(block, by, 0),
    blocks,
  });


  const undoable = removal !== null && onUndo !== undefined;
  /** One live region: announced throughout, drawn only while it carries an Undo. */
  const notice = (
    <div className={undoable ? 'wconvert-layer-notice' : 'sr-only'}>
      <p role="status" aria-label={__('Layer changes', 'wconvert')}>
        {undoable ? sprintf(__('%s removed.', 'wconvert'), removal.name) : said}
      </p>
      {undoable && <Button type="button" variant="ghost" size="xs" onClick={undoRemoval}>{__('Undo delete', 'wconvert')}</Button>}
    </div>
  );
  const rowAction = (block: Block, { control, tabIndex }: { control: Control; tabIndex: number }) => (
    <RowAction block={block} control={control} tabIndex={tabIndex} labels={labels} tree={template.tree} act={act}
      onMove={move} onAdd={add} onDuplicate={duplicate} onRemove={remove} />
  );
  const picker = insertionBlock
    ? <AddElementPicker key={insertionBlock.path.join('.')} block={insertionBlock} tree={template.tree} act={act} labels={labels} onAdd={add} />
    : null;
  return { move, remove, duplicate, add, focusOn, drag, said, setSaid, notice, rowAction, picker };
}

/**
 * One screen's elements, as the Edit tree nests them under the screen's row:
 * the block list without the screen's own root box, each row's ⋯ menu, an
 * "Add element" picker, and the one live region that announces what changed.
 */
export function ScreenElements(props: BlockEditsOptions & {
  readonly step: number;
  /** A sentence from elsewhere to announce here, e.g. the element panel's ⇄ swap. */
  readonly announcement?: { readonly said: string; readonly serial: number } | null;
}) {
  const edits = useBlockEdits(props);
  const { setSaid } = edits;
  useEffect(() => { if (props.announcement) setSaid(props.announcement.said); }, [props.announcement, setSaid]);
  return <>
    <BlockTree tree={props.template.tree} step={props.step} withoutRoot labels={props.labels} selected={props.selected}
      onSelect={props.onSelect} onMove={edits.move} focusOn={edits.focusOn} drag={edits.drag} actions={edits.rowAction} />
    <div className="wconvert-edit-tree__add-element">{edits.picker}</div>
    {edits.notice}
  </>;
}

export function RowAction({
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
  onAdd: (at: Spot, type: string, capture?: string) => void;
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
        size="icon-xs"
        tabIndex={tabIndex}
        aria-disabled={stuck}
        onClick={() => (stuck ? undefined : onMove(block, up ? -1 : 1, up ? 1 : 2))}
      >
        {up ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}

        <span className="sr-only">
          {up ? sprintf(__('Move %s up', 'wconvert'), name) : sprintf(__('Move %s down', 'wconvert'), name)}
        </span>
      </Button>
    );
  }

  const removal = whyRemovalIsRefused(tree, block.path);
  const copying = whyDuplicationIsRefused(tree, block.path);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" tabIndex={tabIndex}>
          <MoreHorizontal aria-hidden="true" />

          <span className="sr-only">{sprintf(__('Add, copy or delete %s', 'wconvert'), name)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="wconvert-layer-menu max-w-xs" align="end">
        {block.level > 1 && (
          <>
            <DropdownMenuItem disabled={block.position === 1} onSelect={() => onMove(block, -1, 0)}>
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

        <InsertionMenus block={block} tree={tree} act={act} labels={labels} onAdd={onAdd} />

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
                : sprintf(__('Delete, and the %d inside it', 'wconvert'), block.holds)}
            </Refusable>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AddElementPicker({ block, tree, act, labels, onAdd }: {
  block: Block; tree: TemplateTree; act: ConvertingAct; labels: TemplateLabels;
  onAdd: (at: Spot, type: string, capture?: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('0');
  const added = useRef(false);
  const places: { label: string; at: Spot }[] = [];
  const spot = spotOf(block.path);
  if (spot) places.push(
    { label: sprintf(__('After %s', 'wconvert'), nameOfBlock(block, labels)), at: { ...spot, index: spot.index + 1 } },
    { label: sprintf(__('Before %s', 'wconvert'), nameOfBlock(block, labels)), at: spot },
  );
  const keys = childKeysOf(block.type);
  keys.forEach(key => {
    const name = keys.length > 1 ? key === 'start' ? __('first pane', 'wconvert') : __('second pane', 'wconvert') : nameOfBlock(block, labels);
    places.push(
      { label: sprintf(__('At the beginning of %s', 'wconvert'), name), at: { parent: block.path, key, index: 0 } },
      { label: sprintf(__('At the end of %s', 'wconvert'), name), at: { parent: block.path, key, index: countAt(tree, block.path, key) } },
    );
  });
  const at = (places[Number(position)] ?? places[0])?.at;
  const choices = at ? additionsIn(tree, at, act).flatMap<Addition & { capture?: string; label: string; note: string }>(addition => addition.type === 'field'
    ? FIELDS.map(capture => ({ ...addition, capture, label: nameOf(labels.fields, capture), refused: addition.refused ?? (capturesTaken(tree).includes(capture) ? __('Already on this form', 'wconvert') : null), note: '' }))
    : [{ ...addition, capture: undefined, label: nameOf(addition.leaf ? labels.nodes : labels.layouts, addition.type), note: addition.leaf ? '' : nameOf(labels.layoutNotes, addition.type) }]) : [];
  const shown = choices.filter(choice => `${choice.label} ${choice.note}`.toLowerCase().includes(search.toLowerCase()));
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) { setSearch(''); added.current = false; } }}>
    <PopoverTrigger asChild><Button variant="outline" size="xs"><Plus aria-hidden="true" />{__('Add element', 'wconvert')}</Button></PopoverTrigger>
    <PopoverContent side="right" align="start" collisionPadding={12} className="wconvert-add-picker" onCloseAutoFocus={event => { if (added.current) event.preventDefault(); }}>
      <strong>{__('Add element', 'wconvert')}</strong>
      <label htmlFor={`${id}-position`}>{__('Insert position', 'wconvert')}</label>
      <select id={`${id}-position`} value={position} onChange={e => setPosition(e.target.value)}>{places.map((place, index) => <option key={index} value={index}>{place.label}</option>)}</select>
      <label htmlFor={`${id}-search`} className="sr-only">{__('Find an element', 'wconvert')}</label>
      <input id={`${id}-search`} type="search" placeholder={__('Find an element…', 'wconvert')} value={search} onChange={e => setSearch(e.target.value)} />
      <div className="wconvert-add-picker__list">
        {shown.map(choice => <button type="button" key={choice.capture ?? choice.type} disabled={!!choice.refused} onClick={() => {
          if (!at) return;
          added.current = true; setOpen(false); onAdd(at, choice.type, choice.capture);
        }}><span>{choice.label}</span>{(choice.refused || choice.note) && <small>{choice.refused || choice.note}</small>}</button>)}
        {shown.length === 0 && <p role="status">{__('No matching elements.', 'wconvert')}</p>}
      </div>
    </PopoverContent>
  </Popover>;
}

function InsertionMenus({ block, tree, act, labels, onAdd }: {
  block: Block; tree: TemplateTree; act: ConvertingAct; labels: TemplateLabels;
  onAdd: (at: Spot, type: string, capture?: string) => void;
}) {
  const spot = spotOf(block.path);
  return <>
    {spot && <>
      <AddMenu tree={tree} act={act} labels={labels} at={spot} label={__('Add a block before this', 'wconvert')} onAdd={onAdd} />
      <AddMenu tree={tree} act={act} labels={labels} at={{ ...spot, index: spot.index + 1 }} label={__('Add a block after this', 'wconvert')} onAdd={onAdd} />
    </>}
    {childKeysOf(block.type).map(key => <DropdownMenuSub key={key}>
      <DropdownMenuSubTrigger><Plus aria-hidden="true" />{childKeysOf(block.type).length > 1
        ? sprintf(__('Add to the %s', 'wconvert'), key === 'start' ? __('first pane', 'wconvert') : __('second pane', 'wconvert'))
        : __('Add a block inside', 'wconvert')}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="wconvert-layer-menu">
        <AddMenu tree={tree} act={act} labels={labels} at={{ parent: block.path, key, index: 0 }} label={__('At the beginning', 'wconvert')} onAdd={onAdd} />
        <AddMenu tree={tree} act={act} labels={labels} at={{ parent: block.path, key, index: countAt(tree, block.path, key) }} label={__('At the end', 'wconvert')} onAdd={onAdd} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>)}
  </>;
}

function Refusable({
  reason,
  note = null,
  destructive = false,
  onSelect,
  children,
}: {
  reason: string | null;

  note?: string | null;
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

      {(reason ?? note) !== null && (
        <span className="text-micro font-normal tracking-normal text-pretty whitespace-normal text-muted-foreground">
          {reason ?? note}
        </span>
      )}
    </DropdownMenuItem>
  );
}

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
  onAdd: (at: Spot, type: string, capture?: string) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Plus aria-hidden="true" />
        {label}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="wconvert-layer-menu wconvert-add-elements max-h-[min(440px,var(--radix-dropdown-menu-content-available-height))]">
        {additionsIn(tree, at, act).map((addition) => addition.type === 'field' && addition.refused === null ? (
          <DropdownMenuSub key="field"><DropdownMenuSubTrigger>{nameOf(labels.nodes, 'field')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="wconvert-layer-menu">{FIELDS.map(capture => <Refusable key={capture} reason={capturesTaken(tree).includes(capture) ? __('Already on this form', 'wconvert') : null} onSelect={() => onAdd(at, 'field', capture)}>{nameOf(labels.fields, capture)}</Refusable>)}</DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <Refusable
            key={addition.type}
            reason={addition.refused}
            note={addition.leaf ? null : nameOf(labels.layoutNotes, addition.type)}
            onSelect={() => onAdd(at, addition.type)}
          >
            {addition.leaf ? nameOf(labels.nodes, addition.type) : nameOf(labels.layouts, addition.type)}
          </Refusable>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

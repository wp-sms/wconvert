import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowDown, ArrowUp, Blocks, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
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
import { BlockInspector } from './BlockInspector';
import { BlockTree } from './BlockTree';
import { useBlockDrag } from './useBlockDrag';
import { nameOfBlock, sentenceFor, type Control } from './BlockRow';
import { additionsIn, nodeFor, type ConvertingAct } from './structure/catalogue';
import { whyDuplicationIsRefused, whyRemovalIsRefused } from './structure/guards';
import {
  countAt,
  nodeAt,
  nodesOf,
  rolesLostBy,
  spotOf,
  withDuplicated,
  withInserted,
  withMoved,
  withRemoved,
  type Block,
  type Spot,
} from './structure/tree';
import { LEAVES, childKeysOf, type Path, type WidthBag } from './panel';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template, TemplateTree } from '@renderer/types';

export interface StructureViewProps {
  readonly template: Template;
  readonly labels: TemplateLabels;

  readonly act: ConvertingAct;

  readonly selected: Path | null;
  readonly onSelect: (path: Path) => void;

  readonly onChange: (template: Template, coalesce?: string) => void;

  readonly focus: { readonly path: Path } | null;

  readonly endsAt?: string;

  readonly onSetEndDate?: () => void;

  readonly preview?: ReactNode;

  readonly toolbar?: ReactNode;

  readonly checks?: ReactNode;

  readonly look?: ReactNode;

  readonly width?: WidthBag;
  readonly showLayers?: boolean;
  readonly onShowLayers?: () => void;
  readonly onDesign?: () => void;
  readonly step?: number;
}

export function StructureView({
  template,
  labels,
  act,
  selected,
  onSelect,
  onChange,
  focus,
  endsAt,
  onSetEndDate,
  preview,
  toolbar,
  checks,
  look,
  showLayers = true,
  onShowLayers,
  onDesign,
  step,
}: StructureViewProps) {
  const [said, setSaid] = useState<string | null>(null);

  const [focusOn, setFocusOn] = useState<{ path: Path; control: number } | null>(null);

  useEffect(() => {
    if (focus !== null) {
      setFocusOn({ path: focus.path, control: 0 });
    }
  }, [focus]);

  const blocks = useMemo(() => nodesOf(template.tree), [template.tree]);

  const write = (tree: TemplateTree, path: Path, control: number, sentence: string) => {
    onChange({ ...template, tree });
    setFocusOn({ path, control });
    setSaid(sentence);

    onSelect(path);
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
        ? sprintf(__('%s copied.', 'wconvert'), sentenceFor(block, labels))
        : sprintf(
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

    const node =
      type === 'field' && typeof (bare as { name?: string }).name === 'string'
        ? ({
            ...bare,
            label: nameOf(labels.fields, (bare as { name: string }).name),
            placeholder: nameOf(labels.placeholders, (bare as { name: string }).name),
          } as typeof bare)
        : bare;

    const kind = LEAVES[type] === undefined ? nameOf(labels.layouts, type) : nameOf(labels.nodes, type);

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

  if (template.tree.steps.length === 0) {
    return (
      <RegionBody>
        {toolbar}
        <EmptyState icon={Blocks} title={__('This design has nothing in it yet', 'wconvert')}>
          {__('Pick a design on the Design tab and its blocks will be listed here.', 'wconvert')}
        </EmptyState>
      </RegionBody>
    );
  }

  return (
    <>
      {toolbar}

      <p role="status" aria-label={__('Layer changes', 'wconvert')} className="sr-only">
        {said}
      </p>

      {said !== null && (
        <p aria-hidden="true" className="wconvert-said">
          {said}
        </p>
      )}

      <div className="wconvert-panes" data-layers={showLayers ? 'true' : 'false'}>
        {showLayers && (
          <div className="wconvert-pane wconvert-pane--layers">
            <div className="wconvert-pane__stick">
              <div className="wconvert-pane__head">
                <span className="wconvert-pane__name">{__('Layers', 'wconvert')}</span>
              </div>
              <div className="wconvert-pane__body">
                <BlockTree
                  tree={template.tree}
                  step={step}
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
              </div>
            </div>
          </div>
        )}

        <div className="wconvert-pane wconvert-pane--render">
          <div className="wconvert-pane__stick">{preview}</div>
        </div>

        <div className="wconvert-pane wconvert-pane--controls">
          <div className="wconvert-pane__stick">
            <div className="wconvert-pane__body">
              <BlockInspector
                template={template}
                labels={labels}
                path={selected}
                act={act}
                onChange={onChange}
                onSwap={(next, sentence) => {
                  onChange(next);
                  setSaid(sentence);
                }}
                endsAt={endsAt}
                onSetEndDate={onSetEndDate}
                look={look}
                onSelect={onSelect}
                onDesign={onDesign}
                onShowLayers={onShowLayers}
              />
            </div>
          </div>
        </div>
      </div>

      {checks}
    </>
  );
}

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
      <DropdownMenuContent align="end" className="max-w-xs">
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
                : sprintf(__('Delete, and the %d inside it', 'wconvert'), block.holds)}
            </Refusable>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  onAdd: (at: Spot, type: string) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Plus aria-hidden="true" />
        {label}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="max-w-sm">
        {additionsIn(tree, at, act).map((addition) => (
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

function nextTo(block: Block): Spot {
  const spot = spotOf(block.path);

  return spot === null
    ? { parent: block.path, key: 'children', index: 0 }
    : { ...spot, index: spot.index + 1 };
}

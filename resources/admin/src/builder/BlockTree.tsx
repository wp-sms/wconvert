import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { BlockRow, controlsOf, type Control } from './BlockRow';
import { nodesOf, type Block } from './structure/tree';
import { keyOfSlot, type SlotKey } from './slots';
import type { Path } from './panel';
import type { TemplateLabels } from '../templates/api';
import type { BlockDrag } from './useBlockDrag';
import type { TemplateTree } from '@renderer/types';

/**
 * The design's blocks, as a `treegrid` a keyboard can walk.
 *
 * ============================================================================
 * THE INTERACTION IS GUTENBERG'S LIST VIEW, VENDORED (ADR 0036).
 * ============================================================================
 * WordPress ships `TreeGrid`, `TreeGridRow` and `TreeGridCell` in
 * `@wordpress/components`, with the `level`/`positionInSet`/`setSize` props
 * this file's rows carry — and taking that package would drag the whole
 * `@wordpress/*` component tree into a bundle that currently imports two of its
 * packages for `apiFetch` and `__`. ADR 0036's answer to exactly this shape is
 * to **vendor the behaviour**: the keys, the roles and the roving tabindex are
 * copied, the dependency is not.
 *
 * Copied rather than invented, because the merchant already knows them:
 *
 * - **↑ ↓** move between rows.
 * - **← →** move between the controls inside a row. From the first control,
 *   → expands a collapsed block and ← collapses an expanded one, then walks to
 *   the parent — which is what makes the tree navigable with two keys.
 * - **Home / End** go to the first and last row.
 * - **Exactly one tab stop for the whole grid**, so the tree costs a merchant
 *   tabbing to Save one press rather than sixty.
 *
 * ============================================================================
 * ← AND → INVERT UNDER RTL, AND IT IS READ RATHER THAN ASSUMED.
 * ============================================================================
 * The admin is verified 44/44 under `fa_IR` and every box in it uses logical
 * properties. An arrow key is the one thing a logical property cannot fix:
 * "next control" is physically ← in Persian, so a hard-coded `ArrowRight` walks
 * the row backwards for every RTL merchant and does it silently.
 *
 * The direction is read off the rendered element rather than off a locale
 * string, because that is what is actually true of the box the keys are being
 * pressed in.
 */

export interface BlockTreeProps {
  readonly tree: TemplateTree;
  readonly labels: TemplateLabels;
  /** The slot drawn as selected, named the way `slots.ts` names it. */
  readonly selected: SlotKey | null;
  readonly onSelect: (key: SlotKey | null, path: Path) => void;
  /**
   * ↑, ↓ and the menu for one row. Absent while the tree only shows and
   * selects — the read-only tree is a whole shippable thing, and it is what
   * proves selection travels before anything can move.
   */
  readonly actions?: (block: Block, props: { control: Control; tabIndex: number }) => ReactNode;
  /**
   * Where focus should be after the tree redraws: a row, and which of its
   * controls.
   *
   * **Focus must never land on `<body>`.** A block that was deleted takes its
   * row with it, and a caller that knows what it deleted knows what should hold
   * focus instead — the next sibling, else the parent. The tree cannot work
   * that out afterwards, because by then the row is gone.
   *
   * **The control is named, and that is not a detail.** A merchant moving a
   * block three places presses ↓ three times, and the row moves under the
   * pointer each time — so landing them back on the block's NAME would cost two
   * arrow presses per move for a keyboard merchant and a re-aim for everyone
   * else. Pressing a button and having it still be under you afterwards is what
   * makes the buttons the primary mechanism rather than a technicality that
   * satisfies SC 2.5.7.
   */
  readonly focusOn?: { readonly path: Path; readonly control: number } | null;
  /**
   * Dragging, where it is switched on.
   *
   * Optional, and handed straight to each row. Drag is strictly additive
   * (WCAG 2.2 SC 2.5.7) — the tree navigates and reorders identically without
   * it, which is the acceptance criterion {@see useBlockDrag} is written
   * against.
   */
  readonly drag?: BlockDrag;
}

export function BlockTree({
  tree,
  labels,
  selected,
  onSelect,
  actions,
  focusOn = null,
  drag,
}: BlockTreeProps) {
  const grid = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<readonly string[]>([]);
  /*
   * The roving tab stop, as a row path and a control index rather than as a
   * row NUMBER. A number is an address into a list that a move or a delete
   * renumbers — the tab stop would follow the position rather than the block,
   * which is the opposite of what a merchant who just moved something expects.
   */
  const [at, setAt] = useState<{ path: string; control: number }>({ path: '', control: 0 });
  /*
   * Whether the next render should MOVE focus, or only mark where the tab stop
   * is. Clicking a row sets the tab stop and already has focus; an arrow key
   * sets it and has to send focus after it. Without the distinction, every
   * re-render of a tree the merchant is not looking at pulls focus into it.
   */
  const [taking, setTaking] = useState(false);

  const blocks = useMemo(() => nodesOf(tree), [tree]);
  const rows = useMemo(() => shown(blocks, collapsed), [blocks, collapsed]);

  const current = Math.max(
    0,
    rows.findIndex((block) => keyFor(block.path) === at.path),
  );

  /*
   * **Re-resolved from the tree on every render, never held across one.** The
   * server replaces the tree wholesale on save, so a row index or a node
   * reference kept from before a save points at whatever now occupies that
   * position. A path is a fact about the design; everything else here is a
   * fact about one render of it.
   */
  useEffect(() => {
    if (focusOn === null) {
      return;
    }

    setAt({ path: keyFor(focusOn.path), control: focusOn.control });
    setTaking(true);
  }, [focusOn]);

  const goTo = (row: number, control: number) => {
    const block = rows[row];

    if (block === undefined) {
      return;
    }

    setAt({ path: keyFor(block.path), control: Math.min(control, controlsOf(block).length - 1) });
    setTaking(true);
  };

  const expand = (block: Block, open: boolean) =>
    setCollapsed((current) =>
      open ? current.filter((path) => path !== keyFor(block.path)) : [...current, keyFor(block.path)],
    );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const block = rows[current];

    if (block === undefined) {
      return;
    }

    const controls = controlsOf(block);
    const rtl = grid.current !== null && getComputedStyle(grid.current).direction === 'rtl';
    // The physical key, read as the direction it means HERE.
    const key = rtl ? mirrored(event.key) : event.key;

    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (key === 'ArrowDown') {
      handled();
      goTo(Math.min(current + 1, rows.length - 1), at.control);

      return;
    }

    if (key === 'ArrowUp') {
      handled();
      goTo(Math.max(current - 1, 0), at.control);

      return;
    }

    if (key === 'Home') {
      handled();
      goTo(0, 0);

      return;
    }

    if (key === 'End') {
      handled();
      goTo(rows.length - 1, 0);

      return;
    }

    if (key === 'ArrowRight') {
      handled();

      // From the first control, → opens what is closed. Only then does it walk
      // along the row — so a merchant exploring the tree never has to know
      // there are controls out there to walk to.
      if (at.control === 0 && block.holds > 0 && isCollapsed(collapsed, block)) {
        expand(block, true);

        return;
      }

      goTo(current, Math.min(at.control + 1, controls.length - 1));

      return;
    }

    if (key === 'ArrowLeft') {
      handled();

      if (at.control > 0) {
        goTo(current, at.control - 1);

        return;
      }

      if (block.holds > 0 && !isCollapsed(collapsed, block)) {
        expand(block, false);

        return;
      }

      // Closed already, or holding nothing: out to whatever holds this.
      const parent = rows.findIndex((row) => keyFor(row.path) === keyFor(block.path.slice(0, -2)));

      if (parent !== -1) {
        goTo(parent, 0);
      }
    }
  };

  return (
    <div
      ref={grid}
      role="treegrid"
      aria-label={__('Blocks in this design', 'wconvert')}
      /*
        **The grid is focusable programmatically and tabbable never.** The tab
        stop belongs to a CELL — that is what a roving tabindex is, and it is
        why the grid costs a merchant tabbing to Save one press rather than
        sixty. `-1` is what lets a caller put focus back on the container when
        the row that had it has just been deleted, without adding a stop.
      */
      tabIndex={-1}
      className="wconvert-blocks"
      onKeyDown={onKeyDown}
      /*
        Focus leaving the grid ends the "an arrow key moved me" state, so the
        next render does not yank it back in. The tab stop itself stays where
        it was, which is what makes shift-tabbing out and back in return the
        merchant to the row they left.
      */
      onBlur={(event) =>
        event.currentTarget.contains(event.relatedTarget) ? undefined : setTaking(false)
      }
    >
      {rows.map((block, row) => {
        const key = keyOfSlot(block);

        return (
          <BlockRow
            key={keyFor(block.path)}
            block={block}
            labels={labels}
            focused={row === current ? at.control : null}
            takeFocus={taking}
            selected={key !== null && key === selected}
            expanded={block.holds === 0 ? null : !isCollapsed(collapsed, block)}
            onExpand={(open) => expand(block, open)}
            onSelect={() => {
              setAt({ path: keyFor(block.path), control: 0 });
              onSelect(key, block.path);
            }}
            onFocusControl={(control) => setAt({ path: keyFor(block.path), control })}
            actions={actions === undefined ? undefined : (props) => actions(block, props)}
            drag={drag}
          />
        );
      })}
    </div>
  );
}

/**
 * A path as the one string everything here keys by.
 *
 * Not stored in the tree, and that is the point: only the keys the manifest
 * declares survive `TemplateVocabulary::normalize()`, so a node id written into
 * the design would vanish at the first save and take the collapse state, the
 * tab stop and the React key with it.
 */
const keyFor = (path: Path): string => path.join('.');

const isCollapsed = (collapsed: readonly string[], block: Block): boolean =>
  collapsed.includes(keyFor(block.path));

/** Every block whose ancestors are all open. */
function shown(blocks: readonly Block[], collapsed: readonly string[]): Block[] {
  if (collapsed.length === 0) {
    return [...blocks];
  }

  return blocks.filter((block) =>
    !collapsed.some((path) => keyFor(block.path).startsWith(`${path}.`)),
  );
}

/** The same arrow, as the direction it means in a right-to-left box. */
const mirrored = (key: string): string =>
  key === 'ArrowLeft' ? 'ArrowRight' : key === 'ArrowRight' ? 'ArrowLeft' : key;

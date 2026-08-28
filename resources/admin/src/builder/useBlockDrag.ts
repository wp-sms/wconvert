import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine';
import type { Block } from './structure/tree';

/**
 * Dragging a block onto another position in the same list.
 *
 * ============================================================================
 * DELETE THIS FILE AND THE EDITOR STILL WORKS. THAT IS THE ACCEPTANCE TEST.
 * ============================================================================
 * Drag is **strictly additive**. WCAG 2.2 SC 2.5.7 (AA) requires a
 * single-pointer alternative to any dragging movement, and W3C is explicit that
 * a keyboard equivalent does not satisfy it *"unless that equivalent keyboard
 * operation also provides controls that can be clicked or tapped"* — its own
 * cited example being *"sortable lists: adjacent controls for moving elements up
 * or down"*. ADR 0038 sets AA as this admin's bar.
 *
 * So ↑ and ↓ are the mechanism and this is a second way to reach it. It writes
 * nothing of its own: a drop computes a distance and hands it to the same
 * `withMoved` the buttons call. Its coupling to the rest of the editor is one
 * hook call in {@see StructureView} and one effect in {@see BlockRow}; removing
 * those two leaves an editor that moves, adds, deletes and copies exactly as it
 * did.
 *
 * ============================================================================
 * IT IS POINTER-ONLY, AND THAT IS STATED RATHER THAN HOPED FOR.
 * ============================================================================
 * The element adapter is built on the browser's own drag-and-drop, which **does
 * not fire on touch**. A merchant on a tablet reorders with the buttons, and
 * they are there for exactly this reason rather than as a fallback nobody
 * expected to need. Claiming touch drag and shipping a list that does nothing
 * under a finger would be worse than a list that never offered it.
 *
 * ============================================================================
 * WHY PRAGMATIC, MEASURED RATHER THAN ASSUMED.
 * ============================================================================
 * `@atlaskit/pragmatic-drag-and-drop` 3.0.0, published 14 Aug 2026, against
 * `@dnd-kit/core` 6.3.1 — last published Dec 2024, some twenty months stale —
 * and `@dnd-kit/react` 0.5.0, a 0.x rewrite still churning. It is a
 * framework-agnostic vanilla-TS core under 4KB, it lands in the lazy builder
 * chunk with everything else under `builder/`
 * (`tests/js/admin-split.test.ts`), and **its own accessibility guidance is
 * this design**: *"always provide alternatives to dragging"*, plus a live region
 * naming *"the item being moved, as well as its old and new position"* — which
 * is the sentence {@see StructureView} was already saying for the buttons.
 *
 * It ships no keyboard drag. That is not a gap here: the buttons are mandatory,
 * so a keyboard merchant already has the whole capability, and a second keyboard
 * path to the same thing would be a second set of keys to learn.
 */

/** Which side of a row the block would land on. */
export type Edge = 'before' | 'after';

/** What one row needs from the drag, and what it reports back to it. */
export interface BlockDrag {
  /**
   * Make one row draggable and droppable. Returns the teardown, so a row can
   * call it straight from an effect.
   *
   * Addressed by path STRING rather than by the {@link Block} itself, because
   * `nodesOf` builds fresh objects on every render — an effect keyed on a block
   * would re-register every listener in the tree on every keystroke, and one
   * keyed on a path re-registers only when the design actually changes.
   */
  readonly attach: (path: string, row: HTMLElement, handle: HTMLElement) => () => void;
  /** The block currently being dragged, as a path string. */
  readonly dragging: string | null;
  /** Where it would land, as the row it is over and which side. */
  readonly over: { readonly path: string; readonly edge: Edge } | null;
}

export function useBlockDrag({
  blocks,
  onMove,
}: {
  readonly blocks: readonly Block[];
  /** The same call the ↑↓ buttons make. Nothing here writes a tree. */
  readonly onMove: (block: Block, by: number) => void;
}): BlockDrag {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ path: string; edge: Edge } | null>(null);

  /*
   * The current blocks, readable from a listener registered long before them.
   * The listeners are attached per row and live across every redraw of the
   * tree; a `blocks` captured in that closure would be the list as it was when
   * the row first mounted.
   */
  const latest = useRef(blocks);

  latest.current = blocks;

  /*
   * **The drop, reading the latest tree without re-subscribing.** This is what
   * `useEffectEvent` is for: `monitorForElements` is registered once in an
   * effect below, and a plain callback in its dependency list would tear the
   * monitor down and rebuild it on every render — mid-drag, which ends the drag.
   */
  const drop = useEffectEvent((sourcePath: string, targetPath: string, edge: Edge) => {
    const from = latest.current.find((block) => key(block) === sourcePath);
    const to = latest.current.find((block) => key(block) === targetPath);

    if (from === undefined || to === undefined || !siblings(from, to)) {
      return;
    }

    // Positions are 1-based; the arithmetic is not. Landing AFTER a row that
    // sits below the one being dragged closes the gap the drag itself opens,
    // which is the off-by-one every list reorder has.
    const source = from.position - 1;
    const wanted = to.position - 1 + (edge === 'after' ? 1 : 0);
    const target = wanted > source ? wanted - 1 : wanted;

    if (target !== source) {
      onMove(from, target - source);
    }
  });

  useEffect(
    () =>
      monitorForElements({
        onDrop: ({ source, location }) => {
          setDragging(null);
          setOver(null);

          const target = location.current.dropTargets[0];

          /*
           * **No drop target is a CANCEL, and that covers Escape.** The browser
           * ends a drag on Escape by firing the drop with nothing under the
           * pointer, so "cancelled" and "dropped on nothing" are one state and
           * both correctly change nothing.
           */
          if (target === undefined) {
            return;
          }

          drop(
            String(source.data.path),
            String(target.data.path),
            edgeOf(target.element as HTMLElement, location.current.input.clientY),
          );
        },
      }),
    /*
     * **`drop` is an Effect Event and must NOT be a dependency.** That is the
     * whole point of it: React guarantees a stable identity and always-fresh
     * reads, so the monitor is registered once and never torn down mid-drag.
     *
     * The rule below is `eslint-plugin-react-hooks` **5.1**, which predates
     * `useEffectEvent` reaching stable in React 19.2 and therefore sees only a
     * function it cannot account for. Adding `drop` to the array would silence
     * it and be wrong twice over — React documents effect events as never
     * belonging in a dependency list, and the version of this rule that
     * understands them reports exactly that.
     *
     * The fix is the toolchain, not the code: ESLint 10 and its plugin set are
     * a pull request of their own, deliberately kept off this one. This is
     * narrowed to the single line rather than configured away, so the day that
     * upgrade lands the exception is one grep from being deleted.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const attach = useCallback((path: string, row: HTMLElement, handle: HTMLElement) => {
    const self = () => latest.current.find((block) => key(block) === path);

    return combine(
      draggable({
        element: row,
        /*
         * **The block's own name is the handle**, rather than a grip column of
         * its own. A fifth control per row is a fifth thing between a keyboard
         * merchant and the next row, to reach a capability they already have
         * twice — and the name is the part of the row a pointer aims at anyway.
         */
        dragHandle: handle,
        // A step is not a block a merchant arranges: how many a design has
        // follows from its metric (ADR 0025).
        canDrag: () => (self()?.level ?? 1) > 1,
        getInitialData: () => ({ path }),
        onDragStart: () => setDragging(path),
        onDrop: () => setDragging(null),
      }),
      dropTargetForElements({
        element: row,
        getData: () => ({ path }),
        /*
         * **One parent, which is the same constraint the buttons have.** ↑ and ↓
         * express a direction and nothing else, so a drag that could reparent
         * would be a capability no keyboard could reach — and SC 2.5.7 asks for
         * an alternative to the dragging, not to some of it.
         */
        canDrop: ({ source }) => {
          const from = latest.current.find((block) => key(block) === String(source.data.path));
          const here = self();

          return from !== undefined && here !== undefined && from !== here && siblings(from, here);
        },
        onDrag: ({ location }) => {
          const edge = edgeOf(row, location.current.input.clientY);

          // The pointer moves continuously and the answer does not, so this
          // compares before it sets — otherwise every pixel is a re-render of
          // the whole tree.
          setOver((current) =>
            current !== null && current.path === path && current.edge === edge
              ? current
              : { path, edge },
          );
        },
        onDragLeave: () => setOver((current) => (current?.path === path ? null : current)),
      }),
    );
  }, []);

  return { attach, dragging, over };
}

/**
 * Which half of a row the pointer is in.
 *
 * The axis is vertical, so this is the one measurement in the editor that does
 * NOT invert under RTL — a list still runs top to bottom in Persian, and the
 * indicator it draws is a horizontal rule across the row. Everything that does
 * invert (the indentation, the ← → keys) is handled where it lives.
 */
function edgeOf(row: HTMLElement, y: number): Edge {
  const box = row.getBoundingClientRect();

  return y < box.top + box.height / 2 ? 'before' : 'after';
}

/**
 * Two blocks are siblings when they sit in the same array of the same parent.
 *
 * A path is `[step, key, index, key, index, …]`, so dropping the last element
 * leaves the parent AND the array it keeps them in — which is what makes a
 * `split`'s two panes two lists rather than one, with no second comparison to
 * remember.
 */
function siblings(a: Block, b: Block): boolean {
  return a.path.slice(0, -1).join('.') === b.path.slice(0, -1).join('.');
}

const key = (block: Block): string => block.path.join('.');

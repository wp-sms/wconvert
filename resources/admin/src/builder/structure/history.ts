/**
 * Undo and redo over whole {@link Template} snapshots.
 *
 * ============================================================================
 * UNDO IS WHAT MAKES DELETE SAFE WITHOUT A CONFIRM DIALOG.
 * ============================================================================
 * ADR 0039 requires a confirm on every destructive action. A confirm per
 * block-delete is intolerable — a merchant rearranging a design deletes and
 * re-adds a dozen times in a minute — so this is what pays for the exemption,
 * and it is a **precondition** rather than a convenience shipped alongside.
 * `guards.ts` says the same thing from the other end.
 *
 * ============================================================================
 * IT MOVES THE WORKING DRAFT. IT DOES NOT MOVE WHAT THE SITE IS SERVING.
 * ============================================================================
 * `config` is the draft and `published_config` is what visitors get; editing is
 * not publishing, and Save is explicit. So undo restores a previous draft and
 * **Save is what sends it** — which is why undoing across a save is allowed and
 * re-marks the screen dirty rather than being refused. The alternative reads as
 * "your last save is permanent", which is exactly what a separate draft column
 * exists to make untrue.
 *
 * ============================================================================
 * WHOLE SNAPSHOTS, NOT A COMMAND LOG.
 * ============================================================================
 * A command log — *"moved the heading down"*, inverted on undo — is the shape
 * that cannot survive this codebase, because the server REWRITES the tree on
 * every save: unknown types dropped, only declared keys kept, Slot Roles
 * deduplicated tree-wide, layout children rebuilt as dense arrays. An inverse
 * command computed against the tree the merchant edited would be applied to a
 * tree the server has since rearranged, and it would land on the wrong node
 * silently.
 *
 * A snapshot cannot be wrong that way: it either is the previous design or it
 * is not. Templates are small — the payload budget is measured in hundreds of
 * bytes per Optin (ADR 0010) — so {@link DEPTH} snapshots is a rounding error
 * against a screen that is already holding the whole gallery.
 */

/**
 * How many steps back a merchant may go.
 *
 * Deep enough that "I have been rearranging for a minute" is fully recoverable,
 * shallow enough that a long editing session does not hold an unbounded list.
 * Nothing is persisted, so this bounds memory on one screen and nothing else.
 */
export const DEPTH = 50;

/**
 * How long a burst of typing stays one entry.
 *
 * Long enough that a sentence typed at any speed a human types at is one Undo,
 * short enough that a merchant who typed a headline, thought, and then typed a
 * different one gets two. 900ms is the prototype's own measure and it is what
 * the tests pin — {@link remember} takes `now` rather than reading a clock, so
 * the window is a fact a test states rather than one it has to wait out.
 */
export const COALESCE_WINDOW = 900;

/**
 * What the present entry was made by, where it was made by something that can
 * be typed into.
 *
 * `key` names the control — a path and a content key — so two keystrokes merge
 * only when they are the same merchant typing into the same box. `at` is when
 * the last of them landed.
 */
export interface Coalesce {
  readonly key: string;
  readonly at: number;
}

/** A value, everything it was before, and everything it was undone from. */
export interface History<T> {
  readonly present: T;
  readonly past: readonly T[];
  readonly future: readonly T[];
  /**
   * The typing burst `present` belongs to, or null where it belongs to none.
   *
   * Null is what BREAKS a chain, and every non-typing edit sets it: a move, a
   * delete, a save and an undo all leave it null, so the next keystroke starts
   * a fresh entry rather than merging into one from before them.
   */
  readonly merged: Coalesce | null;
}

/** A history at rest: one value, nothing to go back to. */
export const historyOf = <T,>(present: T): History<T> => ({
  present,
  past: [],
  future: [],
  merged: null,
});

/**
 * The same history with a new present, and the old one remembered.
 *
 * **A redo stack is cleared by a new edit**, which is the behaviour every text
 * editor has and the one merchants already expect: having gone back three steps
 * and then typed, the three you undid are not a future any more.
 *
 * An edit that changes nothing by identity is not remembered. Every function in
 * `tree.ts` returns its input unchanged when the edit was a no-op — a move off
 * the end of an array, a path reaching nothing — so this is what stops the ↑
 * button at the top of a list from filling the undo stack with copies.
 *
 * **A save and a template switch come through here too.** Both replace the tree
 * from outside the editor — the server's normalised copy, or a fresh snapshot —
 * and both are edits the merchant made, so both are one entry and both are
 * undoable. A template switch is *one* entry rather than one per node for the
 * same reason: what changed is the design, once.
 *
 * ============================================================================
 * A BURST OF TYPING IS ONE ENTRY, AND THAT IS NOT A NICETY.
 * ============================================================================
 * The editor that types into the tree is the same editor that moves blocks in
 * it, so every keystroke arrives here as a new tree identity. Remembered one by
 * one, **one Undo would remove one character** and a single sentence would
 * exhaust {@link DEPTH} — undo becomes a backspace that also loses the last
 * fifty things the merchant did.
 *
 * So an edit may carry a {@link Coalesce}: which control it came from, and
 * when. Two edits from the same control inside {@link COALESCE_WINDOW} are one
 * entry. Everything else — a move, a delete, a save, a step of the history
 * itself — carries none, and carrying none is what BREAKS the chain rather
 * than merely failing to extend it.
 *
 * `now` is passed in rather than read from a clock, so the window is a fact a
 * test states instead of one it has to wait out, and this file stays pure.
 */
export function remember<T>(history: History<T>, present: T, into: Coalesce | null = null): History<T> {
  if (present === history.present) {
    return history;
  }

  if (mergesInto(history, into)) {
    /*
     * The burst grows in place: the past is untouched, so the entry behind it
     * is still the design as it stood before the merchant started typing, and
     * one Undo removes the whole word rather than the last letter of it.
     */
    return { ...history, present, future: [], merged: into };
  }

  return {
    present,
    past: [...history.past, history.present].slice(-DEPTH),
    future: [],
    merged: into,
  };
}

/**
 * Is this edit a continuation of the one that produced the present?
 *
 * Both halves have to hold. **Same control**, or typing a headline and then a
 * body would be one entry that undoes both. **Inside the window**, or an Optin
 * left open over lunch would merge this afternoon's edit into this morning's.
 */
function mergesInto<T>(history: History<T>, into: Coalesce | null): boolean {
  return (
    into !== null &&
    history.merged !== null &&
    history.merged.key === into.key &&
    into.at - history.merged.at < COALESCE_WINDOW
  );
}

/**
 * The same history, one step back — or itself, where there is no step back.
 *
 * Returning itself by identity rather than throwing or returning null is what
 * lets a caller wire a keyboard shortcut without asking {@link canUndo} first:
 * pressing ⌘Z on a fresh screen does nothing, quietly, which is what it does
 * everywhere else.
 */
export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];

  if (previous === undefined) {
    return history;
  }

  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
    // Stepping the history ends the burst. Typing straight after an Undo has
    // to start a new entry, or the Redo the merchant just earned is eaten by
    // the next keystroke.
    merged: null,
  };
}

/** The same history, one step forward — or itself. */
export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;

  if (next === undefined) {
    return history;
  }

  return {
    present: next,
    past: [...history.past, history.present].slice(-DEPTH),
    future: rest,
    merged: null,
  };
}

export const canUndo = <T,>(history: History<T>): boolean => history.past.length > 0;
export const canRedo = <T,>(history: History<T>): boolean => history.future.length > 0;

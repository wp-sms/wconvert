import type { OptinRecord, PayloadEntry, VisitorState } from '@loader/types';
import type { Store } from '@loader/storage';
import { loadState, saveState } from '@loader/state';

/**
 * Which arm of a test this browser meets — drawn once, kept, and applied by
 * removing every other arm from the page.
 *
 * =============================================================================
 * IT NARROWS THE PAYLOAD. IT DOES NOT TEACH `decide()` A NEW WORD.
 * =============================================================================
 * A [[Variant]] is a whole [[Optin]] (ADR 0045), so two published arms arrive
 * as two payload entries and `decide.ts`'s `arbitrate()` would read two
 * overlays as two campaigns competing for one screen — and two `inline` arms as
 * two forms on one page. What has to happen is a CHOICE, and the honest place
 * to make it is before the engine is asked anything: this runs once, between
 * reading the payload and starting the shell, and what `decide()` receives is a
 * list of entries it has no idea was ever narrowed.
 *
 * That is what keeps free's engine free of experiment code (ADR 0029). There is
 * no arm branch in `decide()`, no seventh `Standing`, and no rule type — an arm
 * is not a Condition, and filing it as one would put it in the builder's rule
 * rows for a merchant to hand-edit.
 *
 * =============================================================================
 * THE DRAW IS THE RECORD ITSELF, WHICH IS THE ONLY SHAPE ADR 0017 ALLOWS.
 * =============================================================================
 * WConvert mints no visitor identifier, so *"this visitor always sees B"*
 * cannot be keyed to a visitor id — it has to be the record. It is
 * `wcv1[parentId].v`, a fifth field on the parent's own entry in the one
 * persistent key, beside the `i`, `l`, `d` and `c` already there, written
 * through the same `localStorage → cookie → in-memory` ladder and failing open
 * like them (ADR 0045, corrected inline).
 *
 * **What is stored is the INDEX and not the arm's id.** It is one small
 * integer, it carries no more precision than the question needs, it joins to
 * nothing, and it expires when the record does — the three properties ADR 0047
 * checks one at a time and ADR 0017 reads this against.
 *
 * **The split unit is therefore the browser record, not the person.** A visitor
 * on a phone and a laptop can draw different arms and be counted twice; a
 * visitor who clears storage re-draws. That is the price of ADR 0017 and the
 * same limit [[Impression]] and [[Conversion]] already carry, and the result
 * screen says so where it reports the number rather than the product buying
 * validity with a cookie.
 */

/** What the projection writes on an arm: `[experiment, this arm, how many]`. */
type Arm = readonly [experiment: string, index: number, arms: number];

/**
 * A payload entry that may be an arm.
 *
 * Declared HERE and not on free's `PayloadEntry`, which is the same rule Pro's
 * modules already follow one level down: free's types name no signal free does
 * not produce (ADR 0028). `PublishedProjection::ARM` is the other spelling of
 * this key, and `pro/tests/js/ab-testing.test.ts` is what holds the two
 * together.
 */
interface ArmEntry extends PayloadEntry {
  readonly variant?: unknown;
}

/**
 * The field the drawn arm is held under, on the parent's record.
 *
 * Its other spelling is `OptinRecord` in `resources/loader/src/types.ts`, where
 * it is deliberately NOT declared: free never writes it and never reads it, and
 * `loadState` carries it through untouched because it parses the blob rather
 * than rebuilding it.
 */
const ARM_FIELD = 'v';

/**
 * One Optin's record, with the arm this browser drew.
 *
 * Free's `OptinRecord` has four fields and this is the fifth, declared HERE
 * because free never writes it and never reads it. What free does is CARRY it:
 * `loadState` parses the blob rather than rebuilding it, and every reducer in
 * `state.ts` spreads the record it is updating — so an impression recorded
 * against the parent keeps the arm beside it, on a build that has no idea what
 * it is (`tests/js/loader-state.test.ts` asserts exactly that, in free's own
 * suite, because it is free's promise).
 */
type ArmRecord = OptinRecord & { [ARM_FIELD]?: unknown };

/**
 * The arm this entry is, or null where it is an ordinary Optin.
 *
 * Validated rather than cast. The payload is the server's, but it reaches here
 * through a `<script>` tag on a page an optimiser is free to rewrite, and a
 * malformed triple must cost one Optin its test rather than every Optin on the
 * page its render (ADR 0004).
 */
function armOf(entry: ArmEntry): Arm | null {
  const triple: unknown = entry.variant;

  if (!Array.isArray(triple) || triple.length !== 3) {
    return null;
  }

  const [experiment, index, arms] = triple as [unknown, unknown, unknown];

  const valid =
    typeof experiment === 'string' &&
    experiment !== '' &&
    Number.isInteger(index) &&
    Number.isInteger(arms) &&
    (arms as number) > 1 &&
    (index as number) >= 0 &&
    (index as number) < (arms as number);

  return valid ? ([experiment, index, arms] as Arm) : null;
}

/**
 * Show one arm of every test, and everything else untouched.
 *
 * **Entries that are not arms pass straight through**, in their original order,
 * because this is the whole payload and not just the test — an ordinary Optin
 * on the same page has nothing to do with any of this.
 *
 * The draw happens at most once per experiment per page view, held in a local
 * map, so re-entering `decide()` on every scroll event cannot re-answer the
 * question. That map is also what makes the blocked-store case work: with
 * nothing persistable anywhere, a page view still yields exactly one arm.
 */
export function assignArms(
  entries: readonly PayloadEntry[],
  store: Store,
): readonly PayloadEntry[] {
  const drawn = new Map<string, number>();
  let state = loadState(store);

  const armFor = (arm: Arm): number => {
    const [experiment, , arms] = arm;
    const already = drawn.get(experiment);

    if (already !== undefined) {
      return already;
    }

    const held = (state[experiment] as ArmRecord | undefined)?.[ARM_FIELD];

    // **A held arm the test no longer has is re-drawn**, which is the one
    // case a stored index has that a stored id would not. A merchant who
    // unpublishes an arm shortens the roster, and a browser holding the index
    // past the end would otherwise sit looking at nothing for the rest of the
    // test rather than joining what is left of it.
    const kept = Number.isInteger(held) && (held as number) >= 0 && (held as number) < arms
      ? (held as number)
      : null;

    // `Math.random()` is the right generator here, and ADR 0017 says why in as
    // many words: *"the objection is to the identifier, not to its entropy."*
    // This names an arm of one experiment and nothing about a device, so there
    // is nothing for a stronger generator to protect.
    const index = kept ?? Math.floor(Math.random() * arms);

    drawn.set(experiment, index);

    if (kept === null) {
      // Written on the DRAW rather than on the impression, because the draw is
      // the moment the browser met the test and the impression may never come
      // — an arm that is capped, out of its window or never triggered still
      // has to be the arm this browser meets on the next page, or the split is
      // not a split at all.
      //
      // The whole state is re-read and re-written through free's own
      // `state.ts`, so the parent's `i`, `l`, `d` and `c` travel with it and
      // nothing here has to know what they are.
      const record: ArmRecord = { ...state[experiment], [ARM_FIELD]: index };

      state = { ...state, [experiment]: record } as VisitorState;

      saveState(store, state);
    }

    return index;
  };

  return entries.filter((entry) => {
    const arm = armOf(entry);

    if (arm === null) {
      return true;
    }

    return arm[1] === armFor(arm);
  });
}

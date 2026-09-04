import { describe, expect, it } from 'vitest';
import type { PayloadEntry } from '@loader/types';
import type { Store } from '@loader/storage';
import { assignArms } from '../../modules/ab-testing/loader/arms';

/**
 * Which arm this browser meets, and the three ways it has to hold.
 *
 * The seam is `assignArms(entries, store)` — the whole of A/B on the page.
 * Everything upstream of it is already real: the projection says which entries
 * are arms of what, and everything downstream is `decide()` answering about a
 * list of entries it has no idea was ever narrowed.
 *
 * It is tested with a fake {@link Store} rather than `localStorage` because
 * the ladder's three rungs are `storage.ts`'s to prove, and what has to hold
 * here is what happens on the two ends of it: a store that remembers, and one
 * that does not.
 */

/** One arm, as the projection writes it. */
const arm = (id: string, experiment: string, index: number, arms: number): PayloadEntry =>
  ({ id, variant: [experiment, index, arms] }) as PayloadEntry;

/** A store that remembers, the way `localStorage` does. */
function aStoreThatRemembers(seed: string | null = null): Store {
  let held = seed;

  return {
    read: () => held,
    write: (value: string) => {
      held = value;
    },
  };
}

/**
 * A store that takes a write and answers nothing — private browsing with the
 * cookie jar shut too, which is the far end of the ladder in `storage.ts`.
 */
const aStoreThatForgets = (): Store => ({ read: () => null, write: () => undefined });

describe('the arm a browser draws', () => {
  it('shows exactly one arm of a two-arm test', () => {
    const entries = [arm('A', 'A', 0, 2), arm('B', 'A', 1, 2)];

    const shown = assignArms(entries, aStoreThatRemembers());

    expect(shown).toHaveLength(1);
    expect(entries).toContain(shown[0]);
  });

  /**
   * The sticky half, and the one the whole feature rests on. A merchant
   * comparing 4.2% against 5.1% is comparing two audiences, and a browser that
   * re-drew on every page view would put the same person in both.
   */
  it('keeps the arm it drew across page views', () => {
    const entries = [arm('A', 'A', 0, 2), arm('B', 'A', 1, 2)];
    const store = aStoreThatRemembers();

    const first = assignArms(entries, store)[0].id;

    for (let view = 0; view < 20; view++) {
      expect(assignArms(entries, store)[0].id).toBe(first);
    }
  });

  /**
   * **A cleared record re-draws**, which is the accepted price of holding the
   * record rather than an id (ADR 0017). Asserted as "both arms are reachable"
   * rather than "it changed", because a re-draw may honestly land on the same
   * arm — a test that demanded a different one would fail half the time.
   */
  it('re-draws when the record is gone, and can land on either arm', () => {
    const entries = [arm('A', 'A', 0, 2), arm('B', 'A', 1, 2)];
    const met = new Set<string>();

    for (let visitor = 0; visitor < 200; visitor++) {
      met.add(assignArms(entries, aStoreThatRemembers())[0].id);
    }

    expect(met).toEqual(new Set(['A', 'B']));
  });

  /**
   * The far end of the storage ladder: private browsing with the cookie jar
   * shut, where nothing written can be read back. The allowance already fails
   * open there and so does this — what must NOT happen is both arms on one
   * page, which is the failure a visitor would actually see.
   */
  it('yields exactly one arm per page view even when nothing can be stored', () => {
    const entries = [arm('A', 'A', 0, 2), arm('B', 'A', 1, 2)];

    for (let view = 0; view < 20; view++) {
      expect(assignArms(entries, aStoreThatForgets())).toHaveLength(1);
    }
  });

  /**
   * A merchant who unpublishes one arm of three shortens the roster. A browser
   * holding the index past the end would otherwise meet nothing at all for the
   * rest of the test.
   */
  it('re-draws an arm the test no longer has', () => {
    const store = aStoreThatRemembers(JSON.stringify({ A: { v: 2 } }));

    const shown = assignArms([arm('A', 'A', 0, 2), arm('B', 'A', 1, 2)], store);

    expect(shown).toHaveLength(1);
    expect(JSON.parse(store.read() ?? '{}').A.v).toBeLessThan(2);
  });

  /**
   * The arm is remembered against the PARENT's own record — `wcv1[parentId].v`
   * — which is a record that already holds this device's impressions and
   * dismissals of the parent. Writing the arm must not cost it any of them.
   */
  it("writes the arm beside the parent's own impressions rather than over them", () => {
    const store = aStoreThatRemembers(JSON.stringify({ A: { i: 3, l: 20400, d: 1 } }));

    assignArms([arm('A', 'A', 0, 2), arm('B', 'A', 1, 2)], store);

    expect(JSON.parse(store.read() ?? '{}').A).toMatchObject({ i: 3, l: 20400, d: 1 });
    expect(JSON.parse(store.read() ?? '{}').A.v).toBeTypeOf('number');
  });

  /**
   * Every other Optin on the page is untouched, in its original order. This is
   * the whole payload rather than one test's slice of it, and an install
   * running no test at all must reach `decide()` with exactly what it reads
   * off the page.
   */
  it('passes everything that is not an arm straight through', () => {
    const plain = [{ id: 'X' }, { id: 'Y' }] as PayloadEntry[];

    expect(assignArms(plain, aStoreThatRemembers())).toEqual(plain);
  });

  /**
   * A payload reaches the browser through a `<script>` tag on a page an
   * optimiser is free to rewrite. A triple that does not parse costs that
   * Optin its test and never a render (ADR 0004) — so it is SHOWN rather than
   * dropped, which is the same direction free's own payload reader fails in.
   */
  it('shows an entry whose arm triple is malformed rather than dropping it', () => {
    const broken = [
      { id: 'A', variant: 'nonsense' },
      { id: 'B', variant: ['A', 4, 2] },
      { id: 'C', variant: ['A', 0, 1] },
    ] as unknown as PayloadEntry[];

    expect(assignArms(broken, aStoreThatRemembers()).map((entry) => entry.id)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  /**
   * Two tests on one page are two draws, not one. The experiment id is the key
   * and there is no shared "which arm is this visitor on" anywhere.
   */
  it('draws each test separately', () => {
    const entries = [
      arm('A', 'A', 0, 2),
      arm('B', 'A', 1, 2),
      arm('P', 'P', 0, 2),
      arm('Q', 'P', 1, 2),
    ];

    const shown = assignArms(entries, aStoreThatRemembers()).map((entry) => entry.id);

    expect(shown).toHaveLength(2);
    expect(shown.filter((id) => id === 'A' || id === 'B')).toHaveLength(1);
    expect(shown.filter((id) => id === 'P' || id === 'Q')).toHaveLength(1);
  });

  /**
   * **The draw is over the TEST and not over the page**, which is why the count
   * travels in the payload at all. An arm is dropped from a page it does not
   * target and from one where it is [[Suspended]], so a browser whose first
   * page carries one arm of two would otherwise draw from a set of one and
   * always meet arm A — and every such visitor would be counted against the
   * split as though they had been offered a choice.
   */
  it('draws over the whole test even when only one arm is on this page', () => {
    const met = new Set<number>();

    for (let visitor = 0; visitor < 200; visitor++) {
      const store = aStoreThatRemembers();

      assignArms([arm('A', 'A', 0, 2)], store);

      met.add(JSON.parse(store.read() ?? '{}').A.v);
    }

    expect(met).toEqual(new Set([0, 1]));
  });
});

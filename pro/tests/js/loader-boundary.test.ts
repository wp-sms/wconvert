import { describe, expect, it } from 'vitest';
import { FREE_MODULES } from '@loader/modules';
import { PRO_MODULES } from '../../resources/loader/src/modules';
import proLoader from '../../resources/loader/src/main';

/**
 * The free/Pro loader module boundary, asserted from Pro's side.
 *
 * This file lives under pro/ rather than under tests/js/, and that placement is
 * the point: it imports Pro's tree, so putting it in free's tree would make the
 * test itself the leak bin/verify-source-contract.sh exists to catch.
 *
 * HONESTY ABOUT WHAT IS PROVEN TODAY. Both module lists are empty, so the
 * composition assertions below compare empty arrays and would pass against a
 * Pro entry that ignored free entirely. What they DO prove today is the import
 * direction: this file resolves free's tree from inside Pro's, and Pro's entry
 * evaluates, so the cross-tree wiring ADR 0028 requires exists rather than
 * merely being described. The composition claims become load-bearing the moment
 * the first module lands, which is why they are written now rather than then.
 * The composition LOGIC is asserted non-vacuously in tests/js/loader-engine.test.ts.
 */
describe("Pro's loader entry", () => {
  it("resolves free's loader tree from inside Pro's", () => {
    // Not a tautology: free's modules and engine are reached across the plugin
    // boundary by relative path, so a broken or reversed dependency direction
    // fails this file at import time rather than at any assertion.
    expect(Array.isArray(FREE_MODULES)).toBe(true);
    expect(proLoader.modules).toBeInstanceOf(Array);
  });

  it("is free's modules plus Pro's own", () => {
    const composed = proLoader.modules.map((m) => m.id);

    expect(composed).toEqual([...FREE_MODULES.map((m) => m.id), ...PRO_MODULES.map((m) => m.id)]);
  });

  it("carries every module free's loader carries", () => {
    // Pro REPLACES free's loader and dequeues it in PHP (ADR 0014), so any
    // free module missing from Pro's build is a capability a merchant loses by
    // paying for Pro.
    const composed = new Set(proLoader.modules.map((m) => m.id));

    for (const free of FREE_MODULES) {
      expect(composed).toContain(free.id);
    }
  });
});

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
 * Two things are proven here, and the second only became load-bearing once
 * both sides shipped modules. The IMPORT DIRECTION: this file resolves free's
 * tree from inside Pro's, and Pro's entry evaluates, so the cross-tree wiring
 * ADR 0028 requires exists rather than merely being described. And the
 * COMPOSITION: Pro's loader is free's modules plus Pro's, in that order, and
 * carries every module free's carries — which is what makes the PHP dequeue
 * safe (`tests/unit/Pro/Frontend/LoaderReplacementTest.php`). Pro REPLACES
 * free's loader, so a free module missing from Pro's build is a capability a
 * merchant loses by paying for Pro.
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

import { describe, expect, it } from 'vitest';
import manifest from '../../../resources/rules/manifest.json';
import { parityProblems } from '../../../tests/js/support/manifest-parity';
import type { Manifest } from '../../../tests/js/support/manifest-parity';
import { PRO_MODULES } from '../../resources/loader/src/modules';

/**
 * The manifest and the modules say the same thing — Pro's half.
 *
 * This file lives under pro/ rather than under tests/js/, and that placement is
 * the point: it imports Pro's tree, so putting it in free's tree would make the
 * test itself the leak `bin/verify-source-contract.sh` exists to catch.
 *
 * It is the assertion that decides WHERE a premium entry may land: a
 * `tier: pro` entry added to the manifest without a Pro module fails here on
 * the same pull request, which is what keeps ADR 0029's "every entry resolves
 * to an implementation on the side its tier names" from being a sentence
 * nobody runs. That is why `exit_intent` and `scroll_up` could not arrive with
 * the manifest half of #22 and arrive here instead, with the modules that
 * implement them.
 */
describe("Pro's modules against the manifest", () => {
  it('implements every premium trigger and condition, and nothing else', () => {
    expect(parityProblems(manifest as Manifest, 'pro', PRO_MODULES)).toEqual([]);
  });
});

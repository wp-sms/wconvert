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
 * WHAT IT PROVES TODAY, HONESTLY: the manifest declares no premium rule yet and
 * Pro implements none, so this compares two empty sets. It is written now
 * rather than then because it is the assertion that decides WHERE the premium
 * entries may land — a `tier: pro` entry added to the manifest without a Pro
 * module fails here on the same pull request, which is what keeps ADR 0029's
 * "every entry resolves to an implementation on the side its tier names" from
 * being a sentence nobody runs.
 */
describe("Pro's modules against the manifest", () => {
  it('implements every premium trigger and condition, and nothing else', () => {
    expect(parityProblems(manifest as Manifest, 'pro', PRO_MODULES)).toEqual([]);
  });
});

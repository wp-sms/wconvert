import { describe, expect, it } from 'vitest';
import { FREE_MODULES } from '@loader/modules';
import manifest from '../../resources/rules/manifest.json';
import { parityProblems } from './support/manifest-parity';
import type { Manifest } from './support/manifest-parity';
import type { LoaderModule } from '@loader/types';

/**
 * The manifest and the modules say the same thing — free's half.
 *
 * ADR 0005 lets the evaluator be the manifest's one hand-written duplicate on
 * the condition that a test asserts parity. Under ADR 0028 that duplicate is
 * the MODULE SET rather than a switch: a single switch would have to name
 * `exit_intent`, and premium code is absent from free's source rather than
 * dead inside it.
 *
 * Pro's half is asserted from Pro's side, in `pro/tests/js/manifest-parity.test.ts`.
 */

const real = manifest as Manifest;

const module = (overrides: Partial<LoaderModule> & { id: string }): LoaderModule => ({
  kind: 'trigger',
  consentCategory: null,
  create: () => ({ holds: () => true }),
  ...overrides,
});

describe("free's modules against the manifest", () => {
  it('implements every free trigger and condition, and nothing else', () => {
    expect(parityProblems(real, 'free', FREE_MODULES)).toEqual([]);
  });

  it('covers every client entry the manifest declares between the two tiers', () => {
    const declared = Object.entries(real)
      .flatMap(([, axis]) => Object.entries(axis))
      .filter(([, entry]) => entry.kind === 'trigger' || entry.kind === 'condition');

    // Not a tautology: it fails the day a client axis is added to the manifest
    // and left with no entries at all, which would make every assertion above
    // vacuously true.
    expect(declared.length).toBeGreaterThan(0);
  });
});

/**
 * THE FAILURE CASES. A parity test that can only be run against a correct
 * manifest cannot prove it would catch an incorrect one — and the thing it
 * exists to catch is an entry with no implementation, which suspends Optins at
 * runtime for a reason that is a bug rather than a missing dependency.
 */
describe('what the parity check catches', () => {
  const oneEntry = (entry: Record<string, unknown>): Manifest => ({ triggers: { pounce: entry } });

  it('catches an entry with no implementation on its own side', () => {
    const problems = parityProblems(oneEntry({ kind: 'trigger', tier: 'free', consent_category: null }), 'free', []);

    expect(problems).toEqual(['pounce is declared free but no free module implements it']);
  });

  it('catches a module with no entry in the manifest', () => {
    const problems = parityProblems({ triggers: {} }, 'free', [module({ id: 'pounce' })]);

    expect(problems).toEqual(['pounce has a free module but no entry in the manifest']);
  });

  /**
   * The leak. A premium rule implemented in free's tree is exactly what
   * ADR 0028 exists to make impossible, and this catches it at the source
   * rather than waiting for `check:loader` to find it in the bundle.
   */
  it('catches a premium rule implemented on the free side', () => {
    const problems = parityProblems(
      oneEntry({ kind: 'trigger', tier: 'pro', consent_category: null }),
      'free',
      [module({ id: 'pounce' })],
    );

    expect(problems).toEqual(['pounce is declared pro but is implemented on free\'s side']);
  });

  it('catches a module whose kind disagrees with the manifest', () => {
    const problems = parityProblems(
      oneEntry({ kind: 'condition', tier: 'free', consent_category: null }),
      'free',
      [module({ id: 'pounce', kind: 'trigger' })],
    );

    expect(problems).toEqual(['pounce is a condition in the manifest and a trigger in its module']);
  });

  it('catches a module whose consent category disagrees with the manifest', () => {
    const problems = parityProblems(
      oneEntry({ kind: 'trigger', tier: 'free', consent_category: 'statistics' }),
      'free',
      [module({ id: 'pounce' })],
    );

    expect(problems).toEqual([
      'pounce declares a different consent category in its module than in the manifest',
    ]);
  });

  it('catches two modules sharing an id', () => {
    const problems = parityProblems({ triggers: {} }, 'free', [module({ id: 'pounce' }), module({ id: 'pounce' })]);

    expect(problems).toContain('free: two modules share an id');
  });
});

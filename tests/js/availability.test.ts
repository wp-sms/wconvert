import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  renderingFor,
  tierName,
  tierProductName,
  type Availability,
  type Surface,
} from '../../resources/admin/src/goals/availability';
import ladder from '../../tiers.json';

/**
 * **One rule, two surfaces, opposite renderings.**
 *
 * The three [[Availability]] states name **why** a registry member is absent;
 * **how** that absence renders is a property of the surface (ADR 0026). The
 * goal screen is the front door of a creation flow and hides what a settings
 * list explains — and the load-bearing half is that neither of them ever
 * renders `unavailable` as an upsell.
 */
describe('what a surface does with an availability', () => {
  const SURFACES: Surface[] = ['creation_flow', 'settings_list'];

  // A paid install unless a test says otherwise: a free one is shown no
  // locked member at all (ADR 0116), asserted on its own below.
  beforeEach(() => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'pro' };
  });

  afterEach(() => {
    delete window.wconvertAdmin;
  });

  it.each(SURFACES)('offers a ready member on %s', (surface) => {
    expect(renderingFor('ready', surface)).toBe('offer');
  });

  /**
   * Buyable from us, so both surfaces say so. The copy is bundled, never
   * fetched (ADR 0015).
   */
  it.each(SURFACES)('upsells a locked member on %s', (surface) => {
    expect(renderingFor('locked', surface)).toBe('upsell');
  });

  /**
   * **A free install hides every locked member, on every surface** (ADR 0116).
   * wp.org reads a free plugin full of padlocks as trialware; absent boot data
   * reads as free, because the safe failure is to hide an upsell.
   */
  it.each([
    ['an explicit free install', { exportUrl: '', installedTier: 'free' as const }],
    ['absent boot data', undefined],
  ])('hides a locked member on every surface for %s', (_case, settings) => {
    window.wconvertAdmin = settings;

    for (const surface of SURFACES) {
      expect(renderingFor('locked', surface)).toBe('hide');
    }
    expect(renderingFor('ready', 'settings_list')).toBe('offer');
    expect(renderingFor('unavailable', 'settings_list')).toBe('explain');
  });

  /**
   * The split. A merchant who opened the Destinations page went looking for a
   * list of destinations, and a silent gap in it is baffling; a food blogger
   * with no store reading "requires WooCommerce" on the goal screen learns
   * nothing they can act on.
   */
  it('hides an unavailable member where a settings list explains it', () => {
    expect(renderingFor('unavailable', 'creation_flow')).toBe('hide');
    expect(renderingFor('unavailable', 'settings_list')).toBe('explain');
  });

  /**
   * **The guarantee, stated as its own assertion.** "The two surfaces
   * disagree" would still pass on the day both of them started advertising Pro
   * to a merchant who cannot use it — so this asserts the thing that must
   * never happen rather than the difference that happens to imply it today.
   *
   * A paying customer is never shown an upsell, and we never offer to sell a
   * WooCommerce licence we do not have.
   */
  it('never renders unavailable as an upsell, on any surface', () => {
    const surfaces: Surface[] = ['creation_flow', 'settings_list'];

    expect(surfaces.map((surface) => renderingFor('unavailable', surface))).not.toContain('upsell');
  });

  /**
   * Every state is handled. A `Rendering` of `undefined` would render a card
   * with nothing in it, which reads as a loading state that never finishes.
   */
  it('answers for every state the registry can produce', () => {
    const states: Availability[] = ['ready', 'locked', 'unavailable'];

    for (const state of states) {
      for (const surface of SURFACES) {
        expect(['offer', 'upsell', 'explain', 'hide']).toContain(renderingFor(state, surface));
      }
    }
  });
});

/**
 * ============================================================================
 * WHAT THE UPSELL CALLS THE TIER, WHICH IS DATA AND NOT A LITERAL.
 * ============================================================================
 * The word on a locked badge was `__('Pro')`, written out in five components.
 * It is `tiers.json`'s now, delivered in `window.wconvertAdmin.tiers` — so
 * renaming the product is a manifest edit rather than five strings and a
 * release.
 */
describe('what an upsell calls the tier', () => {
  const withTiers = (tiers: Record<string, { name: string; product_name: string }> | undefined) => {
    window.wconvertAdmin = tiers === undefined ? undefined : { exportUrl: '', tiers };
  };

  afterEach(() => {
    delete window.wconvertAdmin;
  });

  /**
   * Pro reads as "Pro". A tier that started displaying its own slug would be
   * this product announcing a tier nobody can buy.
   */
  it('reads the shipped tier as Pro', () => {
    withTiers(
      Object.fromEntries(
        ladder.premium.tiers.map((tier) => [
          tier.slug,
          { name: tier.name, product_name: tier.plugin_name },
        ]),
      ),
    );

    for (const tier of ladder.premium.tiers) {
      expect(tierName(tier.slug)).toBe('Pro');
      expect(tierProductName(tier.slug)).toBe('WConvert Pro');
    }
  });

  /** The badge follows the manifest without a component changing. */
  it('follows the manifest when the tier is renamed', () => {
    withTiers({ pro: { name: 'Plus', product_name: 'WConvert Plus' } });

    expect(tierName('pro')).toBe('Plus');
    expect(tierProductName('pro')).toBe('WConvert Plus');
  });

  /**
   * ==========================================================================
   * AND IT NEVER RENDERS NOTHING.
   * ==========================================================================
   * `adminSettings()` is legitimately absent — a test rendering a component on
   * its own, a screen that changed and left the localised object behind — and a
   * badge showing an empty string is worse than one naming the tier nobody has
   * renamed. The same fallback covers a member declaring a tier this build has
   * never heard of.
   */
  it.each([
    ['no settings at all', undefined],
    ['settings carrying no tiers', {}],
  ] as const)('falls back to the word the product has always used with %s', (_case, tiers) => {
    withTiers(tiers);

    expect(tierName('pro')).toBe('Pro');
    expect(tierProductName('pro')).toBe('WConvert Pro');
    expect(tierName(undefined)).toBe('Pro');
  });

  it('falls back for a tier this build has never heard of', () => {
    withTiers({ pro: { name: 'Pro', product_name: 'WConvert Pro' } });

    expect(tierName('enterprise')).toBe('Pro');
    expect(tierProductName('enterprise')).toBe('WConvert Pro');
  });
});

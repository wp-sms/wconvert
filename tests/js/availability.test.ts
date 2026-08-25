import { describe, expect, it } from 'vitest';
import { renderingFor, type Availability, type Surface } from '../../resources/admin/src/goals/availability';

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

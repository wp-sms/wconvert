import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@renderer/render', () => ({ registerLeafRenderer: () => {} }));

afterEach(() => { document.body.innerHTML = ''; });

/**
 * "Cart is empty" (ADR 0139) is read as the negation of "has items", so the
 * evaluator says whether its answer is settled: a rich cart answer is not
 * known until the commerce runtime has read the cart, and a negated rule reads
 * false until then rather than flashing a popup at a full cart.
 */
describe('the cart evaluator', () => {
  it('knows a cookie-read answer at once', async () => {
    const { createCartEvaluator } = await import('../../modules/cart-recovery/loader/bridge');
    const evaluator = createCartEvaluator(() => {});

    expect(evaluator.known?.({ type: 'cart_has_items' })).toBe(true);
  });

  it('does not know a projected answer while the commerce runtime has not read the cart', async () => {
    document.body.innerHTML = '<script id="wconvert-payload" data-commerce-runtime="/nowhere.js"></script>';
    const { createCartEvaluator } = await import('../../modules/cart-recovery/loader/bridge');
    const evaluator = createCartEvaluator(() => {});

    expect(evaluator.known?.({ type: 'cart_has_items', context_key: 'a:r1' })).toBe(false);
    evaluator.stop?.();
  });
});

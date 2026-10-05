import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { emptyBasket, useBasketPreview, type BasketResult } from '../../resources/admin/src/builder/rules/SampleBasket';

import SampleVisit from '../../resources/admin/src/builder/rules/SampleVisit';
import { ruleTypes } from './support/rule-types';

vi.mock('../../resources/admin/src/settings', () => ({ commerceSupported: () => true }));
vi.mock('../../resources/admin/src/builder/CommerceControls', () => ({ CommercePicker: () => null }));
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const response = (eligible: boolean): BasketResult => ({ rules: { coffee: eligible }, cards: [], reason: '', eligible, state: 'known', currency: 'USD', decimals: 2 });

describe('sample basket request lifecycle', () => {
  it('sends unsaved rules and source, discards late replies and does not reuse an earlier matching basket', async () => {
    const resolvers: ((value: BasketResult) => void)[] = [];
    vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => resolvers.push(resolve as (value: BasketResult) => void)));
    const a = { ...emptyBasket(), items: [{ id: 12, quantity: 2 }], amount: 30 };
    const b = { ...a, items: [{ id: 13, quantity: 1 }] };
    const rules = [{ id: 'coffee', type: 'cart_products', operator: 'any', ids: [12] }];
    const products = { type: 'products' as const, source: 'cross_sells' as const, product_ids: [] };
    const { result, rerender } = renderHook(({ basket }) => useBasketPreview(true, basket, rules, products), { initialProps: { basket: a } });
    await waitFor(() => expect(resolvers).toHaveLength(1));
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toMatchObject({ method: 'POST', data: { items: a.items, amount: 30, rules, products: { source: 'cross_sells', product_ids: [], exclude_cart: true } } });
    rerender({ basket: b });
    expect(result.current.result).toBeUndefined();
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => resolvers[1](response(false)));
    expect(result.current.result?.eligible).toBe(false);
    await act(async () => resolvers[0](response(true)));
    expect(result.current.result?.eligible).toBe(false);
    rerender({ basket: a });
    expect(result.current.result).toBeUndefined();
    await waitFor(() => expect(resolvers).toHaveLength(3));
    await act(async () => resolvers[2](response(true)));
    expect(result.current.result?.eligible).toBe(true);
  });

  it('does not request a preview without commerce capability and fails closed on an error', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Unavailable'));
    const { result, rerender } = renderHook(({ enabled }) => useBasketPreview(enabled, emptyBasket(), []), { initialProps: { enabled: false } });
    expect(apiFetch).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.result).toBeUndefined();
  });
});


it('requires a fresh gesture after a basket edit finishes checking', async () => {
  const resolvers: ((value: BasketResult) => void)[] = [];
  vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => resolvers.push(resolve as (value: BasketResult) => void)));
  render(<SampleVisit cartRequired vocabulary={ruleTypes()} onClose={vi.fn()} value={{
    display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [{ id: 'exit', type: 'exit_intent' }] } },
    targeting: {}, frequency: {}, schedule: {}, priority: 0,
  }} />);
  const gesture = screen.getByRole('button', { name: 'Simulate exit intent' });
  expect(gesture).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Checking…');
  expect(screen.getByRole('status')).not.toHaveTextContent('Would not show');
  await waitFor(() => expect(resolvers).toHaveLength(1));
  const matches = { ...response(true), rules: { 'sample-required-cart': true } };
  await act(async () => resolvers[0](matches));
  expect(screen.getByRole('status')).toHaveTextContent('Would not show');
  fireEvent.click(gesture);
  expect(screen.getByRole('status')).toHaveTextContent('Would show');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Merchandise amount after discounts' }), { target: { value: '100' } });
  expect(gesture).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Checking…');
  fireEvent.click(gesture);
  await waitFor(() => expect(resolvers).toHaveLength(2));
  await act(async () => resolvers[1](matches));
  expect(screen.getByRole('status')).toHaveTextContent('Would not show');
  fireEvent.click(gesture);
  expect(screen.getByRole('status')).toHaveTextContent('Would show');
});

it('invalidates the sample when its viewed product changes, independently of the empty basket', async () => {
  vi.mocked(apiFetch).mockResolvedValue(response(true));
  const products = { type: 'products' as const, context: 'product' as const, main_product_id: 12, source: 'cross_sells' as const, product_ids: [] };
  const { result, rerender } = renderHook(({ viewed }) => useBasketPreview(true, { ...emptyBasket(), viewed_product_id: viewed }, [], products), { initialProps: { viewed: 12 } });
  await waitFor(() => expect(result.current.result?.eligible).toBe(true));
  expect(vi.mocked(apiFetch).mock.calls[0][0]).toMatchObject({ data: { viewed_product_id: 12, items: [], products: { context: 'product', main_product_id: 12 } } });
  vi.mocked(apiFetch).mockResolvedValue(response(false));
  rerender({ viewed: 13 });
  expect(result.current.result).toBeUndefined();
  await waitFor(() => expect(result.current.result?.eligible).toBe(false));
  expect(vi.mocked(apiFetch).mock.lastCall?.[0]).toMatchObject({ data: { viewed_product_id: 13 } });
});

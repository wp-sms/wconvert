import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/dom';
import { showQuizProducts } from '../../modules/cart-recovery/loader/quiz-products';
const mocks = vi.hoisted(() => ({ add: vi.fn(), refresh: vi.fn() }));
vi.mock('../../modules/cart-recovery/loader/addition', () => ({ additionSession: () => ({ add: mocks.add }), refreshNativeCart: mocks.refresh }));
vi.mock('@loader/payload', () => ({ readPayload: () => [{ id: 'quiz', commerce_revision: 'current' }] }));
const cards = [
  { id: 1, name: 'Coffee filter', url: '/filter', image: '', price: '$10', label: 'Add to cart', can_add: true, activity_token: 'signed' },
  { id: 2, name: 'Mug', url: '/mug', image: '', price: '$15', label: 'Choose options', can_add: false, activity_token: 'signed' },
];
const result = { id: 'brewing', heading: 'Your picks', product_ids: [1, 2], product_action: 'add_to_cart' as const };
let stop: (() => void) | undefined;
let host: HTMLElement;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mocks.add.mockReset(); mocks.refresh.mockReset();
  document.body.innerHTML = '<script id="wconvert-payload" data-commerce-quiz="/quiz" data-commerce-cart="/cart"></script><div id="host"></div>';
  host = document.getElementById('host')!;
  fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => cards }); vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { stop?.(); vi.unstubAllGlobals(); });
it('loads a published result, keeps options as links and never signals another conversion', async () => {
  const converted = vi.fn(), click = vi.fn(); host.addEventListener('wconvert:cart-added', converted);
  mocks.add.mockResolvedValue('added');
  stop = showQuizProducts(host, result, click, 'quiz', 'results', {});
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart: Coffee filter' })).toBeTruthy());
  expect(fetcher.mock.calls[0][1].body.get('screen')).toBe('results');
  expect(fetcher.mock.calls[0][1].body.get('result')).toBe('brewing');
  expect(screen.getByRole('link', { name: 'Choose options: Mug' })).toBeTruthy();
  expect(host.querySelector('[data-convert]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart: Coffee filter' }));
  await vi.waitFor(() => expect(screen.getByText('Added to your basket.')).toBeTruthy());
  expect(converted).not.toHaveBeenCalled(); expect(mocks.refresh).toHaveBeenCalledOnce(); expect(click).not.toHaveBeenCalled();
});
it.each(['added', 'unknown'])('retains a late %s outcome after navigating away and blocks another addition on return', async state => {
  const scope = {}; let finish: (value: string) => void = () => {};
  mocks.add.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  stop = showQuizProducts(host, result, () => {}, 'quiz', 'results', scope);
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Add to cart: Coffee filter' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart: Coffee filter' }));
  stop(); host.replaceChildren();
  stop = showQuizProducts(host, result, () => {}, 'quiz', 'results', scope);
  await vi.waitFor(() => expect(host.querySelector('article')).toBeTruthy());
  finish(state);
  await vi.waitFor(() => expect(screen.getByText(state === 'added' ? 'Added to your basket.' : 'Check your basket before trying again.')).toBeTruthy());
  fireEvent.click(host.querySelector('button')!); expect(mocks.add).toHaveBeenCalledOnce();
});
it('keeps an empty result explicit and never replaces it with unrelated products', async () => {
  fetcher.mockResolvedValue({ ok: true, json: async () => [] });
  stop = showQuizProducts(host, result, () => {}, 'quiz', 'results', {});
  await vi.waitFor(() => expect(screen.getByText(/These products are unavailable/)).toBeTruthy());
  expect(host.querySelector('button')).toBeNull(); expect(mocks.add).not.toHaveBeenCalled();
});
it('retries only catalog reads and aborts work when leaving the result', async () => {
  fetcher.mockRejectedValueOnce(Error('offline'));
  stop = showQuizProducts(host, result, () => {}, 'quiz', 'results', {});
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Retry products' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Retry products' }));
  await vi.waitFor(() => expect(host.querySelector('article')).toBeTruthy());
  expect(fetcher).toHaveBeenCalledTimes(2); expect(mocks.add).not.toHaveBeenCalled();
  stop(); expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
});

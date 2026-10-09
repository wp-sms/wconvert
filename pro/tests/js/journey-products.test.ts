import { afterEach, expect, it, vi } from 'vitest';
import { showProducts } from '../../modules/journeys/loader/products';

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

const product = (id: number, permalink = `/product-${id}`) => ({
  id, name: `Product ${id}`, permalink, is_purchasable: true, is_in_stock: true,
});
const response = (items: unknown[]) => ({ ok: true, json: async () => items });
function setup() {
  const payload = document.createElement('script'); payload.id = 'wconvert-payload';
  payload.setAttribute('data-products', `${location.origin}/wp-json/wc/store/v1/products`);
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  const fallback = document.createElement('a'); fallback.href = '/shop'; fallback.textContent = 'Browse shop';
  shadow.append(container, fallback); document.body.append(payload, host);
  const stop = showProducts(container, { id: 'match', heading: 'Match', body: '', product_ids: [1, 2, 3, 4] });
  return { container, fallback, shadow, stop };
}

it('keeps Retry focused while loading, ignores repeat activation, then focuses the recovered product', async () => {
  let recover!: (value: ReturnType<typeof response>) => void;
  const fetcher = vi.fn().mockRejectedValueOnce(Error('Offline'))
    .mockImplementationOnce(() => new Promise(resolve => { recover = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const { container, shadow, stop } = setup();
  await vi.waitFor(() => expect(container.querySelector('button')).not.toBeNull());
  const retry = container.querySelector('button')!;
  retry.focus(); retry.click(); retry.click();
  expect(shadow.activeElement).toBe(retry);
  expect(retry.getAttribute('aria-disabled')).toBe('true');
  expect(container.textContent).toContain('Loading current products');
  expect(fetcher).toHaveBeenCalledTimes(2);
  recover(response([product(1)]));
  await vi.waitFor(() => expect(container.querySelector('a')).not.toBeNull());
  expect(shadow.activeElement).toBe(container.querySelector('a'));
  expect(container.querySelector('button')).toBeNull();
  stop();
});

it('keeps the same Retry control after another failure without taking focus from the fallback', async () => {
  let recover!: (value: ReturnType<typeof response>) => void;
  const fetcher = vi.fn().mockRejectedValueOnce(Error('Offline')).mockRejectedValueOnce(Error('Still offline'))
    .mockImplementationOnce(() => new Promise(resolve => { recover = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const { container, fallback, shadow, stop } = setup();
  await vi.waitFor(() => expect(container.querySelector('button')).not.toBeNull());
  const retry = container.querySelector('button')!;
  retry.focus(); retry.click();
  await vi.waitFor(() => expect(retry.getAttribute('aria-disabled')).not.toBe('true'));
  expect(shadow.activeElement).toBe(retry);
  expect(container.querySelector('button')).toBe(retry);
  retry.click(); fallback.focus(); recover(response([product(1)]));
  await vi.waitFor(() => expect(container.querySelector('a')).not.toBeNull());
  expect(shadow.activeElement).toBe(fallback);
  stop();
});

it('skips malformed and off-site links before limiting the displayed products', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([
    product(1, 'https://different.example/product'), product(2, 'http://['), product(3, 'javascript:alert(1)'), product(4),
  ])));
  const { container, stop } = setup();
  await vi.waitFor(() => expect(container.textContent).toContain('View Product 4'));
  expect(container.querySelectorAll('li')).toHaveLength(1);
  expect(container.querySelector('a')?.getAttribute('href')).toBe(`${location.origin}/product-4`);
  stop();
});

it('explains an empty safe product list and preserves retry focus on the explanation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(response([product(1, 'https://different.example/product')])));
  const { container, shadow, stop } = setup();
  await vi.waitFor(() => expect(container.querySelector('button')).not.toBeNull());
  const retry = container.querySelector('button')!;
  retry.focus(); retry.click();
  await vi.waitFor(() => expect(container.textContent).toContain('These products are unavailable'));
  expect(shadow.activeElement).toBe(container.querySelector('[role="status"]'));
  expect(container.querySelector('ul')).toBeNull();
  stop();
});

it('ignores a late retry response after leaving the result', async () => {
  let recover!: (value: ReturnType<typeof response>) => void;
  const fetcher = vi.fn().mockRejectedValueOnce(Error('Offline'))
    .mockImplementationOnce(() => new Promise(resolve => { recover = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const { container, fallback, shadow, stop } = setup();
  await vi.waitFor(() => expect(container.querySelector('button')).not.toBeNull());
  container.querySelector('button')!.click();
  stop(); container.remove(); fallback.focus();
  recover(response([product(1)]));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
  expect(container.querySelector('a')).toBeNull();
  expect(shadow.activeElement).toBe(fallback);
});

it('reads category matches from their bounded endpoint without mixing in saved hand-picked IDs', async () => {
  const payload = document.createElement('script'); payload.id = 'wconvert-payload';
  payload.setAttribute('data-product-matches', `${location.origin}/wp-json/wconvert/v1/product-matches`);
  document.body.append(payload);
  const fetcher = vi.fn().mockResolvedValue(response([product(22), product(25), product(30), product(40)]));
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  const clicked = vi.fn();
  const filter = { category_id: 7, attributes: [{ taxonomy: 'pa_color', term_id: 9 }] };
  const stop = showProducts(container, { id: 'match', heading: 'Match', product_ids: [1], product_filter: filter }, clicked);
  await vi.waitFor(() => expect(container.querySelectorAll('a')).toHaveLength(3));
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.pathname).toBe('/wp-json/wconvert/v1/product-matches');
  expect(JSON.parse(url.searchParams.get('filter')!)).toEqual(filter);
  expect(url.searchParams.has('include[]')).toBe(false);
  expect(container.textContent).toContain('Product 22');
  expect(container.textContent).not.toContain('Product 40');
  container.querySelector('a')!.addEventListener('click', event => event.preventDefault());
  container.querySelector('a')!.click();
  expect(clicked).toHaveBeenCalledTimes(1);
  stop();
});

it('leaves an empty category result usable through its fallback', async () => {
  const payload = document.createElement('script'); payload.id = 'wconvert-payload';
  payload.setAttribute('data-product-matches', `${location.origin}/wp-json/wconvert/v1/product-matches`);
  document.body.append(payload);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([])));
  const container = document.createElement('div');
  const stop = showProducts(container, { id: 'match', heading: 'Match', product_filter: { category_id: 2, attributes: [] } });
  await vi.waitFor(() => expect(container.textContent).toContain('Please use the link below'));
  stop();
});

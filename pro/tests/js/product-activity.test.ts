import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { productActivity } from '../../modules/cart-recovery/loader/activity';
let intersect: IntersectionObserverCallback;
const observe = vi.fn(), disconnect = vi.fn();
const beacon = vi.fn(() => true);
let tracker: ReturnType<typeof productActivity>;
const card = { id: 42, name: 'Filter', url: '/filter', image: '', price: '$10', label: 'View product', activity_token: 'signed' };
beforeEach(() => {
  beacon.mockClear(); observe.mockClear(); disconnect.mockClear();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe = observe; unobserve = vi.fn(); disconnect = disconnect;
  });
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
  document.body.innerHTML = '<script id="wconvert-payload" data-commerce-activity="/?wc-ajax=wconvert_product_activity"></script><div id="host"></div>';
});
afterEach(() => { tracker?.stop(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function mount() {
  const host = document.getElementById('host')!;
  tracker = productActivity(host, 'campaign');
  const item = document.createElement('article'); item.innerHTML = '<a href="/filter">View product</a><button>Add to cart</button><a href="/cart">View basket</a>';
  host.append(item); tracker.card(item, card); return item;
}
function show(item: HTMLElement, visible = true) {
  intersect([{ target: item, isIntersecting: visible, intersectionRect: { width: visible ? 100 : 0, height: visible ? 100 : 0 } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
}
it('counts an intersecting product once across repaints, never every shortlisted product', () => {
  const item = mount(); show(item, false); expect(beacon).not.toHaveBeenCalled();
  show(item); show(item); expect(beacon).toHaveBeenCalledTimes(1);
  expect((beacon.mock.calls[0] as unknown as [string, URLSearchParams])[1].get('kind')).toBe('product_shown');
  tracker.reset(); tracker.card(item, card); show(item); expect(beacon).toHaveBeenCalledTimes(1);
});
it('counts only product links, once per appearance, separately from cart buttons', () => {
  const item = mount();
  item.addEventListener('click', event => event.preventDefault());
  item.querySelector('button')!.click(); item.querySelectorAll('a')[1].click(); expect(beacon).not.toHaveBeenCalled();
  item.querySelector('a')!.click(); item.querySelector('a')!.click(); expect(beacon).toHaveBeenCalledTimes(1);
  expect((beacon.mock.calls[0] as unknown as [string, URLSearchParams])[1].get('kind')).toBe('product_click');
});
it('ignores background tabs, closed campaigns and preview cards without a server proof', () => {
  const item = mount(); const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  show(item); expect(beacon).not.toHaveBeenCalled(); hidden.mockRestore();
  tracker.stop(); show(item); expect(beacon).not.toHaveBeenCalled();
  const host = document.getElementById('host')!; tracker = productActivity(host, 'campaign');
  tracker.card(item, { ...card, activity_token: undefined }); show(item); expect(beacon).not.toHaveBeenCalled();
});
it('does not equate a missing observer with a visible card', () => {
  vi.stubGlobal('IntersectionObserver', undefined); mount(); expect(beacon).not.toHaveBeenCalled();
});
it('retains observation counts across quiz result revisits and removes old observers', () => {
  const counts = { seen: new Set<number>(), clicked: new Set<number>() };
  const host = document.getElementById('host')!;
  const item = document.createElement('article'); item.innerHTML = '<a href="/filter">View product</a>'; host.append(item);
  item.addEventListener('click', event => event.preventDefault());
  tracker = productActivity(host, 'quiz', counts); tracker.card(item, card); show(item); item.querySelector('a')!.click();
  expect(beacon).toHaveBeenCalledTimes(2); tracker.stop();
  tracker = productActivity(host, 'quiz', counts); tracker.card(item, card); show(item); item.querySelector('a')!.click();
  expect(beacon).toHaveBeenCalledTimes(2);
});

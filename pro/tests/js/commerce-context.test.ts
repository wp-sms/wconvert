import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const consent = vi.hoisted(() => ({ allowed: true, changed: () => {} }));
vi.mock('@loader/consent', () => ({ hasConsent: () => consent.allowed, onConsentChange: (fn: () => void) => { consent.changed = fn; return () => {}; } }));
let dispose: (() => void) | undefined;
const answer = (holds: boolean) => ({ campaign: { known: true, rules: { 'campaign:r1': holds }, cards: [] } });
const response = (holds: boolean) => ({ ok: true, json: async () => answer(holds) });
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); consent.allowed = true;
  document.body.innerHTML = '<script id="wconvert-payload" data-commerce="/?wc-ajax=wconvert_cart_context">[{"id":"campaign","commerce_revision":"revision"}]</script>';
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(() => { dispose?.(); dispose = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('session cart projection', () => {
  it('deduplicates reads across conditions and clears facts when the final listener stops', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(true)); vi.stubGlobal('fetch', fetcher);
    const context = await import('../../modules/cart-recovery/loader/context');
    dispose = context.watchCart(() => {}); const other = context.watchCart(() => {});
    expect(context.cartMatch('campaign:r1')).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(context.cartMatch('campaign:r1')).toBe(true);
    other(); dispose(); expect(context.cartMatch('campaign:r1')).toBe(false);
  });
  it('invalidates immediately and ignores a late response from a previous cart', async () => {
    let finish: (value: unknown) => void = () => {};
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(response(false)));
    const context = await import('../../modules/cart-recovery/loader/context'); dispose = context.watchCart(() => {});
    await vi.advanceTimersByTimeAsync(0);
    document.dispatchEvent(new Event('wc-blocks_added_to_cart'));
    await vi.advanceTimersByTimeAsync(50);
    finish(response(true)); await vi.advanceTimersByTimeAsync(0);
    expect(context.cartMatch('campaign:r1')).toBe(false); expect(context.contextStatus()).toBe('ready');
  });
  it('clears the projection on consent withdrawal and does not read in a hidden tab', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(true)); vi.stubGlobal('fetch', fetcher);
    const context = await import('../../modules/cart-recovery/loader/context'); dispose = context.watchCart(() => {});
    await vi.advanceTimersByTimeAsync(0); consent.allowed = false; consent.changed();
    expect(context.cartMatch('campaign:r1')).toBe(false);
    await vi.advanceTimersByTimeAsync(50); expect(context.contextStatus()).toBe('consent-blocked');
    consent.allowed = true; Object.defineProperty(document, 'visibilityState', { value: 'hidden' }); consent.changed();
    await vi.advanceTimersByTimeAsync(60000); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('expires facts before attempting a refresh and rejects malformed answers', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(true)).mockResolvedValue({ ok: true, json: async () => ({ campaign: { known: true, rules: { 'campaign:r1': 'yes' }, cards: [] } }) });
    vi.stubGlobal('fetch', fetcher);
    const context = await import('../../modules/cart-recovery/loader/context'); dispose = context.watchCart(() => {});
    await vi.advanceTimersByTimeAsync(0); expect(context.cartMatch('campaign:r1')).toBe(true);
    await vi.advanceTimersByTimeAsync(30000); expect(context.cartMatch('campaign:r1')).toBe(false);
  });
  it('observes Blocks quantity/coupon store changes without sending cart contents', async () => {
    let changed = () => {}; let cart = {}; const unsubscribe = vi.fn();
    vi.stubGlobal('wp', { data: { select: () => ({ getCartData: () => cart }), subscribe: (fn: () => void) => { changed = fn; return unsubscribe; } } });
    const fetcher = vi.fn().mockResolvedValue(response(true)); vi.stubGlobal('fetch', fetcher);
    const context = await import('../../modules/cart-recovery/loader/context'); dispose = context.watchCart(() => {});
    await vi.advanceTimersByTimeAsync(0); changed(); await vi.advanceTimersByTimeAsync(50);
    expect(fetcher).toHaveBeenCalledTimes(1);
    cart = {}; changed(); expect(context.cartMatch('campaign:r1')).toBe(false);
    await vi.advanceTimersByTimeAsync(50); expect(fetcher).toHaveBeenCalledTimes(2);
    expect([...fetcher.mock.calls[1][1].body.keys()]).toEqual(['campaigns']);
    dispose(); expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

it('sends only the server-issued product-page context alongside published campaign revisions', async () => {
  document.getElementById('wconvert-payload')!.setAttribute('data-commerce-product', '12:server-issued-signature');
  const fetcher = vi.fn().mockResolvedValue(response(true)); vi.stubGlobal('fetch', fetcher);
  const context = await import('../../modules/cart-recovery/loader/context'); dispose = context.watchCart(() => {});
  await vi.advanceTimersByTimeAsync(0);
  const body = fetcher.mock.calls[0][1].body as URLSearchParams;
  expect([...body.keys()]).toEqual(['campaigns', 'page_product']);
  expect(body.get('page_product')).toBe('12:server-issued-signature');
  expect(JSON.parse(body.get('campaigns')!)).toEqual({ campaign: 'revision' });
});

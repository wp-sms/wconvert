import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@loader/consent', () => ({ hasConsent: () => true }));
beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<script id="wconvert-payload" data-commerce-begin="/?wc-ajax=wconvert_cart_begin" data-commerce-add="/?wc-ajax=wconvert_cart_add">[{"id":"campaign","commerce_revision":"rev"}]</script>';
});
afterEach(() => vi.unstubAllGlobals());
const reply = (data: unknown) => ({ ok: true, json: async () => data });
it('adds quantity one only after acquiring fresh session protection', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ token: 'signed' })).mockResolvedValueOnce(reply({ state: 'added', product: 12 })); vi.stubGlobal('fetch', fetcher);
  const { additionSession } = await import('../../modules/cart-recovery/loader/addition');
  expect(await additionSession('campaign').add(12)).toBe('added');
  const body = fetcher.mock.calls[1][1].body as URLSearchParams;
  expect(body.get('token')).toBe('signed'); expect(body.get('product')).toBe('12'); expect(body.has('quantity')).toBe(false);
});
it('does not retry a lost mutation response or start a duplicate while pending', async () => {
  let fail: (error: Error) => void = () => {};
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ token: 'signed' })).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; })); vi.stubGlobal('fetch', fetcher);
  const { additionSession } = await import('../../modules/cart-recovery/loader/addition');
  const session = additionSession('campaign'); const pending = session.add(12);
  expect(await session.add(12)).toBe('busy');
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2)); fail(new Error('connection lost'));
  expect(await pending).toBe('unknown'); expect(fetcher).toHaveBeenCalledTimes(2);
  expect(await session.add(12)).toBe('unknown'); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not send a mutation when protection cannot be acquired', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher);
  const { additionSession } = await import('../../modules/cart-recovery/loader/addition');
  expect(await additionSession('campaign').add(12)).toBe('rejected'); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('recognizes an explicit pre-mutation refusal instead of calling it an unknown addition', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ token: 'signed' })).mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ state: 'rejected' }) }));
  const { additionSession } = await import('../../modules/cart-recovery/loader/addition');
  expect(await additionSession('campaign').add(12)).toBe('rejected');
});
it('refreshes the native cart without emitting the event that opens drawers', async () => {
  const added = vi.fn(); const sync = vi.fn(); const trigger = vi.fn();
  document.addEventListener('wc-blocks_added_to_cart', added); window.addEventListener('wc-blocks_store_sync_required', sync);
  vi.stubGlobal('jQuery', () => ({ trigger }));
  const { refreshNativeCart } = await import('../../modules/cart-recovery/loader/addition'); refreshNativeCart();
  expect(sync).toHaveBeenCalledOnce(); expect(trigger).toHaveBeenCalledWith('wc_fragment_refresh'); expect(added).not.toHaveBeenCalled();
  document.removeEventListener('wc-blocks_added_to_cart', added); window.removeEventListener('wc-blocks_store_sync_required', sync);
});

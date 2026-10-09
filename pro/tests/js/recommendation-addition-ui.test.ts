import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/dom';
import { renderProductNode } from '../../modules/cart-recovery/loader/products';
const state = vi.hoisted(() => ({ add: vi.fn(), refresh: vi.fn(), changed: () => {}, status: 'ready', cards: [
  { id: 1, name: 'Filter', price: '$15', url: '/filter', image: '', label: 'Add to cart', can_add: true },
  { id: 2, name: 'Grinder', price: '$30', url: '/grinder', image: '', label: 'Choose options', can_add: false },
] }));
vi.mock('../../modules/cart-recovery/loader/context', () => ({ cartCards: () => state.status === 'ready' ? state.cards : [], contextStatus: () => state.status, watchCart: (fn: () => void) => { state.changed = fn; return () => {}; } }));
vi.mock('../../modules/cart-recovery/loader/addition', () => ({ additionSession: () => ({ add: state.add }), refreshNativeCart: state.refresh }));
beforeEach(() => { state.status = 'ready'; state.add.mockReset(); state.refresh.mockReset(); document.body.innerHTML = '<script id="wconvert-payload" data-commerce-cart="/cart"></script><div class="wc-root"></div>'; });
function mount() { const host = renderProductNode({ type: 'products', action: 'add_to_cart', product_ids: [1, 2], context_key: 'campaign' })!; document.querySelector('.wc-root')!.append(host); return host; }
it('counts only accepted additions; option and product links remain supporting navigation', async () => {
  state.add.mockResolvedValue('added'); const host = mount(); const convert = vi.fn(); host.addEventListener('wconvert:cart-added', convert);
  expect(host.querySelector('[data-convert]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart: Filter' }));
  await vi.waitFor(() => expect(screen.getByText('Added to your basket.')).toBeTruthy());
  expect(convert).toHaveBeenCalledOnce(); expect(state.refresh).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Added: Filter' })); expect(state.add).toHaveBeenCalledOnce();
  state.status = 'pending'; state.changed(); expect(screen.getByRole('link', { name: 'Choose options: Grinder' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'View basket' }).getAttribute('href')).toContain('/cart');
});
it('keeps unknown outcomes explicit and blocks another activation', async () => {
  state.add.mockResolvedValue('unknown'); const host = mount(); const convert = vi.fn(); host.addEventListener('wconvert:cart-added', convert);
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart: Filter' }));
  await vi.waitFor(() => expect(screen.getByText('Check your basket before trying again.')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart: Filter' }));
  expect(state.add).toHaveBeenCalledOnce(); expect(convert).not.toHaveBeenCalled();
});
it('does not announce a late addition in a closed campaign', async () => {
  let done: (state: string) => void = () => {}; state.add.mockImplementation(() => new Promise(resolve => { done = resolve; }));
  const host = mount(); const convert = vi.fn(); host.addEventListener('wconvert:cart-added', convert); await Promise.resolve();
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart: Filter' }));
  document.querySelector('.wc-root')!.dispatchEvent(new Event('wconvert:closed')); done('added'); await Promise.resolve();
  expect(convert).not.toHaveBeenCalled();
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CollectionShelf } from '../../resources/admin/src/discovery/CollectionShelf';
import type { Collection } from '../../resources/admin/src/discovery/api';
const collection: Collection = { id: 'useful', revision: 'r', name: 'Useful starts', description: 'Useful ideas', cover: 'reading', priority: 1, business_types: [], markets: [], items: [] };
const props = { matches: [{ collection, setups: [], designs: 1 }], disabled: false, onOpen: vi.fn(), onAll: vi.fn(), onHide: vi.fn() };
afterEach(() => { vi.restoreAllMocks(); document.documentElement.removeAttribute('dir'); });
function geometry(scroll: number, direction = 'ltr') {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scroll);
  document.documentElement.dir = direction;
}
it('hides arrows when collection cards fit, while keeping View all', async () => {
  geometry(400); render(<CollectionShelf {...props} />);
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(screen.queryByRole('button', { name: 'Next collections' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View all' })).toBeEnabled();
});
it.each(['ltr', 'rtl'])('disables arrows at both ends of the %s shelf', async direction => {
  geometry(1000, direction); render(<CollectionShelf {...props} />);
  const shelf = screen.getByRole('group', { name: 'Collection cards' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Previous collections' })).toBeDisabled());
  expect(screen.getByRole('button', { name: 'Next collections' })).toBeEnabled();
  Object.defineProperty(shelf, 'scrollLeft', { value: direction === 'rtl' ? -600 : 600 });
  fireEvent.scroll(shelf);
  expect(screen.getByRole('button', { name: 'Previous collections' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Next collections' })).toBeDisabled();
});

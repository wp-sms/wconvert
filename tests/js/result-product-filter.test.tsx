import { useState } from 'react';
import type { ResultProductFilter as Filter } from '../../resources/renderer/src/types';
import { ProductPicker } from '../../resources/admin/src/builder/ResultProductPicker';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import { LiveProductMatches, ResultProductFilter } from '../../resources/admin/src/builder/ResultProductFilter';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('keeps an incomplete filter visible and changes its value without losing the category', async () => {
  vi.mocked(apiFetch).mockImplementation(async ({ path }) => ({ items: path?.includes('taxonomy=attributes') ? [{ id: 'pa_color', name: 'Color' }] : path?.includes('taxonomy=pa_color') ? [{ id: '9', name: 'Blue' }] : [{ id: '7', name: 'Mugs' }], more: false }));
  const onChange = vi.fn();
  render(<ResultProductFilter value={{ category_id: 7, attributes: [{ taxonomy: 'pa_color', term_id: 0 }] }} onChange={onChange} />);
  await waitFor(() => expect(screen.getByRole('option', { name: 'Blue' })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Value' }), '9');
  expect(onChange).toHaveBeenCalledWith({ category_id: 7, attributes: [{ taxonomy: 'pa_color', term_id: 9 }] });
  expect(screen.getByRole('button', { name: 'Add attribute filter' })).toBeDisabled();
});

it('does not fetch incomplete matches and explains empty and failed reads', async () => {
  const { rerender } = render(<LiveProductMatches filter={{ category_id: 0, attributes: [] }} />);
  expect(apiFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Choose a category');
  vi.mocked(apiFetch).mockResolvedValueOnce([]);
  rerender(<LiveProductMatches filter={{ category_id: 7, attributes: [] }} />);
  await screen.findByText('No available matches. Visitors can use your fallback link.');
  vi.mocked(apiFetch).mockRejectedValueOnce(Error('Removed'));
  rerender(<LiveProductMatches filter={{ category_id: 8, attributes: [] }} />);
  await screen.findByRole('alert');
  vi.mocked(apiFetch).mockResolvedValueOnce([{ id: 1, name: 'Blue mug', permalink: '/mug' }]);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('link', { name: 'Blue mug' })).toHaveAttribute('href', '/mug');
});

it('ignores stale preview responses after changing filters', async () => {
  let old!: (items: unknown) => void;
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { old = resolve; })).mockResolvedValueOnce([{ id: 2, name: 'New match', permalink: '/new' }]);
  const { rerender } = render(<LiveProductMatches filter={{ category_id: 7, attributes: [] }} />);
  rerender(<LiveProductMatches filter={{ category_id: 8, attributes: [] }} />);
  await screen.findByRole('link', { name: 'New match' });
  old([{ id: 1, name: 'Old match', permalink: '/old' }]);
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Old match' })).toBeNull());
});

it('changes ordering without losing filters and loads curation only when opened', async () => {
  vi.mocked(apiFetch).mockImplementation(async ({ path }) => path?.includes('/wc/store/') ? [] : { items: [], more: false });
  const original: Filter = { category_id: 7, attributes: [], pinned_ids: [2], excluded_ids: [3] };
  const onChange = vi.fn();
  render(<ResultProductFilter value={original} onChange={onChange} />);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Product order' }), 'price_low');
  expect(onChange).toHaveBeenCalledWith({ ...original, order: 'price_low' });
  expect(vi.mocked(apiFetch).mock.calls.some(([args]) => args.path?.includes('/wc/store/'))).toBe(false);
  await userEvent.click(screen.getByText('Pin or exclude products (1 pinned, 1 excluded)'));
  expect(await screen.findByLabelText('Find products to pin')).toBeInTheDocument();
  expect(screen.getByLabelText('Find products to exclude')).toBeInTheDocument();
});

it('reorders pins, removes a pin and enforces the pin limit', async () => {
  vi.mocked(apiFetch).mockResolvedValue([{ id: 1, name: 'One' }, { id: 2, name: 'Two' }, { id: 3, name: 'Three' }, { id: 4, name: 'Four' }]);
  function Harness() { const [ids, setIds] = useState([1, 2, 3]); return <><ProductPicker ids={ids} onChange={setIds} max={3} /><output>{ids.join(',')}</output></>; }
  render(<Harness />);
  await userEvent.click(await screen.findByRole('button', { name: 'Move earlier: Two' }));
  expect(screen.getByRole('status')).toHaveTextContent('2,1,3');
  await userEvent.type(screen.getByLabelText('Find products'), 'Four');
  await userEvent.click(screen.getByRole('button', { name: 'Search catalog' }));
  expect((await screen.findAllByRole('button', { name: /^Add:/ })).every(button => button.hasAttribute('disabled'))).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Remove: One' }));
  expect(screen.getByRole('status')).toHaveTextContent('2,3');
  expect(screen.getAllByRole('button', { name: /^Add:/ })[3]).toBeEnabled();
});

it('allows excluding out-of-stock products without ordering controls', async () => {
  vi.mocked(apiFetch).mockResolvedValue([{ id: 4, name: 'Unavailable mug', is_in_stock: false }]);
  const onChange = vi.fn();
  render(<ProductPicker ids={[]} onChange={onChange} max={12} ordered={false} allowUnavailable />);
  await userEvent.type(screen.getByLabelText('Find products'), 'mug');
  await userEvent.click(screen.getByRole('button', { name: 'Search catalog' }));
  await userEvent.click(await screen.findByRole('button', { name: /^Add:/ }));
  expect(onChange).toHaveBeenCalledWith([4]);
  expect(screen.queryByRole('button', { name: /Move earlier/ })).toBeNull();
});

it('explains missing pins but ignores intentionally excluded pins', async () => {
  vi.mocked(apiFetch).mockResolvedValue([{ id: 1, name: 'Match', permalink: '/match' }]);
  const { rerender } = render(<LiveProductMatches filter={{ category_id: 7, attributes: [], pinned_ids: [2] }} />);
  await screen.findByText('A pinned product is unavailable or does not match. Other matches appear below.');
  rerender(<LiveProductMatches filter={{ category_id: 7, attributes: [], pinned_ids: [2], excluded_ids: [2] }} />);
  await screen.findByRole('link', { name: 'Match' });
  expect(screen.queryByText(/A pinned product/)).toBeNull();
});


it('supports keyboard search and explains empty results', async () => {
  vi.mocked(apiFetch).mockResolvedValue([]);
  render(<ProductPicker ids={[]} onChange={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Find products'), 'missing{Enter}');
  expect(await screen.findByRole('status')).toHaveTextContent('No products found. Try another name.');
});

it('drops old search results when the query changes and offers a working retry', async () => {
  let finish!: (items: unknown) => void;
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<ProductPicker ids={[]} onChange={vi.fn()} actionLabel="Pin" />);
  const input = screen.getByLabelText('Find products');
  await userEvent.type(input, 'old{Enter}');
  await userEvent.clear(input);
  await userEvent.type(input, 'new');
  finish([{ id: 1, name: 'Old product' }]);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Pin: Old product' })).toBeNull());
  vi.mocked(apiFetch).mockRejectedValueOnce(Error('offline'));
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Products could not load');
  vi.mocked(apiFetch).mockResolvedValueOnce([{ id: 2, name: 'New product' }]);
  await userEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  expect(await screen.findByRole('button', { name: 'Pin: New product' })).toBeEnabled();
});

it('keeps the selection when names cannot load and retries in place', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(Error('offline'));
  const onChange = vi.fn();
  render(<ProductPicker ids={[3]} onChange={onChange} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your selection is kept');
  expect(screen.getByRole('button', { name: 'Remove: Product #3' })).toBeEnabled();
  vi.mocked(apiFetch).mockResolvedValueOnce([{ id: 3, name: 'Recovered name' }]);
  await userEvent.click(screen.getByRole('button', { name: 'Retry names' }));
  expect(await screen.findByRole('button', { name: 'Remove: Recovered name' })).toBeEnabled();
  expect(onChange).not.toHaveBeenCalled();
});

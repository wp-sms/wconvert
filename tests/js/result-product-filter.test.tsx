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

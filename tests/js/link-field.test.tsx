import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * One box for a link: an address is kept as typed, words find a page.
 *
 * The search and the `aria-activedescendant` pattern are `ObjectPicker`'s,
 * shared through `useObjectSearch`; `builder-object-picker.test.tsx` covers
 * them there. What only this file can prove is the split between the two
 * kinds of typing, and that a pick stores the permalink rather than an id.
 */
const objects = vi.hoisted(() => ({ searchLinks: vi.fn() }));

vi.mock('../../resources/admin/src/builder/rules/objects', () => objects);

const { LinkField, looksLikeAddress } = await import('../../resources/admin/src/builder/LinkField');

const PRICING = { id: '42', title: 'Pricing', url: 'https://shop.test/pricing/', subtype: 'page' };
const PRICES = { id: '77', title: 'Price list', url: 'https://shop.test/price-list/', subtype: 'product' };

function field(initial = '') {
  const changes = vi.fn();
  function Host() {
    const [value, setValue] = useState(initial);
    return <><label htmlFor="link">Where it goes</label><LinkField id="link" value={value} onChange={(next) => { setValue(next); changes(next); }} /></>;
  }
  render(<Host />);
  return changes;
}

const box = () => screen.getByRole('combobox', { name: 'Where it goes' });
const act250 = () => act(() => new Promise((resolve) => setTimeout(resolve, 300)));

beforeEach(() => {
  objects.searchLinks.mockReset().mockResolvedValue([PRICING, PRICES]);
});

describe('LinkField', () => {
  it.each(['https://shop.test/sale', '/shop/', '#offer', 'mailto:hi@shop.test', 'shop.test/sale'])('keeps %s as typed, without searching', async (address) => {
    const changes = field();
    await userEvent.type(box(), address);
    await act250();

    expect(changes).toHaveBeenLastCalledWith(address);
    expect(box()).toHaveValue(address);
    expect(objects.searchLinks).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('searches words, and picking stores the permalink', async () => {
    const changes = field();
    await userEvent.type(box(), 'pric');
    await act250();

    expect(objects.searchLinks).toHaveBeenCalledTimes(1);
    expect(objects.searchLinks.mock.calls[0][0]).toBe('pric');
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    const option = screen.getByRole('option', { name: /Pricing/ });
    expect(option).toHaveTextContent('Page');
    expect(screen.getByRole('option', { name: /Price list/ })).toHaveTextContent('Product');

    await userEvent.click(option);

    expect(changes).toHaveBeenLastCalledWith(PRICING.url);
    expect(box()).toHaveValue(PRICING.url);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('picks with the keyboard while focus stays in the box', async () => {
    const changes = field();
    await userEvent.type(box(), 'pric');
    await act250();

    expect(box()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Pricing/ }).id);
    await userEvent.keyboard('{ArrowDown}');
    expect(box()).toHaveFocus();
    expect(box()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Price list/ }).id);

    await userEvent.keyboard('{Enter}');

    expect(changes).toHaveBeenLastCalledWith(PRICES.url);
  });

  it('closes on Escape and keeps what was typed', async () => {
    const changes = field();
    await userEvent.type(box(), 'pric');
    await act250();
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(changes).toHaveBeenLastCalledWith('pric');
  });

  it('says a search failed rather than that nothing matched, and retries', async () => {
    objects.searchLinks.mockRejectedValueOnce(new Error('Offline'));
    field();
    await userEvent.type(box(), 'pric');
    await act250();

    expect(screen.getByText(/Search couldn’t be completed/)).toBeVisible();
    expect(screen.queryByRole('option')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    await act250();

    await waitFor(() => expect(screen.getByRole('option', { name: /Pricing/ })).toBeVisible());
    expect(objects.searchLinks).toHaveBeenCalledTimes(2);
    expect(box()).toHaveFocus();
  });

  it('forwards its ref to the input, so a readiness repair can focus it', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<LinkField ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBe(screen.getByRole('combobox'));
  });
});

describe('looksLikeAddress', () => {
  it.each([
    ['https://a.test', true], ['/shop/', true], ['#top', true], ['?ref=1', true], ['tel:+1555', true],
    ['www.shop.test', true], ['shop.test/sale', true], ['gift ideas', false], ['pricing', false], ['', false],
  ])('%s → %s', (text, expected) => expect(looksLikeAddress(text)).toBe(expected));
});

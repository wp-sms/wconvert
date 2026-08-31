import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Targeting a page by its NAME, instead of by typing a number.
 *
 * ============================================================================
 * WHAT IS ASSERTED HERE IS THE KEYBOARD AND THE FALLBACK, NOT THE POPUP.
 * ============================================================================
 * The positioning is `components/ui/popover.tsx`'s, vendored unchanged
 * (ADR 0036), and jsdom computes no layout — so there is nothing about it a
 * test here could prove. What only this file can prove is the two things that
 * were decisions:
 *
 * - **`aria-activedescendant`, not roving tabindex.** DOM focus stays on the
 *   input for the whole interaction. Moving it into the list is the common
 *   mistake that breaks typeahead, and it is the "fix" a future reader is
 *   likeliest to apply to make this match `BlockTree`.
 * - **A stored id that resolves to nothing renders `#42`.** Core hard-codes
 *   `post_status => 'publish'` in the search handler, so an unpublished post
 *   is absent from the answer — and an empty box would read as "your rule is
 *   gone" about a rule that is intact.
 */
const objects = vi.hoisted(() => ({
  searchObjects: vi.fn(),
  resolveObjects: vi.fn(),
}));

vi.mock('../../resources/admin/src/builder/rules/objects', () => objects);

const { ObjectPicker } = await import('../../resources/admin/src/builder/rules/ObjectPicker');

const PRICING = { id: '42', title: 'Pricing' };
const PRICES = { id: '77', title: 'Prices' };

function picker(value = '', onChange = vi.fn()) {
  render(
    <>
      <label htmlFor="pick">Page or post</label>
      <ObjectPicker id="pick" kind="post" value={value} onChange={onChange} />
    </>,
  );

  return onChange;
}

const box = () => screen.getByRole('combobox', { name: 'Page or post' });

const type = async (text: string) => {
  await userEvent.click(box());
  await userEvent.type(box(), text);
  // The search is debounced by 250ms so a typed word is one request rather
  // than one per keystroke — a site with 50,000 posts is the ordinary case.
  await act250();
};

/**
 * Wait past the debounce, inside `act`.
 *
 * The state update lands from a timer rather than from an event, so React has
 * no way to attribute it to anything the test did — outside `act` it is a
 * warning on every assertion in this file.
 */
const act250 = () => act(() => new Promise((resolve) => setTimeout(resolve, 300)));

beforeEach(() => {
  objects.searchObjects.mockReset().mockResolvedValue([PRICING, PRICES]);
  objects.resolveObjects.mockReset().mockResolvedValue([]);
});

describe('finding a page', () => {
  it('searches what is typed and lists what came back, with the id', async () => {
    picker();
    await type('pri');

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    expect(objects.searchObjects).toHaveBeenCalledWith('post', 'pri', expect.anything());
    // The id is always shown: two pages genuinely do share a title.
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Pricing #42');
  });

  it('debounces, so typing a word is one request rather than one per letter', async () => {
    picker();
    await type('pric');

    await waitFor(() => expect(objects.searchObjects).toHaveBeenCalledTimes(1));
  });

  /** A merchant who cannot see the list is told how many there are. */
  it('announces the result count in a status region', async () => {
    picker();
    await type('pri');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 results'));
  });

  /**
   * Core hard-codes `post_status => 'publish'`, so a draft landing page cannot
   * be found by title at all. The empty state says so rather than implying the
   * page does not exist.
   */
  it('says why nothing was found rather than showing a blank list', async () => {
    objects.searchObjects.mockResolvedValue([]);

    picker();
    await type('draft');

    await waitFor(() => expect(screen.getByText(/Only published items can be found by name/)).toBeInTheDocument());
  });
});

describe('the keyboard', () => {
  /**
   * ==========================================================================
   * FOCUS NEVER LEAVES THE INPUT. THIS IS THE ASSERTION TO BREAK LOUDLY.
   * ==========================================================================
   * The highlight moves through `aria-activedescendant`; the caret stays where
   * the merchant is typing. Moving real focus into the list — which is what
   * matching `BlockTree`'s roving tabindex would mean — breaks typeahead and
   * confuses screen readers.
   */
  it('moves the highlight with the arrows and leaves focus on the input', async () => {
    picker();
    await type('pri');

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await userEvent.keyboard('{ArrowDown}');

    expect(box()).toHaveFocus();
    expect(box()).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps around, and Home and End go to the ends', async () => {
    picker();
    await type('pri');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await userEvent.keyboard('{ArrowUp}');

    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Home}');

    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{End}');

    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('commits the highlighted match on Enter, storing the id as a string', async () => {
    const changed = picker();

    await type('pri');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(changed).toHaveBeenCalledWith('77');
  });

  /**
   * **Esc commits nothing.** A merchant who thought better of a search still
   * has the rule they had — a highlight is not a choice.
   */
  it('closes on Escape without changing what is stored', async () => {
    const changed = picker('42');

    await type('pri');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await userEvent.keyboard('{ArrowDown}{Escape}');

    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).toBeNull();
  });

  /** And so does Tab, for the same reason. */
  it('closes on Tab without committing the highlight', async () => {
    const changed = picker();

    await type('pri');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await userEvent.keyboard('{ArrowDown}{Tab}');

    expect(changed).not.toHaveBeenCalled();
  });
});

describe('a value already stored', () => {
  it('reads back as its title, resolved through include[]', async () => {
    objects.resolveObjects.mockResolvedValue([PRICING]);

    picker('42');

    await waitFor(() => expect(box()).toHaveValue('Pricing (#42)'));
    expect(objects.resolveObjects).toHaveBeenCalledWith('post', ['42'], expect.anything());
  });

  /**
   * ==========================================================================
   * AN UNPUBLISHED OR DELETED PAGE RENDERS `#42`, NEVER AN EMPTY BOX.
   * ==========================================================================
   * Core hard-codes `post_status => 'publish'` in the search handler, so
   * `include[]` comes back with nothing for a post that was unpublished after
   * the rule was written. The rule is intact and still targets that id; an
   * empty box would tell the merchant it was gone.
   */
  it('falls back to the raw id when the page can no longer be resolved', async () => {
    objects.resolveObjects.mockResolvedValue([]);

    picker('42');

    await waitFor(() => expect(box()).toHaveValue('#42'));
  });

  /** A lookup that fails outright is the same case, and reads the same way. */
  it('falls back to the raw id when the lookup fails', async () => {
    objects.resolveObjects.mockRejectedValue(new Error('500'));

    picker('42');

    await waitFor(() => expect(box()).toHaveValue('#42'));
  });

  it('shows nothing at all when nothing is stored', () => {
    picker();

    expect(box()).toHaveValue('');
    expect(objects.resolveObjects).not.toHaveBeenCalled();
  });
});

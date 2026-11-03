import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RegionError, RegionErrorState, RegionHeader } from '../../resources/admin/src/shell/Region';

/**
 * **A region's error is a whole sentence, and `AlertTitle` ships
 * `line-clamp-1`.**
 *
 * The vendored default truncates to one line with an ellipsis, which on a
 * region error is the only thing on screen saying what went wrong. Two call
 * sites in this admin remembered to undo it per-call; these two did not, and
 * the fix is in the component that decides what an error looks like rather
 * than in the next screen that renders one.
 *
 * Asserted as the class, not as a rendered height: Vitest runs jsdom with
 * `css: false` and lays nothing out.
 */
const LONG =
  'The Goal registry could not be read because the site’s REST API returned 403 for this user, ' +
  'so the rows below are labelled with the ids they store rather than with their names.';

describe('a region error', () => {
  it('does not clamp the message to one line', () => {
    render(<RegionError message={LONG} />);

    const title = screen.getByText(LONG);

    expect(title).toHaveClass('line-clamp-none');
    expect(title).not.toHaveClass('line-clamp-1');
  });

  it('does not clamp it in the state where the alert IS the region', () => {
    render(<RegionErrorState message={LONG} hint="Reload the page to try again." />);

    expect(screen.getByText(LONG)).toHaveClass('line-clamp-none');
  });
});

describe('a region header’s tip', () => {
  it('stands beside the title, named after it', () => {
    render(<RegionHeader title="Accounts" tip="What an account is." />);
    const tip = screen.getByRole('button', { name: 'About Accounts' });
    expect(screen.getByRole('heading', { level: 2, name: 'Accounts' }).nextElementSibling).toBe(tip);
    expect(screen.queryByText('What an account is.')).toBeNull();
  });

  it('draws no control without one', () => {
    render(<RegionHeader title="Accounts" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

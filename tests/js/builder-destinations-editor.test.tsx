import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DestinationsEditor } from '../../resources/admin/src/builder/DestinationsEditor';
import type { Destination } from '../../resources/admin/src/destinations/api';

/**
 * ============================================================================
 * THE TAB WHERE THE CHOICE IS MADE, AND IT USED TO SAY NOTHING ABOUT IT.
 * ============================================================================
 * This screen drew `☐ MailPoet` and nothing else. That was survivable while
 * one [[Destination]] per type was all the admin allowed — the name and the
 * type were the same word, so there was nothing more to know. It stops being
 * survivable the moment a merchant may have two: *"MailPoet"* over
 * *"MailPoet"* is a pair of checkboxes nobody can tell apart, on the one
 * screen where the difference decides where their [[Lead]]s go.
 *
 * So a row carries **the merchant's name and where that route lands**, and the
 * two are different jobs: the name is the accessible name of the control, and
 * the target only DESCRIBES it. Folding the second into the `<label>` would
 * make a screen reader announce the whole sentence as the checkbox's name, and
 * rename the control every time somebody re-pointed the route.
 *
 * **Nothing rendered this component at all before now.** Its behaviour was
 * reachable only through `builder-shell.test.tsx`, which mounts a whole
 * builder to get to it.
 */

const destination = (over: Partial<Destination> & { id: string; label: string }): Destination => ({
  type: 'mailpoet',
  connection: null,
  settings: {},
  target: null,
  availability: 'ready',
  health: {
    last_success_at: null,
    last_error: null,
    last_error_at: null,
    consecutive_failures: 0,
    skipped_captures: 0,
    last_skipped_at: null,
  },
  ...over,
});

const editor = (available: Destination[], bound: string[] = []) =>
  render(
    <DestinationsEditor
      bound={bound}
      available={available}
      hint={null}
      onChange={vi.fn()}
    />,
  );

const rowFor = (name: string): HTMLElement => {
  const item = screen.getByRole('checkbox', { name }).closest('li');

  if (item === null) {
    throw new Error(`No row around “${name}”.`);
  }

  return item;
};

describe('binding an optin to a destination', () => {
  /**
   * **Two routes of one type, told apart by what they are for.** This is the
   * whole reason a Destination carries a name, and the case the admin used to
   * forbid outright by disabling *Add* once one of a type existed.
   */
  it('names each route and says where it lands', () => {
    editor([
      destination({ id: 'a', label: 'Newsletter signups', target: 'Newsletter' }),
      destination({ id: 'b', label: 'Product announcements', target: 'Product updates' }),
    ]);

    expect(within(rowFor('Newsletter signups')).getByText('Sending to Newsletter.')).toBeInTheDocument();
    expect(
      within(rowFor('Product announcements')).getByText('Sending to Product updates.'),
    ).toBeInTheDocument();
  });

  /**
   * **The name is the accessible name, and the target describes it.** A
   * checkbox called "Newsletter signups Sending to Newsletter." is a control
   * that renames itself whenever the route is re-pointed.
   */
  it('describes the checkbox with the target rather than naming it', () => {
    editor([destination({ id: 'a', label: 'Newsletter signups', target: 'Newsletter' })]);

    const checkbox = screen.getByRole('checkbox', { name: 'Newsletter signups' });

    expect(checkbox).toHaveAccessibleName('Newsletter signups');
    expect(checkbox).toHaveAccessibleDescription('Sending to Newsletter.');
  });

  /**
   * **A type that selects nothing gets no line at all**, which is the trap
   * this feature is built around: the lead-magnet email's URL, subject and
   * body are configuration rather than a target, so it is perfectly configured
   * — and *"not pointed at anything yet"* under it reports a fault against an
   * integration that delivers. An unreachable provider answers `null` for the
   * same reason and gets the same silence (ADR 0042).
   */
  it('says nothing about a destination that selects nothing', () => {
    editor([destination({ id: 'a', label: 'The guide', type: 'lead_magnet_email', target: null })]);

    const row = rowFor('The guide');

    expect(within(row).queryByText(/Sending to/)).toBeNull();
    expect(within(row).queryByText(/Not pointed/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'The guide' })).not.toHaveAccessibleDescription();
  });

  /**
   * **The one state that IS worth saying.** A MailPoet route with no list
   * ticked will push nowhere useful, and that changes what the merchant does
   * next — which is exactly the test ADR 0042 sets.
   */
  it('says so where a destination selects something and nothing is chosen', () => {
    editor([destination({ id: 'a', label: 'Newsletter signups', target: '' })]);

    expect(screen.getByText('Not pointed at anything yet.')).toBeInTheDocument();
  });

  /**
   * The target sits beside what was already there rather than in place of it:
   * a Destination whose type is not running is skipped at dispatch, and that
   * is a different fact from where it would have landed (#4, ADR 0008).
   */
  it('keeps the not-running note beside the target', () => {
    editor([
      destination({
        id: 'a',
        label: 'Newsletter signups',
        target: 'Newsletter',
        availability: 'unavailable',
      }),
    ]);

    const row = rowFor('Newsletter signups');

    expect(within(row).getByText('Sending to Newsletter.')).toBeInTheDocument();
    expect(within(row).getByText(/Not running here/)).toBeInTheDocument();
  });

  it('ticks the destinations this optin is bound to', () => {
    editor(
      [
        destination({ id: 'a', label: 'Newsletter signups', target: 'Newsletter' }),
        destination({ id: 'b', label: 'Product announcements', target: 'Product updates' }),
      ],
      ['b'],
    );

    expect(screen.getByRole('checkbox', { name: 'Newsletter signups' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Product announcements' })).toBeChecked();
  });
});

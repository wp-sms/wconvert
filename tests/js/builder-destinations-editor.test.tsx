import { useState, type ComponentProps } from 'react';
import { CAPTURE_OUTCOME } from './support/outcomes';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationsEditor } from '../../resources/admin/src/builder/DestinationsEditor';
import { LOADING, failed, ready } from '../../resources/admin/src/shell/loadable';
import type { Loadable } from '../../resources/admin/src/shell/loadable';
import type { Destination, DestinationType } from '../../resources/admin/src/destinations/api';
import type { Template } from '../../resources/renderer/src/types';

const api = vi.hoisted(() => ({ saveDestination: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', () => api);

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

const type = (over: Partial<DestinationType> & { id: string }): DestinationType => ({
  label: 'MailPoet',
  icon: 'plug',
  tier: 'free',
  requires: null,
  requires_label: null,
  availability: 'ready',
  needs_connection: false,
  settings_schema: {},
  ...over,
});

const editor = (
  available: Loadable<readonly Destination[]>,
  bound: string[] = [],
  types: DestinationType[] = [],
  props: Partial<ComponentProps<typeof DestinationsEditor>> = {},
) =>
  render(
    <DestinationsEditor
      bound={bound}
      available={available}
      types={types}
      hint={null}
      onChange={vi.fn()}
      connections={[]}
      onRefresh={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />,
  );

/** The overwhelmingly common case: the read landed and there is a list. */
const listed = (destinations: Destination[], bound: string[] = [], types: DestinationType[] = []) =>
  editor(ready(destinations), bound, types);

const rowFor = (name: string): HTMLElement => {
  const item = screen.getByRole('checkbox', { name }).closest('li');

  if (item === null) {
    throw new Error(`No row around “${name}”.`);
  }

  return item;
};

describe('binding an optin to a destination', () => {
  it('explains where extra answers go when a selected destination cannot map them', () => {
    const template = { tree: {
      steps: [{ content: { type: 'question', id: 'service-question', label: 'What service do you need?' } }],
      submissions: [{ id: 'signup', fields: ['service-question'] }],
    } } as unknown as Template;
    const route = destination({ id: 'local', label: 'Local delivery' });
    editor(ready([route]), ['local'], [type({ id: 'mailpoet', label: 'Local delivery' })], { template });
    expect(screen.getByText('This destination cannot send extra answers. They remain saved in WConvert.')).toBeVisible();
    expect(screen.queryByText('Send extra answers')).not.toBeInTheDocument();
  });

  it('makes a required unfinished handoff explicit without selecting a destination', () => {
    const onChange = vi.fn();
    editor(ready([]), [], [], { outcome: CAPTURE_OUTCOME, onChange });
    expect(screen.getByText('No destinations selected')).toBeVisible();
    expect(screen.getByText(/Before publishing, connect a service/)).toBeVisible();
    expect(screen.queryByText(/You can also keep using WConvert on its own/)).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('counts selections without calling an unavailable route ready', () => {
    editor(ready([destination({ id: 'a', label: 'Newsletter', availability: 'unavailable' })]), ['a'], [], { outcome: CAPTURE_OUTCOME });
    expect(screen.getByText('1 selected')).toBeVisible();
    expect(screen.getByText(/Before publishing, connect a service/)).toBeVisible();
  });

  it('keeps forwarding optional for an enquiry with no handoff requirement', () => {
    editor(ready([]), [], [], { outcome: { ...CAPTURE_OUTCOME, audience_channel: null } });
    expect(screen.getByText('Leads stay in WConvert. Add a destination only if you want to forward them.')).toBeVisible();
    expect(screen.queryByText(/Before publishing, connect a service/)).not.toBeInTheDocument();
  });

  it('keeps optional setup guidance out of the initial decision', async () => {
    editor(ready([]), [], [], { hint: 'Use your existing newsletter audience.' });
    expect(screen.getByText('Use your existing newsletter audience.')).not.toBeVisible();
    await userEvent.click(screen.getByText('Setup guidance'));
    expect(screen.getByText('Use your existing newsletter audience.')).toBeVisible();
  });

  /**
   * **Two routes of one type, told apart by what they are for.** This is the
   * whole reason a Destination carries a name, and the case the admin used to
   * forbid outright by disabling *Add* once one of a type existed.
   */
  it('names each route and says where it lands', () => {
    listed([
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
    listed([destination({ id: 'a', label: 'Newsletter signups', target: 'Newsletter' })]);

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
    listed([destination({ id: 'a', label: 'The guide', type: 'lead_magnet_email', target: null })]);

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
    listed([destination({ id: 'a', label: 'Newsletter signups', target: '' })]);

    expect(screen.getByText('Not pointed at anything yet.')).toBeInTheDocument();
  });

  /**
   * The target sits beside what was already there rather than in place of it:
   * a Destination whose type is not running is skipped at dispatch, and that
   * is a different fact from where it would have landed (#4, ADR 0008).
   */
  it('keeps the not-running note beside the target', () => {
    listed(
      [
        destination({
          id: 'a',
          type: 'wsms',
          label: 'Newsletter signups',
          target: 'Newsletter',
          availability: 'unavailable',
        }),
      ],
      [],
      [type({ id: 'wsms', label: 'WP SMS', requires: 'wp-sms', requires_label: 'WP SMS' })],
    );

    const row = rowFor('Newsletter signups');

    expect(within(row).getByText('Sending to Newsletter.')).toBeInTheDocument();
    expect(within(row).getByText(/Needs WP SMS on this site/)).toBeInTheDocument();
  });

  /**
   * **`locked` and `unavailable` are two sentences, not one.** This row said
   * *"not running here"* for both — the exact collapse `Destinations` and
   * `AddRule` each warn against in a comment, and the one ADR 0026 exists to
   * stop: it is how a paying customer is shown an advertisement for Pro and a
   * merchant is offered a licence we do not sell.
   */
  it('names the tier for a locked route and the plugin for an unavailable one', () => {
    listed(
      [
        destination({ id: 'a', type: 'paid', label: 'Paid route', availability: 'locked' }),
        destination({ id: 'b', type: 'wsms', label: 'Plugin route', availability: 'unavailable' }),
      ],
      [],
      [
        type({ id: 'paid', label: 'Paid', tier: 'pro' }),
        type({ id: 'wsms', label: 'WP SMS', requires: 'wp-sms', requires_label: 'WP SMS' }),
      ],
    );

    expect(within(rowFor('Paid route')).getByText(/Needs WConvert Pro,/)).toBeInTheDocument();
    expect(
      within(rowFor('Plugin route')).getByText(/Needs WP SMS on this site/),
    ).toBeInTheDocument();
  });

  it('ticks the destinations this optin is bound to', () => {
    listed(
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

/**
 * ============================================================================
 * IN FLIGHT AND FAILED WERE THE SAME VALUE, AND THE TAB SAID "LOADING" FOREVER.
 * ============================================================================
 * `available` was `readonly Destination[] | null`, and its own docblock said
 * `null` meant *in flight* AND *after one that failed*. The read was
 * `.then(setDestinations).catch(report)` and the render branched
 * `available === null ? 'Loading…' : …`, so a failed fetch left this tab
 * showing a placeholder that would never resolve.
 *
 * The docblock above the read argued the right thing — *"an empty one would
 * read as 'you have none' rather than 'we could not ask'"* — and `T[] | null`
 * simply could not express the third state its author was reasoning about.
 * `Loadable` is the union the rest of the admin already uses, and it makes this
 * unrepresentable rather than merely fixed.
 */
describe('the three states of the destinations read', () => {
  /**
   * The announcement arrives after `RowsSkeleton`'s anti-flash delay, which is
   * why this waits: a read that lands inside 160ms draws no placeholder at all,
   * and that is the point of the delay rather than a race in the test.
   */
  it('says it is loading only while the read is in flight', async () => {
    editor(LOADING);

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('says the read failed rather than that it is still loading', () => {
    editor(failed(new Error('The site did not answer.')));

    expect(screen.getByText('The site did not answer.')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  /**
   * **Never reachable from loading**, which is the distinction `EmptyState`
   * exists to hold: "you have none" is a claim, and it must not be made while
   * the answer is still arriving.
   */
  it('offers the way out where the site genuinely has none', () => {
    editor(ready([]));

    expect(screen.getByText('No destinations yet')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});

describe('setting up shared destinations without leaving the Optin draft', () => {
  const provider = type({ id: 'mailpoet', label: 'MailPoet', settings_schema: {
    lists: { type: 'ids', label: 'Lists to add to', options: [
      { value: '3', label: 'Newsletter' }, { value: '5', label: 'Product updates' },
    ] },
  } });
  beforeEach(() => { api.saveDestination.mockReset(); });

  it('adds a named route with its real settings and asks the merchant to select it', async () => {
    const onChange = vi.fn();
    const saved = destination({ id: 'new', label: 'MailPoet — Newsletter', target: 'Newsletter', settings: { lists: ['3'] } });
    api.saveDestination.mockResolvedValue({ destinations: [saved] });
    function Draft() {
      const [routes, setRoutes] = useState<readonly Destination[]>([]);
      return <DestinationsEditor bound={[]} available={ready(routes)} types={[provider]} connections={[]}
        hint={null} onChange={onChange} onRefresh={vi.fn()} onSaved={setRoutes} />;
    }
    render(<Draft />);
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    await userEvent.click(screen.getByRole('button', { name: 'Choose MailPoet' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'Add a MailPoet destination' })).toHaveFocus();
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Newsletter' }));
    expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('MailPoet — Newsletter');
    await userEvent.click(dialog.getByRole('button', { name: 'Add destination' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveDestination).toHaveBeenCalledExactlyOnceWith({
      type: 'mailpoet', label: 'MailPoet — Newsletter', connection: null, settings: { lists: ['3'] },
    });
    expect(screen.getByRole('checkbox', { name: saved.label })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: saved.label })).toHaveAccessibleDescription('MailPoet Sending to Newsletter.');
    expect(screen.getByRole('status')).toHaveTextContent('Select it to use it');
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add destination' })).toHaveFocus());
    await userEvent.click(screen.getByRole('checkbox', { name: saved.label }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['new']);
  });

  it('edits the shared route with an explicit scope warning and preserves settings outside the schema', async () => {
    const route = destination({ id: 'existing', label: 'Newsletter signups', settings: { lists: ['3'], retained_setting: 'keep' } });
    const onSaved = vi.fn();
    const onChange = vi.fn();
    api.saveDestination.mockResolvedValue({ destinations: [route] });
    editor(ready([route]), ['existing'], [provider], { onSaved, onChange });
    // Use the real Settings entry point: selecting a route must not open it.
    await userEvent.click(screen.getByRole('button', { name: 'Settings for Newsletter signups' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Save destination' })).toHaveAccessibleDescription(/every campaign.*including published campaigns/);
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Product updates' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save destination' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveDestination).toHaveBeenCalledExactlyOnceWith({
      id: 'existing', type: 'mailpoet', label: route.label, connection: null,
      settings: { lists: ['3', '5'], retained_setting: 'keep' },
    });
    expect(screen.getByRole('checkbox', { name: route.label })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Destination updated for all campaigns');
    expect(onChange).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledExactlyOnceWith([route]);
  });

  it('keeps typed settings on a failed save and retries only when asked', async () => {
    api.saveDestination.mockRejectedValueOnce({ message: 'The site did not save this destination.' })
      .mockResolvedValueOnce({ destinations: [] });
    editor(ready([]), [], [provider]);
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    await userEvent.click(screen.getByRole('button', { name: 'Choose MailPoet' }));
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.clear(dialog.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), 'Event signups');
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Newsletter' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Add destination' }));
    expect(await screen.findByText('The site did not save this destination.')).toBeVisible();
    expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Event signups');
    expect(dialog.getByRole('checkbox', { name: 'Newsletter' })).toBeChecked();
    expect(api.saveDestination).toHaveBeenCalledOnce();
    await userEvent.click(dialog.getByRole('button', { name: 'Add destination' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveDestination).toHaveBeenCalledTimes(2);
  });

  it('cancels without creating or binding anything and restores the entry point', async () => {
    const onChange = vi.fn();
    const onSaved = vi.fn();
    editor(ready([]), [], [provider], { onChange, onSaved });
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    await userEvent.click(screen.getByRole('button', { name: 'Choose MailPoet' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add destination' })).toHaveFocus());
    expect(api.saveDestination).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('explains unavailable providers without offering to create a route through them', async () => {
    editor(ready([]), [], [type({ id: 'paid', tier: 'pro', label: 'Paid service', availability: 'locked' }),
      type({ id: 'wsms', label: 'WP SMS', availability: 'unavailable', requires_label: 'WP SMS' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    expect(screen.getByText('Included with WConvert Pro.')).toBeVisible();
    expect(screen.getByText('Needs WP SMS on this site.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Choose / })).not.toBeInTheDocument();
    expect(api.saveDestination).not.toHaveBeenCalled();
  });

  it('refreshes a failed read in place and removes only references proven missing', async () => {
    const onRefresh = vi.fn();
    const onChange = vi.fn();
    const view = editor(failed(new Error('Read failed.')), ['keep', 'deleted'], [provider], { onRefresh, onChange });
    expect(screen.queryByRole('button', { name: 'Remove missing destinations' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledOnce();
    view.rerender(<DestinationsEditor bound={['keep', 'deleted']} available={ready([destination({ id: 'keep', label: 'Still here' })])}
      types={[provider]} connections={[]} hint={null} onRefresh={onRefresh} onChange={onChange} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove missing destinations' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['keep']);
    expect(api.saveDestination).not.toHaveBeenCalled();
  });

  it('names a missing or mismatched account without dropping the binding', () => {
    editor(ready([destination({ id: 'route', label: 'Connected route', connection: 'other' })]), ['route'],
      [{ ...provider, needs_connection: true }], {
        connections: [{ id: 'other', type: 'different-provider', label: 'Other service', credentials: {} }],
      });
    expect(screen.getByRole('checkbox', { name: 'Connected route' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Connected route' })).toHaveAccessibleDescription(/Account connection needed.*Open Settings/);
  });
});

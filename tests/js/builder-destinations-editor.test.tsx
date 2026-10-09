import { useState, type ComponentProps } from 'react';
import { CAPTURE_OUTCOME } from './support/outcomes';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { DestinationsEditor } from '../../resources/admin/src/builder/DestinationsEditor';
import { LOADING, failed, ready } from '../../resources/admin/src/shell/loadable';
import type { Loadable } from '../../resources/admin/src/shell/loadable';
import type { Destination, DestinationType } from '../../resources/admin/src/destinations/api';
import type { Template } from '../../resources/renderer/src/types';

const api = vi.hoisted(() => ({ saveDestination: vi.fn(), testSend: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', () => api);

/**
 * ============================================================================
 * THE TAB SAYS WHERE THIS CAMPAIGN'S LEADS GO, AND WHETHER THAT IS WORKING.
 * ============================================================================
 * It listed every site route as a checkbox. Now only the bound routes are
 * drawn, as cards with the Settings screen's health badge, and Add opens a
 * picker over the rest. What follows is the history of why a row carries a
 * name and a target, which still holds for the cards.
 *
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

const card = (name: string): HTMLElement => screen.getByRole('article', { name });

const requirements = (settings: Record<string, { label: string; type: string }> = {}, channels?: string[]) => ({
  capture_any_of: ['email'], settings, fields: ['email', 'name'], mapped_fields: {}, ...(channels ? { audience_channels: channels } : {}),
});

/** An email-and-name form, for routes that care what the form captures. */
const form = (fields: { name: string; required: boolean }[]) => ({ tree: {
  steps: [{ content: { type: 'stack', children: fields.map((field) => ({ type: 'field', id: field.name, name: field.name, required: field.required })) } }],
  submissions: [{ id: 'signup', fields: fields.map((field) => field.name) }],
} }) as unknown as Template;


describe('the cards this campaign sends to', () => {
  it('draws only the bound routes, in the order they were bound', () => {
    listed([
      destination({ id: 'a', label: 'Newsletter signups', target: 'Newsletter' }),
      destination({ id: 'b', label: 'Product announcements', target: 'Product updates' }),
      destination({ id: 'c', label: 'VIP list', target: 'VIP' }),
    ], ['c', 'b']);

    expect(screen.getAllByRole('article').map((each) => each.getAttribute('aria-labelledby') && within(each).getByRole('heading').textContent))
      .toEqual(['VIP list', 'Product announcements']);
    expect(screen.queryByText('Newsletter signups')).toBeNull();
  });

  it('always shows that leads are saved in WConvert first', () => {
    listed([destination({ id: 'a', label: 'Newsletter signups' })], ['a']);
    expect(screen.getByText('Saved in Leads')).toBeVisible();
    expect(screen.getByText('Every submission is saved here first, even if a destination fails.')).toBeVisible();
  });

  /**
   * **Two routes of one type, told apart by what they are for** — the name is
   * the card's heading and the target sits beside the provider.
   */
  it('names each route and says where it lands', () => {
    listed([destination({ id: 'a', label: 'Newsletter signups', target: 'Newsletter' })], ['a'], [type({ id: 'mailpoet' })]);
    expect(within(card('Newsletter signups')).getByText('MailPoet')).toBeVisible();
    expect(within(card('Newsletter signups')).getByText('Newsletter')).toBeVisible();
  });

  /** A type that selects nothing gets no target at all (ADR 0042). */
  it('says nothing about a destination that selects nothing', () => {
    listed([destination({ id: 'a', label: 'The guide', type: 'lead_magnet_email', target: null })], ['a']);
    expect(within(card('The guide')).queryByText(/Not pointed/)).toBeNull();
  });

  it('says so where a destination selects something and nothing is chosen', () => {
    listed([destination({ id: 'a', label: 'Newsletter signups', target: '' })], ['a']);
    expect(within(card('Newsletter signups')).getByText('Not pointed at anything yet.')).toBeVisible();
  });

  it('says which fields go automatically, and when it last worked', () => {
    editor(ready([destination({ id: 'a', label: 'Newsletter signups', requirements: requirements(),
      health: { last_success_at: '2026-10-08 09:12', last_error: null, last_error_at: null, consecutive_failures: 0, skipped_captures: 0, last_skipped_at: null } })]),
    ['a'], [], { template: form([{ name: 'email', required: true }, { name: 'name', required: false }]) });
    expect(within(card('Newsletter signups')).getByText('Sends email and name automatically.')).toBeVisible();
    expect(within(card('Newsletter signups')).getByText(/^Last sent (?!2026-10-08)/)).toBeVisible();
    expect(within(card('Newsletter signups')).getByText('Success recorded')).toBeVisible();
  });

  it('explains where extra answers go when a selected destination cannot map them', () => {
    const template = { tree: {
      steps: [{ content: { type: 'question', id: 'service-question', label: 'What service do you need?' } }],
      submissions: [{ id: 'signup', fields: ['service-question'] }],
    } } as unknown as Template;
    editor(ready([destination({ id: 'local', label: 'Local delivery' })]), ['local'], [type({ id: 'mailpoet', label: 'Local delivery' })], { template });
    expect(screen.getByText('Extra answers stay in WConvert')).toBeVisible();
    expect(screen.queryByText('Field mapping')).not.toBeInTheDocument();
  });
});

describe('health, on the card that has it', () => {
  /**
   * The editor used to print every route's warnings, bound or not. A problem
   * on a route this Campaign does not use is not this Campaign's problem.
   */
  it('shows problems only for the routes this campaign uses', () => {
    editor(ready([
      destination({ id: 'a', label: 'Bound route', requirements: requirements(), settings: {} }),
      destination({ id: 'b', label: 'Unused route', requirements: requirements({ lists: { label: 'Lists to add to', type: 'ids' } }), settings: {} }),
    ]), ['a'], [], { template: form([{ name: 'phone', required: true }]) });
    expect(within(card('Bound route')).getByText(/needs email address/)).toBeVisible();
    expect(screen.queryByText(/Lists to add to/)).toBeNull();
    expect(screen.queryByText('Needs setup')).toBeNull();
  });

  it('marks an unfinished route as needing setup and opens settings at the empty field', async () => {
    const provider = type({ id: 'mailpoet', settings_schema: { lists: { type: 'ids', label: 'Lists to add to', options: [{ value: '3', label: 'Newsletter' }] } },
      requirements: requirements({ lists: { label: 'Lists to add to', type: 'ids' } }) });
    editor(ready([destination({ id: 'a', label: 'Product updates', settings: { lists: [] }, requirements: provider.requirements })]), ['a'], [provider]);
    const route = card('Product updates');
    expect(within(route).getByText('Needs setup')).toBeVisible();
    expect(within(route).getByText('Choose “Lists to add to” before this destination can send.')).toBeVisible();
    await userEvent.click(within(route).getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('checkbox', { name: 'Newsletter' })).toHaveFocus());
  });

  it('needs setup where the account is missing, without dropping the binding', () => {
    editor(ready([destination({ id: 'route', label: 'Connected route', connection: 'other' })]), ['route'],
      [type({ id: 'mailpoet', needs_connection: true })], {
        connections: [{ id: 'other', type: 'different-provider', label: 'Other service', credentials: {} }],
      });
    expect(within(card('Connected route')).getByText('Needs setup')).toBeVisible();
    expect(within(card('Connected route')).getByText('Connect an account before this destination can send.')).toBeVisible();
  });

  it('sends a failing route to the sending issues, where re-push lives', () => {
    listed([destination({ id: 'a', label: 'Main audience', health: { last_success_at: '2026-10-01', last_error: 'API key rejected (401)',
      last_error_at: '2026-10-08', consecutive_failures: 3, skipped_captures: 0, last_skipped_at: null } })], ['a']);
    const route = card('Main audience');
    expect(within(route).getByText('Failing')).toBeVisible();
    expect(within(route).getByText('3 failures in a row. Last error: API key rejected (401)')).toBeVisible();
    expect(within(route).getByRole('link', { name: 'View sending issues' })).toHaveAttribute('href', expect.stringContaining('view=issues'));
  });

  /** `locked` and `unavailable` are two sentences, not one (ADR 0026). */
  it('names the tier for a locked route and the plugin for an unavailable one', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    onTestFinished(() => { delete window.wconvertAdmin; });
    listed(
      [
        destination({ id: 'a', type: 'paid', label: 'Paid route', availability: 'locked' }),
        destination({ id: 'b', type: 'wsms', label: 'Plugin route', target: 'Newsletter', availability: 'unavailable' }),
      ],
      ['a', 'b'],
      [type({ id: 'paid', label: 'Paid', tier: 'pro' }), type({ id: 'wsms', label: 'WP SMS', requires: 'wp-sms', requires_label: 'WP SMS' })],
    );
    expect(within(card('Paid route')).getByText(/Needs WConvert Pro,/)).toBeVisible();
    expect(within(card('Plugin route')).getByText('Paused')).toBeVisible();
    expect(within(card('Plugin route')).getByText(/Needs WP SMS on this site/)).toBeVisible();
    expect(within(card('Plugin route')).getByText('Newsletter')).toBeVisible();
  });

  /** Free keeps the saved route and names no product (ADR 0116). */
  it('names no product for a locked route on a free install', () => {
    listed([destination({ id: 'a', type: 'paid', label: 'Paid route', availability: 'locked' })], ['a'], [type({ id: 'paid', label: 'Paid', tier: 'pro' })]);
    expect(within(card('Paid route')).getByText('This destination type isn’t available on this site, so submissions are kept in WConvert and not sent.')).toBeVisible();
    expect(within(card('Paid route')).getByText('Not available')).toBeVisible();
    expect(within(card('Paid route')).queryByText(/WConvert Pro/)).toBeNull();
  });
});

describe('the actions on a card', () => {
  it('removes a route from this campaign as a draft edit, with no confirm', async () => {
    const onChange = vi.fn();
    editor(ready([destination({ id: 'a', label: 'Newsletter signups' }), destination({ id: 'b', label: 'VIP list' })]), ['a', 'b'], [], { onChange });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Newsletter signups' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from this campaign' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['b']);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('moves focus to Add once the last card is removed', async () => {
    function Draft() {
      const [bound, setBound] = useState<string[]>(['a']);
      return <DestinationsEditor bound={bound} available={ready([destination({ id: 'a', label: 'Newsletter signups' })])} types={[]} connections={[]}
        onChange={setBound} onRefresh={vi.fn()} onSaved={vi.fn()} />;
    }
    render(<Draft />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Newsletter signups' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from this campaign' }));
    expect(screen.getByText('No destinations selected')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add destination' })).toHaveFocus());
  });

  it('sends a test from the card with the suggested address', async () => {
    api.testSend.mockResolvedValue({ outcome: 'success', message: 'Accepted by MailPoet.' });
    editor(ready([destination({ id: 'a', label: 'Newsletter signups', target: 'Newsletter' })]), ['a'], [type({ id: 'mailpoet' })], { testEmail: 'owner@example.com' });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Newsletter signups' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Send a test' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'Newsletter signups' })).toBeVisible();
    expect(dialog.getByLabelText('Test email address')).toHaveValue('owner@example.com');
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    expect(api.testSend).toHaveBeenCalledExactlyOnceWith('a', 'owner@example.com');
  });

  it('keeps Send a test reachable but refused, with the reason, until setup is finished', async () => {
    editor(ready([destination({ id: 'a', label: 'Product updates', requirements: requirements({ lists: { label: 'Lists to add to', type: 'ids' } }) })]), ['a']);
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Product updates' }));
    const item = screen.getByRole('menuitem', { name: /Send a test/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('Finish setup first.');
    await userEvent.click(item);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /**
   * Shared usage is said once, in the notice, and the Save button is
   * described by it — the dialog's own description no longer repeats it.
   */
  it('shows who else uses a route before its shared settings are saved', async () => {
    const provider = type({ id: 'mailpoet', settings_schema: { lists: { type: 'ids', label: 'Lists to add to', options: [
      { value: '3', label: 'Newsletter' }, { value: '5', label: 'Product updates' }] } } });
    const route = destination({ id: 'existing', label: 'Newsletter signups', settings: { lists: ['3'], retained_setting: 'keep' },
      usage: [{ id: 'o1', name: 'Spring sale popup', live: true, draft: false }, { id: 'o2', name: 'Footer bar', live: true, draft: true }] });
    const onSaved = vi.fn();
    const onChange = vi.fn();
    api.saveDestination.mockResolvedValue({ destinations: [route] });
    editor(ready([route]), ['existing'], [provider], { onSaved, onChange });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Newsletter signups' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit settings' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Spring sale popup')).toBeVisible();
    expect(dialog.getByText('Live and saved draft')).toBeVisible();
    expect(dialog.queryByText(/Changes affect every campaign/)).toBeNull();
    expect(dialog.getByRole('button', { name: 'Save destination' })).toHaveAccessibleDescription(/Campaigns using this destination.*affects live use immediately/);
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Product updates' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save destination' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveDestination).toHaveBeenCalledExactlyOnceWith({
      id: 'existing', type: 'mailpoet', label: route.label, connection: null,
      settings: { lists: ['3', '5'], retained_setting: 'keep' },
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledExactlyOnceWith([route]);
  });
});

describe('adding a route', () => {
  const provider = type({ id: 'mailpoet', label: 'MailPoet', settings_schema: {
    lists: { type: 'ids', label: 'Lists to add to', options: [
      { value: '3', label: 'Newsletter' }, { value: '5', label: 'Product updates' },
    ] },
  } });
  beforeEach(() => { api.saveDestination.mockReset(); });

  it('re-reads the site routes when the picker opens and adds one in a click', async () => {
    const onChange = vi.fn();
    const onRefresh = vi.fn();
    editor(ready([destination({ id: 'a', label: 'Newsletter signups' }), destination({ id: 'b', label: 'VIP list' })]), ['a'], [provider], { onChange, onRefresh });
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    expect(onRefresh).toHaveBeenCalledOnce();
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: /VIP list/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses a route already sending, or one for the wrong channel, and says why', async () => {
    const onChange = vi.fn();
    editor(ready([
      destination({ id: 'a', label: 'Newsletter signups', requirements: requirements({}, ['email']) }),
      destination({ id: 'b', label: 'Email only list', requirements: requirements({}, ['email']) }),
      destination({ id: 'c', type: 'wsms', label: 'SMS subscribers', requirements: requirements({}, ['email', 'phone']) }),
    ]), ['a'], [provider], { onChange, channel: { channel: 'phone', strict: true }, title: 'Optional SMS signup', primary: false });
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    const dialog = within(screen.getByRole('dialog'));
    const bound = dialog.getByRole('button', { name: /Newsletter signups/ });
    const wrong = dialog.getByRole('button', { name: /Email only list/ });
    expect(bound).toHaveAttribute('aria-disabled', 'true');
    expect(bound).toHaveAccessibleDescription(/Already added\./);
    expect(wrong).toHaveAttribute('aria-disabled', 'true');
    expect(wrong).toHaveAccessibleDescription(/Doesn’t take phone numbers\./);
    await userEvent.click(bound);
    await userEvent.click(wrong);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: /SMS subscribers/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['a', 'c']);
  });

  /** A main signup may also deliver: a route that takes no audience is not "the wrong channel". */
  it('lets a main signup add a route that delivers rather than subscribes', async () => {
    const onChange = vi.fn();
    editor(ready([destination({ id: 'g', type: 'lead_magnet_email', label: 'Pricing guide', requirements: requirements({}, []) })]), [], [provider],
      { onChange, channel: { channel: 'email', strict: false } });
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Pricing guide/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['g']);
  });

  /**
   * **A route created here is selected for this campaign**, in the same draft
   * edit — the merchant set it up from this Campaign to use it here. It used
   * to arrive unticked with a notice asking for a second click.
   */
  it('selects a route created from the picker', async () => {
    const saved = destination({ id: 'new', label: 'MailPoet — Newsletter', target: 'Newsletter', settings: { lists: ['3'] } });
    const existing = destination({ id: 'a', label: 'Newsletter signups' });
    api.saveDestination.mockResolvedValue({ destinations: [existing, saved] });
    function Draft() {
      const [routes, setRoutes] = useState<readonly Destination[]>([existing]);
      const [bound, setBound] = useState<string[]>(['a']);
      return <DestinationsEditor bound={bound} available={ready(routes)} types={[provider]} connections={[]}
        onChange={setBound} onRefresh={vi.fn()} onSaved={setRoutes} />;
    }
    render(<Draft />);
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    await userEvent.click(within(screen.getByRole('list', { name: 'Destination providers' })).getByRole('button', { name: /MailPoet/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'New MailPoet destination' })).toHaveFocus();
    expect(dialog.getByText('It is selected for this campaign when you save.')).toBeVisible();
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Newsletter' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Add destination' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(card('MailPoet — Newsletter')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actions for MailPoet — Newsletter' })).toHaveFocus());
  });

  it('offers the providers in place on a site with no routes, and selects the one set up', async () => {
    const onChange = vi.fn();
    const saved = destination({ id: 'new', label: 'MailPoet — Newsletter' });
    api.saveDestination.mockResolvedValue({ destinations: [saved] });
    editor(ready([]), [], [provider], { onChange, suggested: ['mailpoet'] });
    expect(screen.getByText('Choose a service to set up')).toBeVisible();
    const tile = screen.getByRole('button', { name: /MailPoet/ });
    expect(tile).toHaveAccessibleDescription('Suggested');
    await userEvent.click(tile);
    const dialog = within(screen.getByRole('dialog'));
    expect(api.saveDestination).toHaveBeenCalledTimes(0);
    expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('MailPoet');
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Newsletter' }));
    expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('MailPoet — Newsletter');
    await userEvent.click(dialog.getByRole('button', { name: 'Add destination' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveDestination).toHaveBeenCalledExactlyOnceWith({
      type: 'mailpoet', label: 'MailPoet — Newsletter', connection: null, settings: { lists: ['3'] },
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['new']);
  });

  it('keeps typed settings on a failed save and retries only when asked', async () => {
    api.saveDestination.mockRejectedValueOnce({ message: 'The site did not save this destination.' })
      .mockResolvedValueOnce({ destinations: [] });
    editor(ready([]), [], [provider]);
    await userEvent.click(screen.getByRole('button', { name: /MailPoet/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /MailPoet/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /MailPoet/ })).toHaveFocus());
    expect(api.saveDestination).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('explains unavailable providers without offering to create a route through them', async () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    onTestFinished(() => { delete window.wconvertAdmin; });
    editor(ready([]), [], [type({ id: 'paid', tier: 'pro', label: 'Paid service', availability: 'locked' }),
      type({ id: 'wsms', label: 'WP SMS', availability: 'unavailable', requires_label: 'WP SMS' })]);
    const paid = screen.getByRole('button', { name: /Paid service/ });
    expect(paid).toHaveAccessibleDescription('Included with WConvert Pro.');
    expect(screen.getByRole('button', { name: /WP SMS/ })).toHaveAccessibleDescription('Needs WP SMS on this site.');
    await userEvent.click(paid);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists no provider a free install would have to buy', () => {
    editor(ready([]), [], [type({ id: 'paid', tier: 'pro', label: 'Paid service', availability: 'locked' }),
      type({ id: 'wsms', label: 'WP SMS', availability: 'unavailable', requires_label: 'WP SMS' })]);
    expect(screen.queryByText('Paid service')).not.toBeInTheDocument();
    expect(screen.queryByText(/Included with/)).not.toBeInTheDocument();
    expect(screen.getByText('Needs WP SMS on this site.')).toBeVisible();
  });
});

describe('what this save point needs before publishing', () => {
  it('makes a required unfinished handoff explicit without selecting a destination', () => {
    const onChange = vi.fn();
    editor(ready([]), [], [], { outcome: CAPTURE_OUTCOME, onChange });
    expect(screen.getByRole('status')).toHaveTextContent('Before you can publish, connect a service or choose “Keep in WConvert only”.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the requirement while the only bound route cannot run', () => {
    editor(ready([destination({ id: 'a', label: 'Newsletter', availability: 'unavailable' })]), ['a'], [], { outcome: CAPTURE_OUTCOME });
    expect(card('Newsletter')).toBeInTheDocument();
    expect(screen.getByText(/Before you can publish, connect a service/)).toBeVisible();
  });

  it('keeps forwarding optional for an enquiry with no handoff requirement', () => {
    editor(ready([]), [], [], { outcome: { ...CAPTURE_OUTCOME, audience_channel: null } });
    expect(screen.getByText('Leads stay in WConvert. Add a destination only if you want to send them on.')).toBeVisible();
    expect(screen.queryByText(/Before you can publish/)).not.toBeInTheDocument();
  });

  it('offers Add where routes exist and none is selected', () => {
    editor(ready([destination({ id: 'a', label: 'Newsletter' })]), []);
    expect(screen.getByText('No destinations selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add destination' })).toBeVisible();
  });

  it('says nothing is forwarded when the campaign collects only in WConvert', () => {
    editor(ready([destination({ id: 'a', label: 'Newsletter' })]), [], [], { outcome: CAPTURE_OUTCOME, local: true });
    expect(screen.getByText('Kept for review or export. Nothing is sent to another service.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add destination' })).toBeNull();
    expect(screen.queryByText(/Before you can publish/)).toBeNull();
  });
});

/**
 * ============================================================================
 * IN FLIGHT AND FAILED WERE THE SAME VALUE, AND THE TAB SAID "LOADING" FOREVER.
 * ============================================================================
 * `Loadable` makes the confusion unrepresentable rather than merely fixed: a
 * failed read is never "you have none", nor proof that a bound route is gone.
 */
describe('the three states of the destinations read', () => {
  /** The announcement arrives after `RowsSkeleton`'s anti-flash delay. */
  it('says it is loading only while the read is in flight', async () => {
    editor(LOADING);
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('says the read failed rather than that it is still loading, and retries in place', async () => {
    const onRefresh = vi.fn();
    editor(failed(new Error('The site did not answer.')), [], [], { onRefresh });
    expect(screen.getByText('The site did not answer.')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('removes only references proven missing', async () => {
    const onChange = vi.fn();
    const view = editor(failed(new Error('Read failed.')), ['keep', 'deleted'], [], { onChange });
    expect(screen.queryByRole('button', { name: 'Remove missing destinations' })).not.toBeInTheDocument();
    view.rerender(<DestinationsEditor bound={['keep', 'deleted']} available={ready([destination({ id: 'keep', label: 'Still here' })])}
      types={[]} connections={[]} onRefresh={vi.fn()} onChange={onChange} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove missing destinations' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['keep']);
  });
});

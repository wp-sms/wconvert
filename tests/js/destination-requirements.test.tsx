import { treeFixture } from './support/journey';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capturedFields, compatibilityProblems } from '../../resources/admin/src/destinations/requirements';
import { destinationsSaid } from '../../resources/admin/src/builder/destinations';
import { DestinationSettingsForm } from '../../resources/admin/src/destinations/DestinationSettingsForm';
import { SendTestDialog } from '../../resources/admin/src/destinations/SendTestDialog';
import type { Connection, Destination, DestinationType } from '../../resources/admin/src/destinations/api';
import type { Template } from '../../resources/renderer/src/types';

const { testSend, saveConnection, readSelectedSchema } = vi.hoisted(() => ({ testSend: vi.fn(), saveConnection: vi.fn(), readSelectedSchema: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', async (original) => ({ ...await original<object>(), testSend, saveConnection, readSelectedSchema }));
beforeEach(() => {
  testSend.mockReset().mockResolvedValue({ outcome: 'success', message: 'Accepted by MailPoet.' });
  saveConnection.mockReset();
  readSelectedSchema.mockReset();
});

const route: Destination = {
  id: 'route', label: 'Newsletter', type: 'mailpoet', connection: null, settings: { lists: ['3'] }, target: 'News', availability: 'ready',
  health: { last_success_at: null, last_error: null, last_error_at: null, consecutive_failures: 0, skipped_captures: 0, last_skipped_at: null },
  requirements: { capture_any_of: ['email'], settings: { lists: { label: 'Lists to add to', type: 'ids' } }, fields: ['email', 'name'],
    mapped_fields: { interest: { setting: 'interest_field', label: 'Interest', scope: 'New subscribers only; existing subscriber fields stay unchanged.' } } },
};
const type: DestinationType = { id: 'mailpoet', label: 'MailPoet', icon: 'mail', tier: 'free', requires: 'mailpoet', requires_label: 'MailPoet',
  availability: 'ready', needs_connection: false, requirements: route.requirements!,
  settings_schema: { lists: { type: 'ids', label: 'Lists to add to', options: [{ value: '3', label: 'News' }] },
    interest_field: { type: 'select', label: 'Interest field', options: [{ value: 'cf_7', label: 'Service interest' }] } } };
const remoteType: DestinationType = {
  ...type, id: 'mailchimp', label: 'Mailchimp', tier: 'pro', requires: null, requires_label: null,
  needs_connection: true, connection_schema: { api_key: { type: 'password', label: 'API key' } },
  requirements: { ...type.requirements!, settings: { audiences: { label: 'Audience', type: 'ids' } } },
  settings_schema: { audiences: { type: 'ids', label: 'Audience', options: [] } },
};
const account: Connection = { id: 'account-1', type: 'mailchimp', label: 'Main account', credentials: { api_key: true } };

describe('provider-declared destination requirements', () => {
  it('connects an account inside destination setup, then asks for its audience', async () => {
    const onConfirm = vi.fn();
    const onConnectionSaved = vi.fn();
    saveConnection.mockResolvedValue({ connection: account });
    readSelectedSchema.mockResolvedValue({ settings_schema: { audiences: {
      type: 'ids', label: 'Audience', options: [{ value: 'audience-1', label: 'Newsletter' }],
    } } });
    render(<DestinationSettingsForm type={remoteType} connections={[]} busy={false} error={null}
      onCancel={vi.fn()} onConfirm={onConfirm} onConnectionSaved={onConnectionSaved} />);

    expect(screen.getByText(/Connect a Mailchimp account to choose where leads go/)).toBeVisible();
    expect(screen.queryByText(/Complete “Audience”/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Connect Mailchimp' }));
    await userEvent.type(screen.getByLabelText('API key'), 'test-key');
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));
    await waitFor(() => expect(onConnectionSaved).toHaveBeenCalledWith(account));
    expect(saveConnection).toHaveBeenCalledWith({ type: 'mailchimp', label: 'Mailchimp', credentials: { api_key: 'test-key' } });
    expect(await screen.findByRole('checkbox', { name: 'Newsletter' })).toBeVisible();
    // Refused, not greyed: the reason is the problem listed above the footer (§14).
    expect(screen.getByRole('button', { name: 'Add destination' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Add destination' })).toHaveAccessibleDescription('Choose “Audience” before this destination can send.');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Newsletter' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    expect(onConfirm).toHaveBeenCalledWith({ label: 'Mailchimp — Newsletter', connection: account.id, settings: { audiences: ['audience-1'] } });
  });

  it('keeps the destination name while connecting another account', async () => {
    saveConnection.mockResolvedValue({ connection: { ...account, id: 'account-2', label: 'Second account' } });
    readSelectedSchema.mockResolvedValue({ settings_schema: { audiences: { type: 'ids', label: 'Audience', options: [] } } });
    render(<DestinationSettingsForm type={remoteType} connections={[account]} busy={false} error={null}
      onCancel={vi.fn()} onConfirm={vi.fn()} />);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Spring leads');
    await userEvent.click(screen.getByRole('button', { name: 'Connect another Mailchimp account' }));
    await userEvent.type(screen.getByLabelText('API key'), 'second-key');
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Spring leads');
    expect(screen.getByText(/No Audience choices were found/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add destination' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('refuses a route with an account type until an account is chosen, and says so', async () => {
    const onConfirm = vi.fn();
    render(<DestinationSettingsForm type={remoteType} connections={[account, { ...account, id: 'account-2', label: 'Second' }]} busy={false} error={null}
      onCancel={vi.fn()} onConfirm={onConfirm} />);
    const add = screen.getByRole('button', { name: 'Add destination' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription('Choose an account before this destination can send.');
    await userEvent.click(add);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('starts on the account it is handed — the one just connected', async () => {
    readSelectedSchema.mockResolvedValue({ settings_schema: { audiences: { type: 'ids', label: 'Audience', options: [] } } });
    render(<DestinationSettingsForm type={remoteType} connections={[account, { ...account, id: 'account-2', label: 'Second' }]} busy={false} error={null}
      initialConnection="account-2" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('account-2');
    await waitFor(() => expect(readSelectedSchema).toHaveBeenCalledWith('mailchimp', 'account-2', false));
  });

  it('explains a failed audience lookup and lets the merchant retry it', async () => {
    readSelectedSchema.mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValue({ settings_schema: {
      audiences: { type: 'ids', label: 'Audience', options: [{ value: 'audience-1', label: 'Newsletter' }] },
    } });
    render(<DestinationSettingsForm type={remoteType} connections={[account]} busy={false} error={null}
      onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(await screen.findByText(/Could not load choices from this account/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add destination' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh choices' }));
    expect(await screen.findByRole('checkbox', { name: 'Newsletter' })).toBeVisible();
    expect(screen.queryByText(/Could not load choices/)).not.toBeInTheDocument();
  });
  it('distinguishes missing email, optional email and satisfied capture requirements', () => {
    expect(compatibilityProblems(route, [{ name: 'phone', required: true }]).join(' ')).toContain('needs email address. Add it');
    expect(compatibilityProblems(route, [{ name: 'email', required: false }, { name: 'phone', required: false }]).join(' ')).toContain('field is optional');
    expect(compatibilityProblems(route, [{ name: 'email', required: false }])).toEqual([]);
    expect(compatibilityProblems(route, [{ name: 'email', required: true }])).toEqual([]);
  });
  it('accepts either WSMS identifier and keeps local-only capture valid', () => {
    const wsms = { ...route, requirements: { capture_any_of: ['email', 'phone'], settings: {}, fields: ['email', 'phone', 'name'], mapped_fields: {} } };
    expect(compatibilityProblems(wsms, [{ name: 'phone', required: true }])).toEqual([]);
    expect(compatibilityProblems(wsms, [{ name: 'email', required: true }])).toEqual([]);
    expect(compatibilityProblems(wsms, [{ name: 'email', required: false }, { name: 'phone', required: false }])).toEqual([]);
    expect(destinationsSaid([], [route], [{ name: 'phone', required: true }]).problems).toEqual([]);
  });
  it('uses saved setting requirements without accepting whitespace or numeric list IDs', () => {
    for (const lists of [[], [' '], [3], '3']) {
      expect(compatibilityProblems({ ...route, settings: { lists } }, [{ name: 'email', required: true }]).join(' ')).toContain('Choose “Lists to add to”');
    }
    const magnet = { ...route, requirements: { capture_any_of: ['email'], settings: { file_url: { label: 'File URL', type: 'text' } }, fields: ['email'], mapped_fields: {} } };
    expect(compatibilityProblems(magnet, [{ name: 'phone', required: true }]).join(' ')).toContain('Complete “File URL”');
    expect(compatibilityProblems(magnet, [{ name: 'phone', required: true }]).join(' ')).toContain('needs email address');
  });
  it('does not claim an interest answer is sent until mapped, and states the new-subscriber limit', () => {
    const captures = [{ name: 'email', required: true }, { name: 'interest', required: false }];
    expect(compatibilityProblems(route, captures).join(' ')).toContain('saved in WConvert but is not sent');
    expect(compatibilityProblems({ ...route, settings: { ...route.settings, interest_field: 'cf_7' } }, captures).join(' ')).toContain('New subscribers only');
  });
  it('reads actual fields and requiredness across nested layout branches', () => {
    const template: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'split', start: [
      { type: 'field', name: 'email', required: true },
    ], end: [{ type: 'stack', children: [{ type: 'field', name: 'phone', required: false }, { type: 'button' }] }] }] }) };
    expect(capturedFields(template)).toEqual([{ name: 'email', required: true }, { name: 'phone', required: false }]);
  });
  it('does not count fields on non-submitting screens as captured by the form', () => {
    const template: Template = { tokens: {}, tree: treeFixture({ steps: [
      { type: 'stack', children: [{ type: 'field', name: 'phone' }, { type: 'button', action: 'submit' }] },
      { type: 'stack', children: [{ type: 'field', name: 'email', required: true }] },
    ] }) };
    const actual = capturedFields(template);
    expect(actual).toEqual([{ name: 'phone', required: false }]);
    expect(compatibilityProblems(route, actual).join(' ')).toContain('needs email address. Add it');
  });
  it('shows live versus saved draft usage before editing and saves a named mapping by stable ID', async () => {
    const onConfirm = vi.fn();
    render(<DestinationSettingsForm type={type} destination={{ ...route, usage: [
      { id: 'a', name: 'Live signup', live: true, draft: false }, { id: 'b', name: 'Draft enquiry', live: false, draft: true },
    ] }} connections={[]} busy={false} error={null} onCancel={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText('Live signup')).toBeInTheDocument();
    expect(screen.getByText('Live only')).toBeInTheDocument();
    expect(screen.getByText('Saved draft only')).toBeInTheDocument();
    expect(screen.getByText(/Campaign Undo can’t reverse/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Interest field' }), 'cf_7');
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({ label: 'Newsletter', connection: null, settings: { lists: ['3'], interest_field: 'cf_7' } });
  });
  it('keeps an unavailable mapped field visible without silently clearing it', () => {
    render(<DestinationSettingsForm type={type} destination={{ ...route, settings: { lists: ['3'], interest_field: 'cf_99' } }}
      connections={[]} busy={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Interest field' })).toHaveValue('cf_99');
    expect(screen.getByText(/The selected field for Interest is unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Couldn’t read which campaigns use it/)).toBeInTheDocument();
  });
  it('requires an explicitly entered interest sample and describes the new-subscriber effect before sending', async () => {
    render(<SendTestDialog destination={{ ...route, settings: { lists: ['3'], interest_field: 'cf_7' } }} type={type}
      initialEmail="owner@example.test" settingsDirty={false} returnFocusTo={{ current: null }} onClose={vi.fn()} onSent={vi.fn()} />);
    const answer = screen.getByRole('textbox', { name: 'Test interest value (optional)' });
    expect(answer).toHaveValue('');
    expect(screen.getByText(/It is written to the mapped field for new subscribers only/)).toBeInTheDocument();
    expect(testSend).not.toHaveBeenCalled();
    await userEvent.type(answer, 'installation');
    await userEvent.click(screen.getByRole('button', { name: 'Send test' }));
    await waitFor(() => expect(testSend).toHaveBeenCalledExactlyOnceWith('route', 'owner@example.test', 'installation'));
  });
  it('offers no interest sample when the route has no mapping', async () => {
    render(<SendTestDialog destination={route} type={type} initialEmail="owner@example.test" settingsDirty={false}
      returnFocusTo={{ current: null }} onClose={vi.fn()} onSent={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: /Test interest/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send test' }));
    await waitFor(() => expect(testSend).toHaveBeenCalledExactlyOnceWith('route', 'owner@example.test'));
  });
});

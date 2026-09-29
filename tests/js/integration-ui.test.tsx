import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Template } from '../../resources/renderer/src/types';
import type { Connection, Destination, DestinationType } from '../../resources/admin/src/destinations/api';

const api = vi.hoisted(() => ({
  readMappingFields: vi.fn(), previewMapping: vi.fn(), testMapping: vi.fn(),
  checkConnection: vi.fn(), deleteConnection: vi.fn(), saveConnection: vi.fn(),
}));
vi.mock('../../resources/admin/src/destinations/api', () => api);

const { ExtraAnswerMapping } = await import('../../resources/admin/src/builder/ExtraAnswerMapping');
const { AccountEditor } = await import('../../resources/admin/src/destinations/AccountEditor');

const destination: Destination = {
  id: 'route-1', type: 'mailchimp', label: 'Newsletter', target: 'Newsletter audience',
  connection: 'account-1', availability: 'ready', settings: { existing_contact: 'update' },
  health: { last_success_at: null, last_error: null, last_error_at: null, consecutive_failures: 0, skipped_captures: 0, last_skipped_at: null },
};
const template = { tree: {
  steps: [{ content: { type: 'question', id: 'question-1', label: 'Service needed' } }],
  submissions: [{ id: 'signup-1', fields: ['question-1'] }],
} } as unknown as Template;

describe('integration setup controls', () => {
  it('explains how to add a provider field when none can be mapped', async () => {
    api.readMappingFields.mockResolvedValue({ fields: [] });
    const user = userEvent.setup();
    render(<ExtraAnswerMapping destination={destination} submissionId="signup-1" template={template}
      value={{}} onChange={vi.fn()} />);
    await user.click(screen.getByText('Send extra answers'));
    expect(await screen.findByText('No compatible text fields were found. Add a text field in this service, then refresh fields.')).toBeVisible();
  });

  it('reviews the selected target, fields and update effect before an explicit sample send', async () => {
    api.readMappingFields.mockResolvedValue({ fields: [{ value: 'SERVICE', label: 'Service interest' }] });
    api.previewMapping.mockResolvedValue({ email: 'owner@example.com', mapped: { SERVICE: 'Repairs' } });
    api.testMapping.mockResolvedValue({ outcome: 'success', message: 'Provider accepted the sample.' });
    const user = userEvent.setup();
    render(<ExtraAnswerMapping destination={destination} submissionId="signup-1" template={template}
      value={{ 'question-1': 'SERVICE' }} onChange={vi.fn()} />);

    await user.click(screen.getByText('Send extra answers'));
    expect(await screen.findByRole('combobox', { name: 'Service needed' })).toHaveValue('SERVICE');
    const send = screen.getByRole('button', { name: 'Send test contact' });
    expect(send).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Your test email' }), 'owner@example.com');
    await user.type(screen.getByRole('textbox', { name: 'Sample answer: Service needed' }), 'Repairs');
    await user.click(screen.getByRole('button', { name: 'Preview data' }));
    expect(await screen.findByText('Sending to Newsletter audience.')).toBeVisible();
    expect(screen.getByText('If this contact exists, mapped fields may be updated.')).toBeVisible();
    expect(screen.getByText('Service interest: Repairs')).toBeVisible();
    expect(api.testMapping).not.toHaveBeenCalled();
    await user.click(send);
    expect(api.testMapping).toHaveBeenCalledWith('route-1', {
      email: 'owner@example.com', mapping: { 'question-1': 'SERVICE' }, sample: { 'question-1': 'Repairs' },
    });
  });

  it('requires the shared destructive confirmation before removing account credentials', async () => {
    api.deleteConnection.mockResolvedValue({ deleted: true });
    const user = userEvent.setup();
    const account = { id: 'account-1', type: 'mailchimp', label: 'Newsletter key', credentials: { api_key: true } } as Connection;
    const type: DestinationType = { id: 'mailchimp', label: 'Mailchimp', icon: 'mail', tier: 'elite', requires: null,
      requires_label: null, availability: 'ready', needs_connection: true, settings_schema: {},
      connection_schema: { api_key: { type: 'password', label: 'API key' } } };
    render(<AccountEditor types={[type]} connections={[account]} usage={{}} onChange={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByRole('button', { name: 'Connect Mailchimp' }).querySelector('img')).toHaveAttribute('alt', '');

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = within(screen.getByRole('alertdialog'));
    expect(dialog.getByText(/The saved credentials for “Newsletter key” will be removed/)).toBeVisible();
    expect(api.deleteConnection).not.toHaveBeenCalled();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(api.deleteConnection).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove account' }));
    expect(api.deleteConnection).toHaveBeenCalledWith('account-1');
  });
});

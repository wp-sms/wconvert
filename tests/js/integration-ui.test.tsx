import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Template } from '../../resources/renderer/src/types';
import type { Connection, Destination, DestinationType } from '../../resources/admin/src/destinations/api';
import { providerMarks } from '../../resources/admin/src/destinations/ProviderMark';

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
  beforeEach(() => vi.resetAllMocks());
  it('explains how to add a provider field when none can be mapped', async () => {
    api.readMappingFields.mockResolvedValue({ fields: [] });
    const user = userEvent.setup();
    render(<ExtraAnswerMapping destination={destination} submissionId="signup-1" template={template}
      value={{}} onChange={vi.fn()} />);
    await user.click(screen.getByText('Field mapping'));
    expect(await screen.findByText('No compatible text fields were found. Add a text field in this service, then refresh fields.')).toBeVisible();
  });

  it('reviews the selected target, fields and update effect before an explicit sample send', async () => {
    api.readMappingFields.mockResolvedValue({ fields: [{ value: 'SERVICE', label: 'Service interest' }] });
    api.previewMapping.mockResolvedValue({ email: 'owner@example.com', mapped: { SERVICE: 'Repairs' } });
    api.testMapping.mockResolvedValue({ outcome: 'success', message: 'Provider accepted the sample.' });
    const user = userEvent.setup();
    render(<ExtraAnswerMapping destination={destination} submissionId="signup-1" template={template}
      value={{ 'question-1': 'SERVICE' }} onChange={vi.fn()} />);

    await user.click(screen.getByText('Field mapping'));
    expect(await screen.findByRole('combobox', { name: 'Service needed' })).toHaveValue('SERVICE');
    expect(screen.queryByRole('button', { name: 'Send test contact' })).not.toBeInTheDocument();
    await user.click(screen.getByText('Preview and test mapping'));
    await user.type(screen.getByRole('textbox', { name: 'Your test email' }), 'owner@example.com');
    await user.type(screen.getByRole('textbox', { name: 'Sample answer: Service needed' }), 'Repairs');
    await user.click(screen.getByRole('button', { name: 'Preview data' }));
    expect(await screen.findByText('Sending to Newsletter audience.')).toBeVisible();
    expect(screen.getByText('If this contact exists, mapped fields may be updated.')).toBeVisible();
    expect(screen.getByText('Repairs')).toBeVisible();
    expect(api.testMapping).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Send test contact' }));
    expect(api.testMapping).toHaveBeenCalledWith('route-1', {
      email: 'owner@example.com', mapping: { 'question-1': 'SERVICE' }, sample: { 'question-1': 'Repairs' },
    });
  });

  it('keeps saved missing fields repairable even when the service has no fields left', async () => {
    api.readMappingFields.mockResolvedValue({ fields: [] });
    const change = vi.fn();
    const user = userEvent.setup();
    render(<ExtraAnswerMapping destination={destination} submissionId="signup-1" template={template}
      value={{ 'question-1': 'DELETED' }} onChange={change} />);
    await user.click(screen.getByText('Field mapping'));
    const field = await screen.findByRole('combobox', { name: 'Service needed' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Preview and test mapping')).not.toBeInTheDocument();
    await user.selectOptions(field, '');
    expect(change).toHaveBeenCalledWith({});
  });

  it('retries a failed field lookup without changing the mapping', async () => {
    api.readMappingFields.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValueOnce({ fields: [{ value: 'SERVICE', label: 'Service interest' }] });
    const user = userEvent.setup();
    render(<ExtraAnswerMapping destination={destination} submissionId="signup-1" template={template}
      value={{ 'question-1': 'SERVICE' }} onChange={vi.fn()} />);
    await user.click(screen.getByText('Field mapping'));
    await user.click(await screen.findByRole('button', { name: 'Retry loading fields' }));
    expect(await screen.findByRole('combobox', { name: 'Service needed' })).toHaveValue('SERVICE');
    expect(api.readMappingFields).toHaveBeenLastCalledWith('route-1', true);
  });

  it('explains used fields and can remove mappings whose campaign answer was removed', async () => {
    api.readMappingFields.mockResolvedValue({ fields: [{ value: 'SERVICE', label: 'Service interest' }] });
    const twoQuestions = { tree: { ...template.tree, steps: [{ content: { type: 'stack', children: [
      { type: 'question', id: 'question-1', label: 'Service needed' },
      { type: 'question', id: 'question-2', label: 'Other details' },
    ] } }] } } as unknown as Template;
    const change = vi.fn();
    const user = userEvent.setup();
    render(<ExtraAnswerMapping destination={destination} submissionId="signup-1" template={twoQuestions}
      value={{ 'question-1': 'SERVICE', deleted: 'OLD' }} onChange={change} />);
    await user.click(screen.getByText('Field mapping'));
    const field = await screen.findByRole('combobox', { name: 'Other details' });
    expect(within(field).getByRole('option', { name: 'Service interest — already used' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove unavailable answers' }));
    expect(change).toHaveBeenCalledWith({ 'question-1': 'SERVICE' });
  });

  it('discards an in-flight preview when the campaign mapping changes', async () => {
    api.readMappingFields.mockResolvedValue({ fields: [{ value: 'SERVICE', label: 'Service interest' }, { value: 'PROJECT', label: 'Project type' }] });
    let resolvePreview!: (result: { email: string; mapped: Record<string, string> }) => void;
    api.previewMapping.mockReturnValue(new Promise((resolve) => { resolvePreview = resolve; }));
    const user = userEvent.setup();
    const props = { destination, submissionId: 'signup-1', template, onChange: vi.fn() };
    const view = render(<ExtraAnswerMapping {...props} value={{ 'question-1': 'SERVICE' }} />);
    await user.click(screen.getByText('Field mapping'));
    await user.click(await screen.findByText('Preview and test mapping'));
    await user.type(screen.getByRole('textbox', { name: 'Your test email' }), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Preview data' }));
    expect(screen.getByRole('textbox', { name: 'Your test email' })).toBeDisabled();
    view.rerender(<ExtraAnswerMapping {...props} value={{ 'question-1': 'PROJECT' }} />);
    await act(async () => resolvePreview({ email: 'owner@example.com', mapped: { SERVICE: 'Old sample' } }));
    expect(screen.queryByText('Review this test send')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send test contact' })).not.toBeInTheDocument();
    expect(api.testMapping).not.toHaveBeenCalled();
  });

  it('reloads fields after an audience change and removes the old field choices', async () => {
    api.readMappingFields.mockResolvedValueOnce({ fields: [{ value: 'SERVICE', label: 'Service interest' }] })
      .mockResolvedValueOnce({ fields: [{ value: 'PROJECT', label: 'Project type' }] });
    const user = userEvent.setup();
    const props = { submissionId: 'signup-1', template, value: { 'question-1': 'SERVICE' }, onChange: vi.fn() };
    const view = render(<ExtraAnswerMapping {...props} destination={destination} />);
    await user.click(screen.getByText('Field mapping'));
    await screen.findByRole('option', { name: 'Service interest' });
    view.rerender(<ExtraAnswerMapping {...props} destination={{ ...destination, target: 'Other audience', settings: { audiences: ['other'] } }} />);
    await screen.findByRole('option', { name: 'Project type' });
    expect(screen.queryByRole('option', { name: 'Service interest' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Service needed' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('requires the shared destructive confirmation before removing account credentials', async () => {
    api.deleteConnection.mockResolvedValue({ deleted: true });
    const user = userEvent.setup();
    const account = { id: 'account-1', type: 'mailchimp', label: 'Newsletter key', credentials: { api_key: true } } as Connection;
    const type: DestinationType = { id: 'mailchimp', label: 'Mailchimp', icon: 'mail', tier: 'elite', requires: null,
      requires_label: null, availability: 'ready', needs_connection: true, settings_schema: {},
      connection_schema: { api_key: { type: 'password', label: 'API key' } } };
    // Free ships no provider artwork; Pro's admin entry fills the slot.
    providerMarks.mailchimp = 'data:image/svg+xml,%3Csvg%2F%3E';
    try {
      render(<AccountEditor types={[type]} connections={[account]} usage={{}} onChange={vi.fn().mockResolvedValue(undefined)} />);
    } finally { delete providerMarks.mailchimp; }

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

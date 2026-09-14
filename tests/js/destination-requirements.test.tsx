import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capturedFields, compatibilityProblems } from '../../resources/admin/src/destinations/requirements';
import { destinationsSaid } from '../../resources/admin/src/builder/destinations';
import { DestinationSettingsForm } from '../../resources/admin/src/destinations/DestinationSettingsForm';
import { SendTestDialog } from '../../resources/admin/src/destinations/SendTestDialog';
import type { Destination, DestinationType } from '../../resources/admin/src/destinations/api';
import type { Template } from '../../resources/renderer/src/types';

const { testSend } = vi.hoisted(() => ({ testSend: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', async (original) => ({ ...await original<object>(), testSend }));
beforeEach(() => { testSend.mockReset().mockResolvedValue({ outcome: 'success', message: 'Accepted by MailPoet.' }); });

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

describe('provider-declared destination requirements', () => {
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
      expect(compatibilityProblems({ ...route, settings: { lists } }, [{ name: 'email', required: true }]).join(' ')).toContain('Complete “Lists to add to”');
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
    const template: Template = { tokens: {}, tree: { steps: [{ type: 'split', start: [
      { type: 'field', name: 'email', required: true },
    ], end: [{ type: 'stack', children: [{ type: 'field', name: 'phone', required: false }, { type: 'button' }] }] }] } };
    expect(capturedFields(template)).toEqual([{ name: 'email', required: true }, { name: 'phone', required: false }]);
  });
  it('does not count fields on non-submitting screens as captured by the form', () => {
    const template: Template = { tokens: {}, tree: { steps: [
      { type: 'stack', children: [{ type: 'field', name: 'phone' }, { type: 'button', action: 'submit' }] },
      { type: 'stack', children: [{ type: 'field', name: 'email', required: true }] },
    ] } };
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
    expect(screen.getByText(/Campaign Undo cannot reverse/)).toBeInTheDocument();
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
    expect(screen.getByText(/Saved usage could not be read/)).toBeInTheDocument();
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LeadPage } from '../../resources/admin/src/leads/api';

const log = vi.hoisted(() => ({ readLog: vi.fn(), readRetention: vi.fn(), saveRetention: vi.fn(), exportUrl: vi.fn() }));
const optins = vi.hoisted(() => ({ listOptins: vi.fn() }));
vi.mock('../../resources/admin/src/leads/api', () => log);
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()), ...optins,
}));
const { LeadLog } = await import('../../resources/admin/src/leads/LeadLog');
const SNAPSHOT = '01J99999990000000000000000';
const CAPTURE = { id: '01J0000000AAAAAAAAAAAAAAAA', optin_id: 'OPTIN1', email: 'sarah@example.com',
  phone: null, fields: {}, created_at: '2026-08-01 09:30:00' };
const SEVEN = { submissions: 7, grouped: false, leads: [CAPTURE],
  groups: [{ identifier: 'sarah@example.com', submissions: 2, latest_id: CAPTURE.id, latest_at: CAPTURE.created_at }],
  next_cursor: null, snapshot: SNAPSHOT };
const OPTIN = { id: 'OPTIN1', name: 'Newsletter footer', goal: 'grow_email_list', parent_id: null,
  published_at: null, deleted_at: null, arms: [] };

describe('capture history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    log.readLog.mockImplementation((query: LeadPage) => Promise.resolve({ ...SEVEN, grouped: query.grouped === true }));
    log.readRetention.mockResolvedValue({ days: null, max_days: 3650 });
    log.exportUrl.mockImplementation((query: LeadPage) => `https://example.test/export?_wpnonce=y&identifier=${query.identifier ?? ''}`);
    optins.listOptins.mockResolvedValue([OPTIN]);
  });

  it('keeps loading distinct from no captures and then shows the answer', async () => {
    let finish!: (payload: unknown) => void;
    log.readLog.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<LeadLog />);
    expect(screen.queryByText('No submissions yet')).not.toBeInTheDocument();
    expect(await screen.findByText('Loading submissions…')).toBeInTheDocument();
    await act(async () => finish(SEVEN));
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  it('offers Optins when there are no submissions and no filters', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, submissions: 0, leads: [] });
    render(<LeadLog />);
    expect(await screen.findByText('No submissions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Optins' })).toHaveAttribute('href', '#optins');
  });

  it('gives a missing exact capture a retention-aware explanation', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, submissions: 0, leads: [] });
    render(<LeadLog query={{ leadId: CAPTURE.id }} />);
    expect(await screen.findByText('Submission not found')).toBeInTheDocument();
    expect(screen.getByText(/This ID may no longer be retained/)).toBeInTheDocument();
  });

  it('can retry the first failed read without reloading the whole page', async () => {
    log.readLog.mockRejectedValueOnce(new Error('History unavailable.'));
    render(<LeadLog />);
    await screen.findByText('History unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading submissions' }));
    expect(await screen.findByText('sarah@example.com')).toBeInTheDocument();
  });

  it('retries a name lookup without replacing or rereading the loaded history', async () => {
    optins.listOptins.mockRejectedValueOnce(new Error('Names unavailable.'));
    render(<LeadLog />);
    await screen.findByText('Names unavailable.');
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading submissions' }));
    await screen.findByRole('link', { name: 'Newsletter footer' });
    expect(log.readLog).toHaveBeenCalledTimes(1);
  });

  it('lets retention fail independently of successful history', async () => {
    log.readRetention.mockRejectedValue(new Error('Retention unavailable.'));
    render(<LeadLog />);
    expect(await screen.findByText('Retention unavailable.')).toBeInTheDocument();
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  it('keeps the headline as submissions when the grouping view changes', async () => {
    render(<LeadLog />);
    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    expect(await screen.findByText('2 submissions')).toBeInTheDocument();
    expect(screen.getByText('7 submissions')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d+\s+(people|persons|contacts)/i);
    expect(screen.getByText('Page 1 · 1 identifier group shown. Total above counts all matching submissions.')).toBeInTheDocument();
  });

  it('names soft-deleted Optins and nested A/B arms and links back to their editor', async () => {
    optins.listOptins.mockResolvedValue([{ ...OPTIN, arms: [{ ...OPTIN, id: 'ARM', name: 'Newsletter (B)', parent_id: 'OPTIN1' }] }]);
    log.readLog.mockResolvedValue({ ...SEVEN, leads: [{ ...CAPTURE, optin_id: 'ARM' }] });
    render(<LeadLog query={{ from: '2026-08-01' }} />);
    const link = await screen.findByRole('link', { name: 'Newsletter (B)' });
    expect(link.getAttribute('href')).toContain('ARM');
    expect(link.getAttribute('href')).toContain('2026-08-01');
    expect(optins.listOptins).toHaveBeenCalledWith(true);
  });

  it('applies exact identifier and inclusive dates together only on Apply', async () => {
    render(<LeadLog />);
    await screen.findByText('7 submissions');
    await userEvent.type(screen.getByLabelText('Email, phone or Lead ID'), ' alex@example.com ');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-31' } });
    expect(log.readLog).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ identifier: 'alex@example.com', from: '2026-08-01', to: '2026-08-31' })));
  });

  it('recognizes a pasted Lead ID and preserves existing date scope', async () => {
    const onQueryChange = vi.fn();
    render(<LeadLog query={{ from: '2026-08-01', to: '2026-08-31' }} onQueryChange={onQueryChange} />);
    await userEvent.type(screen.getByLabelText('Email, phone or Lead ID'), CAPTURE.id.toLowerCase());
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ leadId: CAPTURE.id, identifier: undefined, from: '2026-08-01', to: '2026-08-31' }));
  });

  it('follows browser-history query changes and resets stale filter inputs', async () => {
    const { rerender } = render(<LeadLog query={{ identifier: 'first@example.com' }} />);
    await screen.findByText('7 submissions');
    await userEvent.type(screen.getByLabelText('Email, phone or Lead ID'), 'draft');
    rerender(<LeadLog query={{ identifier: 'second@example.com', from: '2026-09-01' }} />);
    expect(screen.getByLabelText('Email, phone or Lead ID')).toHaveValue('second@example.com');
    expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ identifier: 'second@example.com' })));
  });

  it('clears every applied filter explicitly', async () => {
    const change = vi.fn();
    render(<LeadLog query={{ identifier: 'sarah@example.com', from: '2026-08-01' }} onQueryChange={change} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(change).toHaveBeenCalledWith({});
  });

  it('keeps rows and export on the last successful scope through a filter failure', async () => {
    const { rerender } = render(<LeadLog query={{ identifier: 'sarah@example.com' }} />);
    await screen.findByText('7 submissions');
    log.readLog.mockRejectedValueOnce(new Error('Read interrupted.'));
    rerender(<LeadLog query={{ identifier: 'alex@example.com' }} />);
    await screen.findByText('Read interrupted.');
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export matching submissions' })).toHaveAttribute('href', expect.stringContaining('sarah@example.com'));
    expect(screen.getByText(/last successful filters/)).toBeInTheDocument();
  });

  it('does not relabel event columns while grouping is still loading', async () => {
    render(<LeadLog />);
    await screen.findByRole('columnheader', { name: 'Submitted' });
    let finish!: (payload: unknown) => void;
    log.readLog.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    expect(screen.getByRole('columnheader', { name: 'Submitted' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Identifier' })).not.toBeInTheDocument();
    await act(async () => finish({ ...SEVEN, grouped: true }));
    expect(screen.getByRole('columnheader', { name: 'Identifier' })).toBeInTheDocument();
  });

  it('pages older and newer under one snapshot and exports all matching pages', async () => {
    log.readLog.mockImplementation((query: LeadPage) => Promise.resolve({ ...SEVEN, next_cursor: query.cursor ? null : 'next-page', leads: [{ ...CAPTURE, email: query.cursor ? 'older@example.com' : CAPTURE.email }] }));
    render(<LeadLog query={{ optinId: 'OPTIN1', from: '2026-08-01' }} />);
    await screen.findByText('sarah@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    expect(await screen.findByText('older@example.com')).toBeInTheDocument();
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next-page', snapshot: SNAPSHOT, from: '2026-08-01' }));
    expect(screen.getByText('Page 2 · 1 submission shown.')).toBeInTheDocument();
    expect(log.exportUrl).toHaveBeenLastCalledWith(expect.objectContaining({ snapshot: SNAPSHOT, optinId: 'OPTIN1', from: '2026-08-01' }));
    await userEvent.click(screen.getByRole('button', { name: 'Newer' }));
    await screen.findByText('sarah@example.com');
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, snapshot: SNAPSHOT }));
  });

  it('pluralizes the footer for multiple submissions and identifier groups', async () => {
    log.readLog.mockImplementation((query: LeadPage) => Promise.resolve({ ...SEVEN, grouped: query.grouped === true,
      leads: [CAPTURE, { ...CAPTURE, id: '01J0000000BBBBBBBBBBBBBBBB', email: 'alex@example.com' }],
      groups: [...SEVEN.groups, { ...SEVEN.groups[0], identifier: 'alex@example.com' }] }));
    render(<LeadLog />);
    expect(await screen.findByText('Page 1 · 2 submissions shown.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    expect(await screen.findByText('Page 1 · 2 identifier groups shown. Total above counts all matching submissions.')).toBeInTheDocument();
  });

  it('freezes pagination when the requested older page fails, and retries that page', async () => {
    log.readLog.mockResolvedValueOnce({ ...SEVEN, next_cursor: 'next-page' }).mockRejectedValueOnce(new Error('Page unavailable.'));
    render(<LeadLog />);
    await screen.findByText('sarah@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    await screen.findByText('Page unavailable.');
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByText('Page 1 · 1 submission shown.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading submissions' }));
    await screen.findByText('Page 2 · 1 submission shown.');
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next-page' }));
  });

  it('refreshes back to the newest page with a fresh snapshot request', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, next_cursor: 'next-page' });
    render(<LeadLog />);
    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    await screen.findByText('Page 2 · 1 submission shown.');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh submissions' }));
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, snapshot: undefined })));
  });

  it('drills a group down to actual capture events using the same filters and snapshot', async () => {
    render(<LeadLog query={{ from: '2026-08-01' }} />);
    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    await userEvent.click(await screen.findByRole('button', { name: 'View submissions' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submission history' });
    expect(await within(dialog).findByText(CAPTURE.id)).toBeInTheDocument();
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ groupIdentifier: 'sarah@example.com', grouped: false, from: '2026-08-01', snapshot: SNAPSHOT, cursor: undefined }));
    expect(within(dialog).getByRole('link', { name: 'Export these submissions' })).toBeInTheDocument();
    expect(log.exportUrl).toHaveBeenCalledWith(expect.objectContaining({ groupIdentifier: 'sarah@example.com', from: '2026-08-01', snapshot: SNAPSHOT }));
  });

  it('keeps captured fields and Lead ID readable without claiming a delivery status', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, leads: [{ ...CAPTURE, fields: { name: 'Sarah', consent_text: 'Please email me.', service: 'Repairs' } }] });
    render(<LeadLog />);
    await userEvent.click(await screen.findByText('View captured details'));
    expect(screen.getByText(CAPTURE.id)).toBeVisible();
    expect(screen.getByText('Please email me.')).toBeVisible();
    expect(screen.getByText('Repairs')).toBeVisible();
    expect(document.body.textContent).not.toMatch(/delivered|delivery succeeded/i);
  });
});

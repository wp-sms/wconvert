import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LeadPage } from '../../resources/admin/src/leads/api';

const log = vi.hoisted(() => ({ readLog: vi.fn(), readRetention: vi.fn(), saveRetention: vi.fn(), eraseIdentifier: vi.fn(), canExport: vi.fn(), exportLeads: vi.fn() }));
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
    log.eraseIdentifier.mockResolvedValue({ identifier: '+96899123456', removed: 7 });
    log.canExport.mockReturnValue(true);
    log.exportLeads.mockReturnValue(true);
    optins.listOptins.mockResolvedValue([OPTIN]);
  });

  it('offers the question-answer export only where answers can exist (ADR 0127)', async () => {
    const view = render(<LeadLog />);
    expect(await screen.findByRole('button', { name: 'Export matching submissions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export question answers' })).not.toBeInTheDocument();
    view.unmount();
    log.readLog.mockResolvedValue({ ...SEVEN, leads: [{ ...CAPTURE, question_answers: [{ id: 'q1', question: 'Size?', type: 'choice', values: ['s'], labels: ['Small'] }] }] });
    render(<LeadLog />);
    expect(await screen.findByRole('button', { name: 'Export question answers' })).toBeInTheDocument();
  });

  it('keeps count and export context in dismissible help rather than a permanent row', async () => {
    render(<LeadLog />);
    const help = await screen.findByRole('button', { name: 'About this count and export' });
    expect(screen.queryByText(/Showing:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Export includes every matching submission/)).not.toBeInTheDocument();
    await userEvent.click(help);
    expect(screen.getByText('Showing: All campaigns · Any time')).toBeVisible();
    expect(screen.getByText(/Export includes every matching submission/)).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText(/Showing:/)).not.toBeInTheDocument();
    expect(help).toHaveFocus();
    expect(log.readLog).toHaveBeenCalledTimes(1);
  });

  it('folds extra filters away, shows server-scoped purpose counts and applies a choice at once', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, purpose_counts: { all: 7, subscribers: 5, enquiries: 2 } });
    render(<LeadLog />);
    expect(await screen.findByText('sarah@example.com')).toBeInTheDocument();
    const purpose = screen.getByRole('group', { name: 'Submission purpose' });
    expect(within(purpose).getByRole('radio', { name: 'All submissions' })).toBeChecked();
    expect(within(purpose).getByText('5')).toBeInTheDocument();
    expect(screen.getByLabelText('Order')).not.toBeVisible();
    await userEvent.click(screen.getByText('More filters'));
    expect(screen.getByLabelText('Order')).toBeVisible();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom');
    expect(screen.getByLabelText('Period')).toHaveValue('custom');
    expect(screen.getByLabelText('From')).toBeVisible();
    // Choosing "Custom dates" applies nothing until a date is entered.
    expect(log.readLog).toHaveBeenCalledTimes(1);
    await userEvent.selectOptions(screen.getByLabelText('Order'), 'oldest');
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ order: 'oldest' })));
    expect(screen.getByLabelText('Order')).toHaveFocus();
  });

  it('opens a submission person-first and sees everything from the same email', async () => {
    const onQueryChange = vi.fn();
    log.readLog.mockResolvedValue({ ...SEVEN, leads: [{ ...CAPTURE, phone: '+96899123456', fields: { name: 'Sarah', message: 'Please help repair my window.' } }] });
    render(<LeadLog query={{ from: '2026-09-01', purpose: 'enquiries' }} onQueryChange={onQueryChange} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open submission from Sarah' }));
    const dialog = screen.getByRole('dialog', { name: 'sarah@example.com' });
    // The meta line is the rest of who they are, then how often they wrote.
    await waitFor(() => expect(dialog).toHaveAccessibleDescription('Sarah · +96899123456 · 7 submissions'));
    expect(log.readLog).toHaveBeenCalledWith({ identifier: 'sarah@example.com' });
    const details = within(dialog);
    expect(details.getByRole('heading', { name: 'Answers' })).toBeInTheDocument();
    expect(details.getByText('Please help repair my window.')).toBeVisible();
    expect(details.getByRole('heading', { name: 'Came from' })).toBeInTheDocument();
    expect(details.getByRole('link', { name: 'Newsletter footer' })).toHaveAttribute('href', expect.stringContaining('edit=OPTIN1'));
    expect(details.getByText('Not asked')).toBeVisible();
    expect(details.queryByText('Other details')).not.toBeInTheDocument();
    expect(details.getByRole('button', { name: 'All leads' })).toBeInTheDocument();
    await userEvent.click(details.getByRole('button', { name: 'See all from Sarah' }));
    expect(onQueryChange).toHaveBeenCalledWith({});
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ identifier: 'sarah@example.com' })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Go to campaigns' })).toHaveAttribute('href', '#optins');
  });

  it('gives a missing exact capture a retention-aware explanation', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, submissions: 0, leads: [] });
    render(<LeadLog query={{ leadId: CAPTURE.id }} />);
    expect(await screen.findByText('Submission not found')).toBeInTheDocument();
    expect(screen.getByText(/Retention or a privacy request may have deleted it/)).toBeInTheDocument();
  });

  it('refreshes a failed retention summary with the page retry', async () => {
    log.readLog.mockRejectedValueOnce(new Error('Submissions unavailable.'));
    log.readRetention.mockRejectedValueOnce(new Error('Retention unavailable.'));
    render(<LeadLog />);
    await screen.findByText(/Retention unavailable\./);
    // The log's own "Try again" also re-reads the policy under it.
    await userEvent.click((await screen.findAllByRole('button', { name: 'Try again' }))[0]);
    expect(await screen.findByText('Submissions are kept until you delete them.')).toBeVisible();
    expect(screen.queryByText(/Retention unavailable\./)).not.toBeInTheDocument();
    expect(log.readRetention).toHaveBeenCalledTimes(2);
    expect(log.saveRetention).not.toHaveBeenCalled();
  });

  it('can retry the first failed read without reloading the whole page', async () => {
    log.readLog.mockRejectedValueOnce(new Error('History unavailable.'));
    render(<LeadLog />);
    await screen.findByText('History unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('sarah@example.com')).toBeInTheDocument();
  });

  it('retries a name lookup without replacing or rereading the loaded history', async () => {
    optins.listOptins.mockRejectedValueOnce(new Error('Names unavailable.'));
    render(<LeadLog />);
    await screen.findByText(/Names unavailable\./);
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
    // Never the campaign's ID while its name is unknown.
    expect(document.body.textContent).not.toContain('OPTIN1');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('link', { name: 'Newsletter footer' });
    expect(log.readLog).toHaveBeenCalledTimes(1);
  });

  it('lets retention fail independently of successful history', async () => {
    log.readRetention.mockRejectedValue(new Error('Retention unavailable.'));
    render(<LeadLog />);
    expect(await screen.findByText(/Retention unavailable\./)).toBeInTheDocument();
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  it('keeps the headline as submissions when the grouping view changes', async () => {
    render(<LeadLog />);
    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    const row = (await screen.findByText('sarah@example.com', { selector: 'bdi' })).closest('tr')!;
    expect(within(row).getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(screen.getByText('7 submissions')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d+\s+(people|persons|contacts|leads)/i);
    // One page needs no pager.
    expect(screen.queryByText(/^Page/)).not.toBeInTheDocument();
  });

  it('erases every direct match only from an unqualified exact identifier scope', async () => {
    const exact = { ...SEVEN, leads: [{ ...CAPTURE, email: null, phone: '+96899123456' }] };
    let finishPreview!: (value: typeof exact) => void;
    const preview = new Promise<typeof exact>((resolve) => {
      finishPreview = resolve;
    });
    log.readLog.mockResolvedValueOnce(exact).mockReturnValueOnce(preview).mockResolvedValueOnce({ ...exact, submissions: 0, leads: [] });
    render(<LeadLog query={{ identifier: '+96899123456' }} />);
    await screen.findByText('+96899123456');
    await userEvent.click(screen.getByRole('button', { name: 'Delete this lead' }));
    // jsdom's name computation pads a <bdi> with a space; a browser does not.
    const dialog = screen.getByRole('alertdialog', { name: /^Delete every submission from \+96899123456\s?\?$/ });
    expect(within(dialog).getByText(/Counting their submissions/)).toBeVisible();
    expect(within(dialog).getByText(/Campaign totals in analytics stay/)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Delete permanently' })).toBeDisabled();

    await act(async () => {
      finishPreview(exact);
    });

    expect(await within(dialog).findByText(/all 7 submissions, from every campaign/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Export them first' }));
    expect(log.exportLeads).toHaveBeenCalledWith({ identifier: '+96899123456', snapshot: SNAPSHOT });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(log.eraseIdentifier).toHaveBeenCalledWith('+96899123456'));
    expect(await screen.findByText(/7 submissions deleted/)).toBeInTheDocument();
  });

  it('never offers privacy erasure for a date-narrowed identifier result', async () => {
    render(<LeadLog query={{ identifier: '+96899123456', from: '2026-09-01' }} />);
    await screen.findByText('7 submissions');
    expect(screen.queryByRole('button', { name: 'Delete this lead' })).not.toBeInTheDocument();
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

  it('applies typed values on Enter or on leaving the field, never per keystroke', async () => {
    render(<LeadLog />);
    await screen.findByText('7 submissions');
    await userEvent.type(screen.getByLabelText('Search submissions'), ' alex@example.com ');
    expect(log.readLog).toHaveBeenCalledTimes(1);
    await userEvent.type(screen.getByLabelText('Search submissions'), '{Enter}');
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ identifier: 'alex@example.com' })));
    await userEvent.click(screen.getByText('More filters'));
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-31' } });
    const reads = log.readLog.mock.calls.length;
    fireEvent.blur(screen.getByLabelText('To'));
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ identifier: 'alex@example.com', from: '2026-08-01', to: '2026-08-31' })));
    expect(log.readLog.mock.calls.length).toBe(reads + 1);
  });

  it('refuses an end date before the start date without applying it', async () => {
    render(<LeadLog query={{ from: '2026-08-10' }} />);
    await screen.findByText('7 submissions');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-01' } });
    fireEvent.blur(screen.getByLabelText('To'));
    expect(screen.getByRole('alert')).toHaveTextContent('The end date must be on or after the start date.');
    expect(log.readLog).toHaveBeenCalledTimes(1);
  });

  it('recognizes a pasted Lead ID and preserves existing date scope', async () => {
    const onQueryChange = vi.fn();
    render(<LeadLog query={{ from: '2026-08-01', to: '2026-08-31' }} onQueryChange={onQueryChange} />);
    await userEvent.type(screen.getByLabelText('Search submissions'), CAPTURE.id.toLowerCase());
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ leadId: CAPTURE.id, from: '2026-08-01', to: '2026-08-31' }));
    expect(onQueryChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('identifier');
  });

  it('follows browser-history query changes and resets stale filter inputs', async () => {
    const { rerender } = render(<LeadLog query={{ identifier: 'first@example.com' }} />);
    await screen.findByText('7 submissions');
    await userEvent.type(screen.getByLabelText('Search submissions'), 'draft');
    rerender(<LeadLog query={{ identifier: 'second@example.com', from: '2026-09-01' }} />);
    expect(screen.getByLabelText('Search submissions')).toHaveValue('second@example.com');
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
    await userEvent.click(screen.getByRole('button', { name: 'Export matching submissions' }));
    expect(log.exportLeads).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'sarah@example.com' }));
    expect(screen.getByText(/Showing the previous results/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'About this count and export' }));
    const help = within(screen.getByRole('dialog', { name: 'About this count and export' }));
    expect(help.getByText(/Showing:.*sarah@example.com/)).toBeVisible();
    expect(help.queryByText(/alex@example.com/)).not.toBeInTheDocument();
  });

  it('does not relabel event columns while grouping is still loading', async () => {
    render(<LeadLog />);
    await screen.findByRole('columnheader', { name: 'Submitted' });
    let finish!: (payload: unknown) => void;
    log.readLog.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    expect(screen.getByRole('columnheader', { name: 'Submitted' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Email or phone' })).not.toBeInTheDocument();
    await act(async () => finish({ ...SEVEN, grouped: true }));
    expect(screen.getByRole('columnheader', { name: 'Email or phone' })).toBeInTheDocument();
  });

  it('pages older and newer under one snapshot and exports all matching pages', async () => {
    log.readLog.mockImplementation((query: LeadPage) => Promise.resolve({ ...SEVEN, next_cursor: query.cursor ? null : 'next-page', leads: [{ ...CAPTURE, email: query.cursor ? 'older@example.com' : CAPTURE.email }] }));
    render(<LeadLog query={{ optinId: 'OPTIN1', from: '2026-08-01' }} />);
    await screen.findByText('sarah@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    expect(await screen.findByText('older@example.com')).toBeInTheDocument();
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next-page', snapshot: SNAPSHOT, from: '2026-08-01' }));
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Export matching submissions' }));
    expect(log.exportLeads).toHaveBeenLastCalledWith(expect.objectContaining({ snapshot: SNAPSHOT, optinId: 'OPTIN1', from: '2026-08-01' }));
    await userEvent.click(screen.getByRole('button', { name: 'Newer' }));
    await screen.findByText('sarah@example.com');
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, snapshot: SNAPSHOT }));
  });

  it('shows the pager only when there is another page, and names its direction by time', async () => {
    const one = render(<LeadLog />);
    await screen.findByText('sarah@example.com');
    expect(screen.queryByRole('button', { name: 'Older' })).not.toBeInTheDocument();
    one.unmount();
    log.readLog.mockResolvedValue({ ...SEVEN, next_cursor: 'next-page' });
    render(<LeadLog query={{ order: 'oldest' }} />);
    expect(await screen.findByText('Page 1')).toBeInTheDocument();
    // Oldest first, the next page is newer.
    expect(screen.getByRole('button', { name: 'Newer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
  });

  it('freezes pagination when the requested older page fails, and retries that page', async () => {
    log.readLog.mockResolvedValueOnce({ ...SEVEN, next_cursor: 'next-page' }).mockRejectedValueOnce(new Error('Page unavailable.'));
    render(<LeadLog />);
    await screen.findByText('sarah@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    await screen.findByText('Page unavailable.');
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Page 2');
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next-page' }));
  });

  it('refreshes back to the newest page with a fresh snapshot request', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, next_cursor: 'next-page' });
    render(<LeadLog />);
    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByRole('button', { name: 'Older' }));
    await screen.findByText('Page 2');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh submissions' }));
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, snapshot: undefined })));
  });

  it('drills a lead down to its submissions under the same filters and snapshot, in one dialog', async () => {
    render(<LeadLog query={{ from: '2026-08-01' }} />);
    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    await userEvent.click(await screen.findByRole('button', { name: 'Open submissions from sarah@example.com' }));
    const dialog = await screen.findByRole('dialog', { name: 'sarah@example.com' });
    expect(dialog).toHaveAccessibleDescription('7 submissions match the current filters');
    const open = await within(dialog).findByRole('button', { name: 'Open submission from sarah@example.com' });
    expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ groupIdentifier: 'sarah@example.com', grouped: false, from: '2026-08-01', snapshot: SNAPSHOT, cursor: undefined }));
    // Every row is the same person; a column naming them would repeat the title.
    expect(within(dialog).queryByRole('columnheader', { name: 'Submitted by' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Export these submissions' }));
    expect(log.exportLeads).toHaveBeenCalledWith(expect.objectContaining({ groupIdentifier: 'sarah@example.com', from: '2026-08-01', snapshot: SNAPSHOT }));

    // A submission opens in place, never as a second dialog over the first.
    await userEvent.click(open);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).getByRole('heading', { name: 'Came from' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Back' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(within(dialog).getByRole('button', { name: 'Open submission from sarah@example.com' })).toHaveFocus();
  });

  it('shows an empty history as a sentence, not a table of headers', async () => {
    log.readLog.mockImplementation((query: LeadPage) => Promise.resolve(query.groupIdentifier
      ? { ...SEVEN, submissions: 0, leads: [] }
      : { ...SEVEN, grouped: query.grouped === true }));
    render(<LeadLog />);
    await userEvent.click(await screen.findByLabelText('Group by email or phone'));
    await userEvent.click(await screen.findByRole('button', { name: 'Open submissions from sarah@example.com' }));
    const dialog = await screen.findByRole('dialog', { name: 'sarah@example.com' });
    expect(await within(dialog).findByText('No matching submissions')).toBeInTheDocument();
    expect(within(dialog).queryByRole('table')).not.toBeInTheDocument();
  });

  it('groups the facts, folds tracking fields away and shows no ID', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, leads: [{ ...CAPTURE, fields: { name: 'Sarah', consent_text: 'Please email me.', service: 'Repairs', utm_source: 'newsletter' } }] });
    render(<LeadLog />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open submission from Sarah' }));
    const dialog = within(screen.getByRole('dialog', { name: 'sarah@example.com' }));
    expect(dialog.getByText('Please email me.')).toBeVisible();
    expect(dialog.getByText('Service')).toBeVisible();
    expect(dialog.getByText('Repairs')).toBeVisible();
    expect(dialog.getByText('UTM source')).not.toBeVisible();
    await userEvent.click(dialog.getByText('Other details'));
    expect(dialog.getByText('UTM source')).toBeVisible();
    expect(dialog.getByText('newsletter')).toBeVisible();
    expect(document.body.textContent).not.toContain(CAPTURE.id);
    expect(document.body.textContent).not.toMatch(/utm_source|delivered|delivery succeeded/i);
  });

  it('titles a phone-only lead by its phone and names a deleted campaign without linking it', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, leads: [{ ...CAPTURE, email: null, phone: '+96899123456', optin_id: 'GONE',
      fields: { sms_consent_text: 'Text me offers.', sms_accepted_at: '2026-08-01T09:30:00Z' } }] });
    render(<LeadLog />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open submission from +96899123456' }));
    const dialog = within(screen.getByRole('dialog', { name: '+96899123456' }));
    expect(dialog.getByText('Deleted campaign')).toBeVisible();
    expect(dialog.queryByRole('link')).not.toBeInTheDocument();
    expect(dialog.getByText('Text me offers.')).toBeVisible();
    expect(dialog.getByText(/^Agreed Aug 1, 2026/)).toBeVisible();
    expect(dialog.getByRole('button', { name: 'See all from +96899123456' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('GONE');
  });

  it('calls a lead with nothing to identify it an unnamed lead', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN, leads: [{ ...CAPTURE, email: null, phone: null, fields: { message: 'Hello' } }] });
    render(<LeadLog />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open submission from Unnamed lead' }));
    const dialog = screen.getByRole('dialog', { name: 'Unnamed lead' });
    expect(within(dialog).queryByRole('button', { name: /See all from/ })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'All leads' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open submission from Unnamed lead' })).toHaveFocus();
  });

  it('searches captured names and messages, then narrows to enquiries without losing the search', async () => {
    render(<LeadLog />);
    await userEvent.type(await screen.findByLabelText('Search submissions'), 'repair{Enter}');
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'repair' })));
    await userEvent.click(screen.getByRole('radio', { name: 'Enquiries' }));
    await waitFor(() => expect(log.readLog).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'repair', purpose: 'enquiries' })));
    await userEvent.click(screen.getByRole('button', { name: 'Export matching submissions' }));
    expect(log.exportLeads).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'repair', purpose: 'enquiries', snapshot: SNAPSHOT }));
  });
});

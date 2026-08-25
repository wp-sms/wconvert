import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The lead log screen, and the one thing about it that is a decision rather
 * than a layout.
 *
 * **Grouping is presentation, never the count** (ADR 0021). The server carries
 * that in the payload's shape — one total, spelled `submissions` — and this is
 * the other end of it: the screen has to render that number and not one it
 * derived. A group count reaching the headline would be the product reporting
 * a second metric, and the only name for that metric is "people", which is the
 * number this system cannot honestly produce.
 */
const log = vi.hoisted(() => ({
  readLog: vi.fn(),
  readRetention: vi.fn(),
  saveRetention: vi.fn(),
  exportUrl: vi.fn(),
}));

const optins = vi.hoisted(() => ({ listOptins: vi.fn() }));

vi.mock('../../resources/admin/src/leads/api', () => log);
vi.mock('../../resources/admin/src/optins/api', () => optins);

const { LeadLog } = await import('../../resources/admin/src/leads/LeadLog');

/** Seven submissions, two of which are Sarah's. */
const SEVEN_SUBMISSIONS = {
  submissions: 7,
  leads: [
    {
      id: '01J0000000AAAAAAAAAAAAAAAA',
      optin_id: 'OPTIN1',
      email: 'sarah@example.com',
      phone: null,
      fields: {},
      created_at: '2026-08-01 09:30:00',
    },
  ],
  groups: [
    {
      identifier: 'sarah@example.com',
      submissions: 2,
      latest_id: '01J0000000AAAAAAAAAAAAAAAA',
      latest_at: '2026-08-01 09:30:00',
    },
  ],
};

describe('the lead log', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    log.readLog.mockImplementation((_optinId: string, grouped: boolean) =>
      Promise.resolve({ ...SEVEN_SUBMISSIONS, grouped }),
    );
    log.readRetention.mockResolvedValue({ days: null, max_days: 3650 });
    log.exportUrl.mockReturnValue('https://example.test/wp-admin/admin-post.php?action=x&_wpnonce=y');
    optins.listOptins.mockResolvedValue([
      { id: 'OPTIN1', name: 'Newsletter footer', goal: 'grow_email_list', published_at: null, deleted_at: null },
    ]);
  });

  it('reports submissions, and says so rather than saying "leads"', async () => {
    render(<LeadLog />);

    expect(await screen.findByText('7 submissions')).toBeInTheDocument();
  });

  /**
   * The boundary. Sarah's group reads "2 submissions" beside a headline that
   * still reads 7 — the toggle changed what a row IS and nothing else.
   */
  it('keeps the headline at submissions when the grouping toggle goes on', async () => {
    render(<LeadLog />);

    expect(await screen.findByText('7 submissions')).toBeInTheDocument();

    await userEvent.click(await screen.findByLabelText(/Group submissions/));

    await waitFor(() => expect(screen.getByText('2 submissions')).toBeInTheDocument());
    expect(screen.getByText('7 submissions')).toBeInTheDocument();
  });

  it('reports no count of people or unique leads anywhere on the screen', async () => {
    render(<LeadLog />);

    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByLabelText(/Group submissions/));

    await waitFor(() => expect(screen.getByText('2 submissions')).toBeInTheDocument());

    expect(document.body.textContent).not.toMatch(/unique/i);
    expect(document.body.textContent).not.toMatch(/\d+\s+(people|persons|contacts)/i);
  });

  /**
   * The Optin column shows the NAME. The id says nothing to a merchant
   * answering "which form did this come from?", and the name survives the
   * Optin being soft-deleted, which is what the soft delete is for.
   */
  it('labels a lead with its optin name rather than its id', async () => {
    render(<LeadLog />);

    // Scoped to the table, because the Optin filter above it lists the same
    // name in an <option>.
    const row = await screen.findByRole('row', { name: /sarah@example\.com/ });

    expect(row).toHaveTextContent('Newsletter footer');
    expect(row).not.toHaveTextContent('OPTIN1');
  });

  it('asks for deleted optins too, because a lead outlives the optin that captured it', async () => {
    render(<LeadLog />);

    await waitFor(() => expect(optins.listOptins).toHaveBeenCalledWith(true));
  });

  /**
   * **Keep-forever is the shipped default** (ADR 0018). Deleting a merchant's
   * Leads on the plugin's own opinion is a support catastrophe, and may
   * destroy records they must keep for unrelated reasons.
   */
  it('opens on keep-forever', async () => {
    render(<LeadLog />);

    expect(await screen.findByLabelText(/Keep them until I delete them/)).toBeChecked();
  });

  /**
   * **Typing a period must not save what it passes through.** Typing `90`
   * goes through `9`, and a saved 9 is a period the next cron run enforces —
   * deleting Leads because a merchant was mid-keystroke is the support
   * catastrophe ADR 0018 exists to avoid, arriving through the settings panel
   * instead of through a default.
   */
  it('does not save a retention period on every keystroke', async () => {
    log.readRetention.mockResolvedValue({ days: 30, max_days: 3650 });
    log.saveRetention.mockResolvedValue({ days: 90, max_days: 3650 });

    render(<LeadLog />);

    const field = await screen.findByRole('spinbutton');

    await userEvent.clear(field);
    await userEvent.type(field, '90');

    expect(log.saveRetention).not.toHaveBeenCalled();

    await userEvent.tab();

    await waitFor(() => expect(log.saveRetention).toHaveBeenCalledTimes(1));
    expect(log.saveRetention).toHaveBeenCalledWith(90);
  });

  it('saves the period once, on Enter', async () => {
    log.readRetention.mockResolvedValue({ days: 30, max_days: 3650 });
    log.saveRetention.mockResolvedValue({ days: 7, max_days: 3650 });

    render(<LeadLog />);

    const field = await screen.findByRole('spinbutton');

    await userEvent.clear(field);
    await userEvent.type(field, '7{Enter}');

    await waitFor(() => expect(log.saveRetention).toHaveBeenCalledTimes(1));
    expect(log.saveRetention).toHaveBeenCalledWith(7);
  });

  /**
   * Turning retention off is a discrete choice, so it commits at once — and it
   * commits null, never a zero that would read as "keep nothing".
   */
  it('commits keep-forever the moment it is chosen', async () => {
    log.readRetention.mockResolvedValue({ days: 30, max_days: 3650 });
    log.saveRetention.mockResolvedValue({ days: null, max_days: 3650 });

    render(<LeadLog />);

    await userEvent.click(await screen.findByLabelText(/Keep them until I delete them/));

    await waitFor(() => expect(log.saveRetention).toHaveBeenCalledWith(null));
  });

  it('says so when it is showing fewer rows than there are submissions', async () => {
    render(<LeadLog />);

    expect(await screen.findByText('Showing the newest 1 of 7 submissions.')).toBeInTheDocument();
  });

  it('offers the export as a link the browser navigates to, not a fetch', async () => {
    render(<LeadLog />);

    const link = await screen.findByRole('link', { name: 'Export CSV' });

    expect(link).toHaveAttribute('href', expect.stringContaining('_wpnonce'));
  });
});

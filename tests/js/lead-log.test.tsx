import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
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
// The network call is stubbed; `flattened` is NOT. It is a pure function over
// the response, and one of the things this screen decides is whether an A/B
// arm can label a Lead — a stubbed flatten would let the test answer that for
// itself. Same reason `optin-list.test.tsx` keeps `statusOf` real.
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()),
  ...optins,
}));

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

/**
 * ============================================================================
 * THE TWO REGIONS ANSWER FOUR SITUATIONS EACH, AND NEITHER WAS TESTED ON ANY.
 * ============================================================================
 * `Loadable` forces both regions here to branch on `loading | ready | failed`,
 * and nothing asserted any of the six branches. The retention card in
 * particular showed real radios greyed out while it read — a control saying
 * *you may not change this* about a value nobody had read yet — and no test
 * would have noticed either the gap or the fix.
 */
describe('the four situations the log has to answer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    log.readRetention.mockResolvedValue({ days: null, max_days: 3650 });
    log.exportUrl.mockReturnValue('https://example.test/x');
    optins.listOptins.mockResolvedValue([]);
  });

  it('says it is loading, and never that there is nothing', async () => {
    let land: (payload: unknown) => void = () => undefined;
    log.readLog.mockReturnValue(new Promise((resolve) => (land = resolve)));

    render(<LeadLog />);

    expect((await screen.findAllByRole('status')).length).toBeGreaterThan(0);
    expect(screen.queryByText('No submissions yet')).toBeNull();

    land({ ...SEVEN_SUBMISSIONS, grouped: false });

    expect(await screen.findByText('sarah@example.com')).toBeInTheDocument();
  });

  it('offers the door out where nothing has ever been captured', async () => {
    log.readLog.mockResolvedValue({ submissions: 0, leads: [], groups: [], grouped: false });

    render(<LeadLog />);

    expect(await screen.findByText('No submissions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Optins' })).toBeInTheDocument();
  });

  it('renders a first failure as the region’s whole content', async () => {
    log.readLog.mockRejectedValue(new Error('The log could not be read.'));

    render(<LeadLog />);

    expect(await screen.findByText('The log could not be read.')).toBeInTheDocument();
    expect(screen.getByText('Reload the page to try again.')).toBeInTheDocument();
  });

  it('retries a failed Optin-name lookup without losing a successfully loaded log', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN_SUBMISSIONS, grouped: false });
    optins.listOptins.mockRejectedValueOnce(new Error('Optin names could not be read.'));
    render(<LeadLog />);
    await screen.findByText('Optin names could not be read.');
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading submissions' }));
    await waitFor(() => expect(screen.queryByText('Optin names could not be read.')).toBeNull());
    expect(optins.listOptins).toHaveBeenCalledTimes(2);
    expect(log.readLog).toHaveBeenCalledTimes(1);
  });

  /**
   * **The retention card is its own region and fails on its own** (ADR 0039),
   * which is the half of the rule a page-top banner loses: the log above is
   * fine and says so.
   */
  it('fails the retention card without taking the log with it', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN_SUBMISSIONS, grouped: false });
    log.readRetention.mockRejectedValue(new Error('The retention period could not be read.'));

    render(<LeadLog />);

    expect(await screen.findByText('The retention period could not be read.')).toBeInTheDocument();
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
  });

  /**
   * **A loading state, not four real controls greyed out.** A disabled radio
   * says *you may not change this*; what was true was *we have not read it
   * yet*, and the two are not the same claim.
   */
  it('draws a placeholder for the retention period rather than dead controls', async () => {
    log.readLog.mockResolvedValue({ ...SEVEN_SUBMISSIONS, grouped: false });
    log.readRetention.mockReturnValue(new Promise(() => undefined));

    render(<LeadLog />);
    await userEvent.click(screen.getByRole('button', { name: /How long leads are kept/ }));

    await screen.findByText('sarah@example.com');

    expect(screen.queryByRole('radio', { name: /Keep them until I delete them/ })).toBeNull();
  });
});

describe('the lead log', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    log.readLog.mockImplementation((_optinId: string, grouped: boolean) =>
      Promise.resolve({ ...SEVEN_SUBMISSIONS, grouped }),
    );
    log.readRetention.mockResolvedValue({ days: null, max_days: 3650 });
    log.exportUrl.mockReturnValue('https://example.test/wp-admin/admin-post.php?action=x&_wpnonce=y');
    optins.listOptins.mockResolvedValue([
      {
        id: 'OPTIN1',
        name: 'Newsletter footer',
        goal: 'grow_email_list',
        parent_id: null,
        published_at: null,
        deleted_at: null,
        arms: [],
      },
    ]);
  });

  /**
   * ==========================================================================
   * A LEAD CAPTURED BY AN A/B ARM STILL KNOWS WHICH OPTIN CAPTURED IT.
   * ==========================================================================
   * The list route answers **parentless Optins only** (ADR 0045), which is
   * right for the Optins screen and would leave this one showing a raw ULID in
   * the Optin column for every Lead an arm captured — and no filter entry for
   * it either. The name is the only provenance a Lead has, and preserving it
   * is what the soft delete exists for (ADR 0002, ADR 0020); an arm is not
   * even deleted.
   *
   * The arms are already on the wire, nested under their parent, so this costs
   * no second read.
   */
  it('names the arm that captured a Lead, not just the campaigns', async () => {
    log.readLog.mockResolvedValue({
      ...SEVEN_SUBMISSIONS,
      leads: [{ ...SEVEN_SUBMISSIONS.leads[0], optin_id: 'OPTIN1B' }],
    });
    optins.listOptins.mockResolvedValue([
      {
        id: 'OPTIN1',
        name: 'Newsletter footer',
        goal: 'grow_email_list',
        parent_id: null,
        published_at: null,
        deleted_at: null,
        arms: [
          {
            id: 'OPTIN1B',
            name: 'Newsletter footer (B)',
            goal: 'grow_email_list',
            parent_id: 'OPTIN1',
            published_at: null,
            deleted_at: null,
            arms: [],
          },
        ],
      },
    ]);

    render(<LeadLog />);

    expect(await screen.findByText('Newsletter footer (B)')).toBeInTheDocument();
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

    await userEvent.click(await screen.findByLabelText(/Group by email or phone/));

    await waitFor(() => expect(screen.getByText('2 submissions')).toBeInTheDocument());
    expect(screen.getByText('7 submissions')).toBeInTheDocument();
  });

  it('reports no count of people or unique leads anywhere on the screen', async () => {
    render(<LeadLog />);

    await screen.findByText('7 submissions');
    await userEvent.click(screen.getByLabelText(/Group by email or phone/));

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
    await userEvent.click(screen.getByRole('button', { name: /How long leads are kept/ }));

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
    await userEvent.click(screen.getByRole('button', { name: /How long leads are kept/ }));

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
    await userEvent.click(screen.getByRole('button', { name: /How long leads are kept/ }));

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
    await userEvent.click(screen.getByRole('button', { name: /How long leads are kept/ }));

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
  it('does not relabel old rows or change the export while grouping is loading', async () => {
    render(<LeadLog />);
    await screen.findByRole('columnheader', { name: 'Submitted' });
    let finish!: (value: unknown) => void;
    log.readLog.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await userEvent.click(screen.getByLabelText('Group by email or phone'));
    expect(screen.getByRole('columnheader', { name: 'Submitted' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Identifier' })).not.toBeInTheDocument();
    expect(screen.getByText('Updating submissions…')).toBeInTheDocument();
    await act(async () => finish({ ...SEVEN_SUBMISSIONS, grouped: true }));
    expect(screen.getByRole('columnheader', { name: 'Identifier' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Submitted' })).not.toBeInTheDocument();
    expect(log.exportUrl).toHaveBeenLastCalledWith('');
  });

});

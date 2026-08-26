import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * The Optin list, and the one thing on it that is a decision rather than a
 * layout: **a row shows the merchant's word for its [[Goal]], not the id the
 * row stores.**
 *
 * The labels are translatable strings that live in PHP, where
 * `wp i18n make-pot` can see them, so the screen fetches the registry rather
 * than carrying a map of its own — which is also what keeps a Goal spelled
 * once (`tests/unit/Goal/GoalParityTest.php`).
 */
const optins = vi.hoisted(() => ({
  listOptins: vi.fn(),
  publishOptin: vi.fn(),
  unpublishOptin: vi.fn(),
  deleteOptin: vi.fn(),
}));

const goals = vi.hoisted(() => ({ listGoals: vi.fn() }));

// The four network calls are stubbed; `statusOf` and `isPublished` are NOT.
// They are pure functions over one row, and a row's STATE is one of the things
// this screen decides — a stubbed `statusOf` would let the list say
// [[Suspended]] because the test said so rather than because the row does.
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()),
  ...optins,
}));
vi.mock('../../resources/admin/src/goals/api', () => goals);

const { OptinList } = await import('../../resources/admin/src/optins/OptinList');

const OPTIN = {
  id: '01JQ00000000000000000000AA',
  name: 'Welcome discount',
  goal: 'grow_email_list',
  published_at: null,
  deleted_at: null,
  suspended: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  optins.listOptins.mockResolvedValue([OPTIN]);
  goals.listGoals.mockResolvedValue([
    { id: 'grow_email_list', label: 'Grow my email list', availability: 'ready' },
  ]);
});

describe('a row', () => {
  it('names its Goal the way the merchant does', async () => {
    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Grow my email list')).toBeInTheDocument();
    expect(screen.queryByText('grow_email_list')).toBeNull();
  });

  /**
   * An Optin holding a Goal this build does not have shows the raw value: it
   * is the only honest thing left, and blanking it would read as an Optin with
   * no Goal at all.
   */
  it('falls back to the stored value for a Goal this build does not have', async () => {
    optins.listOptins.mockResolvedValue([{ ...OPTIN, goal: 'from_a_plugin_we_lack' }]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('from_a_plugin_we_lack')).toBeInTheDocument();
  });

  /**
   * The registry is a nicety on this screen. Losing it must not cost the
   * merchant the publish and delete buttons beside it.
   */
  it('still lists and still acts when the registry cannot be read', async () => {
    goals.listGoals.mockRejectedValue(new Error('nope'));

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Welcome discount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByText('nope')).toBeNull();
  });
});

/**
 * ============================================================================
 * SUSPENDED IS VISIBLE, AND IT IS SHOWN WITH ITS CAUSE.
 * ============================================================================
 * *"This is the screen a merchant actually looks at when something stopped
 * working"* (ADR 0027). An Optin that quietly does not show is a merchant with
 * nowhere to ask why, so the state alone would be the answer that produces the
 * support ticket rather than the one that prevents it.
 */
describe('a suspended row', () => {
  const SUSPENDED = {
    ...OPTIN,
    published_at: '2026-08-01 09:00:00',
    suspended: 'Suspended — the “Clicks an element” rule needs WConvert Pro, which is not active',
  };

  it('shows the cause rather than a bare state', async () => {
    optins.listOptins.mockResolvedValue([SUSPENDED]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText(SUSPENDED.suspended)).toBeInTheDocument();
  });

  /**
   * It is still PUBLISHED underneath: the site is holding it back, the
   * merchant did not. Offering Publish would read as "this never went live"
   * and would ask them to undo something they never did.
   */
  it('keeps the unpublish control, because the merchant did not unpublish it', async () => {
    optins.listOptins.mockResolvedValue([SUSPENDED]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  /** And a running Optin says nothing of the sort. */
  it('is not what an ordinary published row says', async () => {
    optins.listOptins.mockResolvedValue([{ ...SUSPENDED, suspended: null }]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('published')).toBeInTheDocument();
  });
});

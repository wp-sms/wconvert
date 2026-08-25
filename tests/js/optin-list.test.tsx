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
  statusOf: vi.fn(() => 'draft'),
}));

const goals = vi.hoisted(() => ({ listGoals: vi.fn() }));

vi.mock('../../resources/admin/src/optins/api', () => optins);
vi.mock('../../resources/admin/src/goals/api', () => goals);

const { OptinList } = await import('../../resources/admin/src/optins/OptinList');

const OPTIN = {
  id: '01JQ00000000000000000000AA',
  name: 'Welcome discount',
  goal: 'grow_email_list',
  published_at: null,
  deleted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  optins.listOptins.mockResolvedValue([OPTIN]);
  optins.statusOf.mockReturnValue('draft');
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

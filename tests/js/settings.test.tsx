import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteAllowance } from '../../resources/admin/src/optins/SiteAllowance';
import { Settings } from '../../resources/admin/src/settings-page/Settings';
import { useAdminNavigation } from '../../resources/admin/src/hooks/useAdminNavigation';

const api = vi.hoisted(() => ({
  readSiteAllowance: vi.fn(),
  saveSiteAllowance: vi.fn(),
}));
vi.mock('../../resources/admin/src/optins/api', () => api);
const leads = vi.hoisted(() => ({
  readRetention: vi.fn(),
  saveRetention: vi.fn(),
}));
vi.mock('../../resources/admin/src/leads/api', () => leads);
const privacy = vi.hoisted(() => ({
  readDataMap: vi.fn(),
  readPrivacyGuidance: vi.fn(),
  savePrivacyGuidance: vi.fn(),
}));
vi.mock('../../resources/admin/src/privacy/api', () => privacy);
const request = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: request }));
// Connections & destinations is another screen's subject; here it only has to
// draw the heading and the button that search jumps to.
vi.mock('../../resources/admin/src/destinations/Destinations', () => ({
  Destinations: () => <section><h2>Destinations</h2><button type="button">Add a destination</button></section>,
}));
const COUNTRIES = [{ code: 'AM', name: 'Armenia' }, { code: 'OM', name: 'Oman' }];
const OFF = {
  maxImpressions: null,
  cooldownDays: null,
  stopAfterDismiss: false,
  stopAfterConversion: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  api.readSiteAllowance.mockResolvedValue(OFF);
  api.saveSiteAllowance.mockImplementation(async (next) => next);
  leads.readRetention.mockResolvedValue({ days: null, max_days: 3650 });
  leads.saveRetention.mockImplementation(async (days) => ({ days, max_days: 3650 }));
  privacy.readDataMap.mockResolvedValue({
    retention_days: null,
    destinations: [],
    browser: { key: 'wcv1', local_storage_expiry_days: null, cookie_fallback: true, cookie_fallback_days: 365, contains_contact_details: false, contains_visitor_identifier: false, stores_ab_assignment: false, cart_recovery: null },
    beacon_rate_limit_seconds: 60,
    capture_rate_limit_seconds: 600,
  });
  privacy.readPrivacyGuidance.mockResolvedValue({ enabled: true });
  privacy.savePrivacyGuidance.mockImplementation(async (enabled) => ({ enabled }));
  request.mockReset().mockImplementation(async ({ data }: { data?: { country: string } }) => ({ country: data?.country ?? 'AM', countries: COUNTRIES }));
});

const paid = () => {
  window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
  onTestFinished(() => { delete window.wconvertAdmin; });
};
const search = () => screen.getByRole('searchbox', { name: 'Find a setting' });

it('finds settings, not categories, without replacing the active form', async () => {
  render(<Settings group="experience" />);
  await userEvent.type(search(), 'retention');
  const results = screen.getByRole('list', { name: 'Matching settings' });
  expect(within(results).getByRole('link', { name: 'Delete submissions automatically · Data & privacy' })).toHaveAttribute('href', '#settings?group=data');
  expect(screen.queryByRole('link', { name: /Visitor experience/ })).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Display limits' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Back to Leads/ })).not.toBeInTheDocument();
});

it('lists matching settings as “Label · Group” rows and says so when none match', async () => {
  paid();
  render(<Settings group="experience" />);
  await userEvent.type(search(), 'email');
  const rows = within(screen.getByRole('list', { name: 'Matching settings' })).getAllByRole('link').map((row) => row.textContent);
  expect(rows).toEqual(expect.arrayContaining(['Blocked email domains · Spam protection', 'Always allow these emails · Spam protection']));
  await userEvent.clear(search());
  await userEvent.type(search(), 'zzzz');
  expect(screen.getByText('No settings match. Try “retention” or “email”.')).toHaveAttribute('role', 'status');
});

it('lists no Pro-only setting on a free install', async () => {
  render(<Settings group="experience" />);
  await userEvent.type(search(), 'blocked');
  expect(screen.queryByRole('link', { name: /Blocked email/ })).not.toBeInTheDocument();
  await userEvent.clear(search());
  await userEvent.type(search(), 'measurement');
  expect(screen.getByText(/No settings match/)).toBeInTheDocument();
});

it('focuses a setting in the open group when its row is chosen', async () => {
  render(<Settings group="data" />);
  await screen.findByRole('radio', { name: 'Delete them automatically after' });
  await userEvent.type(search(), 'retention');
  await userEvent.click(screen.getByRole('link', { name: /Delete submissions automatically/ }));
  expect(screen.getByRole('radio', { name: 'Delete them automatically after' })).toHaveFocus();
});

it('opens the first result on Enter', async () => {
  render(<Settings group="data" />);
  await screen.findByLabelText(/Show privacy guidance in the campaign editor/);
  await userEvent.type(search(), 'guidance{Enter}');
  expect(screen.getByLabelText(/Show privacy guidance in the campaign editor/)).toHaveFocus();
});

it('goes to another group and focuses the control once its region has loaded', async () => {
  window.history.replaceState({}, '', '#settings?group=experience');
  render(<SettingsHarness />);
  await screen.findByRole('heading', { name: 'Display limits' });
  await userEvent.type(search(), 'retention{Enter}');
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Delete them automatically after' })).toHaveFocus());
  expect(window.location.hash).toBe('#settings?group=data');
});

it('reaches a Connections control by its words, since that screen is not this one’s', async () => {
  render(<Settings group="connections" />);
  await userEvent.type(search(), 'add destination');
  await userEvent.click(screen.getByRole('link', { name: 'Add a destination · Connections & destinations' }));
  expect(screen.getByRole('button', { name: 'Add a destination' })).toHaveFocus();
});

it('opens a folded section to reach the setting inside it', async () => {
  paid();
  request.mockImplementation(async () => ({
    site_hostname: 'example.test', provider: 'none', site_key: '', has_secret: false, rules_available: true, rules_configured: false,
    rule_fields: [{ id: 'allowed_emails', label: 'Always allow these emails', help: '', value: '' }], diagnostics: { since: 1, counts: {} },
  }));
  const { container } = render(<Settings group="protection" />);
  await screen.findByText('No emails blocked');
  await userEvent.type(search(), 'allow');
  await userEvent.click(screen.getByRole('link', { name: /Always allow these emails/ }));
  expect(container.querySelector('details')).toHaveAttribute('open');
  expect(screen.getByLabelText('Always allow these emails')).toHaveFocus();
});

it('orders the rail as setup happens, Connections first', () => {
  paid();
  render(<Settings group="connections" />);
  const rail = screen.getByRole('navigation', { name: 'Settings categories' });
  expect(within(rail).getAllByRole('link').slice(0, 5).map((link) => link.querySelector('.font-medium')?.textContent)).toEqual([
    'Connections & destinations', 'Visitor experience', 'Spam protection', 'Data & privacy', 'Analytics integrations',
  ]);
  expect(within(rail).getByRole('link', { name: /Connections & destinations/ })).toHaveAttribute('aria-current', 'page');
});

/** Below `lg`, one select instead of five cards; jsdom has no breakpoints, so the classes are the contract. */
it('gives phones a compact category select and hides the rail’s reference there', async () => {
  render(<Settings group="experience" />);
  const select = screen.getByRole('combobox', { name: 'Settings category' });
  expect(select).toHaveValue('experience');
  expect(select).toHaveClass('lg:hidden');
  expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
    'Connections & destinations', 'Visitor experience', 'Spam protection', 'Data & privacy',
  ]);
  expect(screen.getByRole('link', { name: /Visitor experience/ })).toHaveClass('max-lg:hidden');
  expect(screen.getByRole('heading', { name: 'More with Pro' }).closest('.max-lg\\:hidden')).not.toBeNull();
  expect(screen.getByText(/set in each campaign’s editor/).closest('.max-lg\\:hidden')).not.toBeNull();
  await userEvent.selectOptions(select, 'data');
  expect(window.location.hash).toBe('#settings?group=data');
});

function SettingsHarness() {
  const navigation = useAdminNavigation();
  return (
    <>
      <Settings
        key={navigation.route.settingsGroup}
        group={navigation.route.settingsGroup}
        onEditingStateChange={navigation.onEditingStateChange}
      />
      {navigation.pending && (
        <div role="dialog">
          <button onClick={navigation.stay}>Keep editing</button>
          <button onClick={navigation.discard}>Discard changes</button>
        </div>
      )}
    </>
  );
}

it('keeps unsaved settings mounted until category navigation is confirmed', async () => {
  window.history.replaceState({}, '', '#settings?group=experience');
  render(<SettingsHarness />);
  await userEvent.type(await screen.findByLabelText(/Show campaigns at most/i), '3');
  await userEvent.click(screen.getByRole('link', { name: /Data & privacy/i }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText(/Show campaigns at most/i)).toHaveValue(3);
  await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText(/Show campaigns at most/i)).toHaveValue(3);
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
});

it('keeps site-wide limits as a complete draft until an explicit save', async () => {
  render(<SiteAllowance />);
  const count = await screen.findByLabelText(/Show campaigns at most/i);
  await userEvent.type(count, '10');
  await userEvent.click(screen.getByLabelText(/after a visitor closes/i));
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Save display limits' }),
  );
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Site-wide display limits' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Apply to all campaigns' }));
  expect(api.saveSiteAllowance).toHaveBeenCalledExactlyOnceWith({
    ...OFF,
    maxImpressions: 10,
    stopAfterDismiss: true,
  });
  expect(
    screen.getByRole('button', { name: 'Save display limits' }),
  ).toBeDisabled();
  expect(screen.getByText('Saved just now')).toBeInTheDocument();
});

it('saves the phone country only on Save, like every other settings section', async () => {
  render(<Settings group="experience" />);
  const picker = await screen.findByRole('button', { name: 'Default country Armenia' });
  await userEvent.click(picker);
  await userEvent.click(screen.getByRole('button', { name: 'Oman' }));
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save phone country' }));
  expect(request).toHaveBeenCalledWith({ path: '/wconvert/v1/optins/phone-country', method: 'POST', data: { country: 'OM' } });
  expect(await screen.findByRole('button', { name: 'Default country Oman' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save phone country' })).toBeDisabled();
});

it('orders Data & privacy by use: retention, the data map, requests, then guidance', async () => {
  render(<Settings group="data" />);

  expect(await screen.findByRole('table', { name: 'What is stored' })).toBeInTheDocument();
  await screen.findByRole('heading', { name: 'Privacy guidance' });
  await screen.findByRole('radio', { name: 'Delete them automatically after' });
  const content = screen.getByRole('table', { name: 'What is stored' }).closest('.max-w-\\[900px\\]') as HTMLElement;
  // The data map is a closed card between retention and requests (ADR 0132).
  expect(within(content).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
    'How long submissions are kept', 'Export and personal data', 'Privacy guidance',
  ]);
  const map = within(content).getByText('What visitor data is stored').closest('details')!;
  expect(map.compareDocumentPosition(within(content).getByRole('heading', { name: 'Export and personal data' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // Retention is open, not a disclosure to find.
  expect(screen.queryByRole('button', { name: /How long submissions are kept/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Download submissions as CSV in/)).toHaveTextContent('Download submissions as CSV in Leads');
  expect(screen.getByRole('link', { name: 'Leads' })).toHaveAttribute('href', '#leads');
  expect(screen.queryByText('Choose the campaigns and dates in Leads.')).not.toBeInTheDocument();
});

it('saves campaign privacy guidance without disabling core privacy tools', async () => {
  render(<Settings group="data" />);

  const guidance = await screen.findByLabelText(/Show privacy guidance in the campaign editor/);
  expect(guidance).toBeChecked();
  expect(guidance).toHaveAccessibleDescription(/Export, erasure and retention work either way/);

  await userEvent.click(guidance);
  expect(privacy.savePrivacyGuidance).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save privacy guidance' }));

  expect(privacy.savePrivacyGuidance).toHaveBeenCalledExactlyOnceWith(false);
  expect(await screen.findByText('Saved just now')).toBeInTheDocument();
  expect(screen.queryByText(/guidance saved/i)).not.toBeInTheDocument();
  await userEvent.click(guidance);
  expect(screen.queryByText('Saved just now')).not.toBeInTheDocument();
});

/**
 * Free's one list of what Pro adds lives here, static and bundled, and the
 * analytics category — a Pro page — is not offered at all (ADR 0116).
 */
it('lists what Pro adds on a free install and offers no Pro-only category', async () => {
  render(<Settings group="experience" />);
  expect(screen.getByRole('heading', { name: 'More with Pro' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Explore Pro/ })).toHaveAttribute('href', 'https://wconvert.io/pro/');
  expect(screen.queryByRole('link', { name: /Analytics integrations/ })).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Display limits' })).toBeInTheDocument();
});

it('lands a free install deep-linked to analytics on the default group', async () => {
  render(<Settings group="integrations" />);
  expect(await screen.findByRole('heading', { name: 'Destinations' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Connections & destinations/ })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByText('Analytics integrations')).not.toBeInTheDocument();
});

it('keeps the analytics category and drops the Pro list on a paid install', () => {
  window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
  onTestFinished(() => { delete window.wconvertAdmin; });
  render(<Settings group="experience" />);
  expect(screen.getByRole('link', { name: /Analytics integrations/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'More with Pro' })).not.toBeInTheDocument();
});

describe('phone default suggestion', () => {
  const answer = (saved: string, suggested: string | null, from: 'store' | 'language' | null) =>
    request.mockImplementation(async ({ data }: { data?: { country: string } }) => ({
      country: data?.country ?? saved, countries: COUNTRIES, suggested, suggested_from: from,
    }));

  it('offers the store’s country while no default is saved, and changes nothing until it is used', async () => {
    answer('', 'OM', 'store');
    render(<Settings group="experience" />);
    expect(await screen.findByText('Suggested: Oman, from your store address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Default country Choose a country' })).toHaveAccessibleDescription(/Phone fields start with no country selected\./);
    expect(screen.getByRole('button', { name: 'Save phone country' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Use Oman' }));
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    expect(screen.getByRole('button', { name: 'Default country Oman' })).toBeInTheDocument();
    expect(screen.queryByText(/Suggested:/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save phone country' }));
    expect(request).toHaveBeenCalledWith({ path: '/wconvert/v1/optins/phone-country', method: 'POST', data: { country: 'OM' } });
  });

  it('names the site language as the source when there is no store', async () => {
    answer('', 'AM', 'language');
    render(<Settings group="experience" />);
    expect(await screen.findByText('Suggested: Armenia, from your site language')).toBeInTheDocument();
  });

  it('suggests nothing once a default is saved, or when there is nothing to suggest', async () => {
    answer('AM', 'OM', 'store');
    const { unmount } = render(<Settings group="experience" />);
    await screen.findByRole('button', { name: 'Default country Armenia' });
    expect(screen.queryByText(/Suggested:/)).not.toBeInTheDocument();
    unmount();
    answer('', null, null);
    render(<Settings group="experience" />);
    await screen.findByRole('button', { name: 'Default country Choose a country' });
    expect(screen.queryByText(/Suggested:/)).not.toBeInTheDocument();
  });
});

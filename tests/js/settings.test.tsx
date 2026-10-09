import { beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});

it('finds a settings category by the task without replacing the active form', async () => {
  render(<Settings group="experience" />);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Find a setting' }), 'retention');
  expect(screen.getByRole('link', { name: /Data & privacy/ })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Visitor experience/ })).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Visitor experience' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Back to Leads/ })).not.toBeInTheDocument();
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
  await userEvent.type(await screen.findByLabelText(/Total campaign appearances/i), '3');
  await userEvent.click(screen.getByRole('link', { name: /Data & privacy/i }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText(/Total campaign appearances/i)).toHaveValue(3);
  await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText(/Total campaign appearances/i)).toHaveValue(3);
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
});

it('keeps site-wide limits as a complete draft until an explicit save', async () => {
  render(<SiteAllowance />);
  const count = await screen.findByLabelText(/Total campaign appearances/i);
  await userEvent.type(count, '10');
  await userEvent.click(screen.getByLabelText(/after a visitor closes/i));
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Save display limits' }),
  );
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog', { name: 'Review shared changes' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Apply to all campaigns' }));
  expect(api.saveSiteAllowance).toHaveBeenCalledExactlyOnceWith({
    ...OFF,
    maxImpressions: 10,
    stopAfterDismiss: true,
  });
  expect(
    screen.getByRole('button', { name: 'Save display limits' }),
  ).toBeDisabled();
  expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
});

it('keeps the site-specific data map with retention and personal-data actions', async () => {
  render(<Settings group="data" />);

  expect(await screen.findByRole('button', { name: /Where visitor data goes/ })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('heading', { name: 'Data & privacy' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Export and personal data' })).toBeInTheDocument();
});

it('saves Campaign privacy guidance without disabling core privacy tools', async () => {
  render(<Settings group="data" />);

  const guidance = await screen.findByLabelText(/Show privacy guidance in the Campaign editor/);
  expect(guidance).toBeChecked();
  expect(screen.getByText(/Export, erasure, retention and WordPress Privacy Policy tools stay available/)).toBeInTheDocument();

  await userEvent.click(guidance);
  expect(privacy.savePrivacyGuidance).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save privacy guidance' }));

  expect(privacy.savePrivacyGuidance).toHaveBeenCalledExactlyOnceWith(false);
  expect(await screen.findByText('Privacy guidance saved.')).toBeInTheDocument();
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
  expect(await screen.findByRole('heading', { name: 'Visitor experience' })).toBeInTheDocument();
});

it('lands a free install deep-linked to analytics on the default group', async () => {
  render(<Settings group="integrations" />);
  expect(await screen.findByRole('heading', { name: 'Visitor experience' })).toBeInTheDocument();
  expect(screen.queryByText('Analytics integrations')).not.toBeInTheDocument();
});

it('keeps the analytics category and drops the Pro list on a paid install', () => {
  window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
  onTestFinished(() => { delete window.wconvertAdmin; });
  render(<Settings group="experience" />);
  expect(screen.getByRole('link', { name: /Analytics integrations/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'More with Pro' })).not.toBeInTheDocument();
});

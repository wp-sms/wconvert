import { beforeEach, expect, it, vi } from 'vitest';
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
  await userEvent.type(await screen.findByLabelText(/at most this many/i), '3');
  await userEvent.click(screen.getByRole('link', { name: /Data & privacy/i }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText(/at most this many/i)).toHaveValue(3);
  await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText(/at most this many/i)).toHaveValue(3);
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
});

it('keeps site-wide limits as a complete draft until an explicit save', async () => {
  render(<SiteAllowance />);
  const count = await screen.findByLabelText(/at most this many/i);
  await userEvent.type(count, '10');
  await userEvent.click(screen.getByLabelText(/close any Campaign/i));
  expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Save display limits' }),
  );
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

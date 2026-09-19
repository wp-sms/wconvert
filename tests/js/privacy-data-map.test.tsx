import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const privacy = vi.hoisted(() => ({ readDataMap: vi.fn() }));
vi.mock('../../resources/admin/src/privacy/api', () => privacy);

import { PrivacyDataMap } from '../../resources/admin/src/privacy/PrivacyDataMap';

const MAP = {
  retention_days: null,
  destinations: [
    {
      id: 'DEST1',
      label: 'Newsletter subscribers',
      type: 'mailpoet',
      type_label: 'MailPoet',
      fields: ['email', 'name', 'interest'],
    },
  ],
  browser: {
    key: 'wcv1',
    local_storage_expiry_days: null,
    cookie_fallback: true,
    cookie_fallback_days: 365,
    contains_contact_details: false,
    contains_visitor_identifier: false,
  },
  beacon_rate_limit_seconds: 60,
};

beforeEach(() => {
  vi.clearAllMocks();
  privacy.readDataMap.mockResolvedValue(MAP);
});

it('explains this site’s actual WConvert storage and configured routes in merchant language', async () => {
  render(<PrivacyDataMap />);

  await screen.findByText('Newsletter subscribers');
  const region = screen.getByRole('heading', { name: 'Your data flow' }).closest('section');
  expect(region).not.toBeNull();
  if (region === null) return;
  expect(within(region).getByText(/email address, phone number, name, form answers and consent wording/i)).toBeVisible();
  expect(within(region).getByText(/kept until you delete them/i)).toBeVisible();
  expect(within(region).getByText('Newsletter subscribers')).toBeVisible();
  expect(within(region).getByText('MailPoet')).toBeVisible();
  expect(within(region).getByText(/Email address, name, interest answer/i)).toBeVisible();
  expect(within(region).getByText(/local storage/i)).toBeVisible();
  expect(within(region).getByText(/one year/i)).toBeVisible();
  expect(within(region).getByText(/one minute/i)).toBeVisible();
  expect(within(region).getByText(/CSV files, destination copies, email logs or backups/i)).toBeVisible();
});

it('shows a shape-matched loading state without claiming the site has no destinations', () => {
  privacy.readDataMap.mockReturnValue(new Promise(() => undefined));

  render(<PrivacyDataMap />);

  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByText(/No destinations are configured/)).not.toBeInTheDocument();
});

it('gives an empty configured-route list a direct way to connections', async () => {
  privacy.readDataMap.mockResolvedValue({ ...MAP, retention_days: 90, destinations: [] });

  render(<PrivacyDataMap />);

  expect(await screen.findByText(/deleted automatically after 90 days/i)).toBeVisible();
  expect(screen.queryByText('No automatic deletion')).not.toBeInTheDocument();
  expect(screen.getByText(/No destinations are configured/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Set up destinations' })).toHaveAttribute('href', '#settings?group=connections');
});

it('keeps an unavailable configured route visible without guessing its fields', async () => {
  privacy.readDataMap.mockResolvedValue({
    ...MAP,
    destinations: [{
      id: 'OLD', label: 'Old automation', type: 'removed-provider',
      type_label: 'removed-provider', fields: null,
    }],
  });

  render(<PrivacyDataMap />);

  expect(await screen.findByText('Old automation')).toBeVisible();
  expect(screen.getByText(/data details could not be read/i)).toBeVisible();
  expect(screen.queryByText(/May receive:/)).not.toBeInTheDocument();
});

it('keeps a failed read inside the data-flow region and names a recovery', async () => {
  privacy.readDataMap.mockRejectedValue({ message: 'Privacy details are unavailable.' });

  render(<PrivacyDataMap />);

  expect(await screen.findByText('Privacy details are unavailable.')).toBeVisible();
  expect(screen.getByText('Reload the page to try again.')).toBeVisible();
});

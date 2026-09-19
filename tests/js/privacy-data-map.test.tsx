import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
    stores_ab_assignment: false,
    cart_recovery: null,
  },
  beacon_rate_limit_seconds: 60,
  capture_rate_limit_seconds: 600,
};

beforeEach(() => {
  vi.clearAllMocks();
  privacy.readDataMap.mockResolvedValue(MAP);
});

const disclosure = () => screen.getByRole('button', { name: /Where visitor data goes/ });

it('explains where visitor data goes in direct merchant language', async () => {
  render(<PrivacyDataMap />);

  expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(disclosure());
  await screen.findByText('Newsletter subscribers');
  expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
  const region = disclosure().closest('section');
  expect(region).not.toBeNull();
  if (region === null) return;
  expect(within(region).getByRole('heading', { name: 'Saved in WConvert' })).toBeVisible();
  expect(within(region).getByText(/Form submissions include answers, consent text/i)).toBeVisible();
  expect(within(region).getByText(/do not include the page URL, IP address or browser details/i)).toBeVisible();
  expect(within(region).getByText(/Automatic deletion is off/i)).toBeVisible();
  expect(within(region).getByRole('heading', { name: 'Saved in the visitor’s browser' })).toBeVisible();
  expect(within(region).getByText(/until the visitor or browser clears it/i)).toBeVisible();
  expect(within(region).getByText(/up to one year/i)).toBeVisible();
  expect(within(region).getByRole('heading', { name: 'Campaign totals and form protection' })).toBeVisible();
  expect(within(region).getByText(/not individual visitors/i)).toBeVisible();
  expect(within(region).getByText(/one minute/i)).toBeVisible();
  expect(within(region).getByText(/each Campaign for 10 minutes/i)).toBeVisible();
  expect(within(region).getByRole('heading', { name: 'Sent to other services' })).toBeVisible();
  expect(within(region).getByText('Newsletter subscribers')).toBeVisible();
  expect(within(region).getByText('MailPoet')).toBeVisible();
  expect(within(region).getByText(/Can receive: Email address, Name, Interest answer/i)).toBeVisible();
  expect(within(region).getByRole('heading', { name: 'Copies you must manage separately' })).toBeVisible();
  expect(within(region).getByText(/For a deletion request, remove those copies separately/i)).toBeVisible();
});

it('shows a shape-matched loading state without claiming the site has no destinations', () => {
  privacy.readDataMap.mockReturnValue(new Promise(() => undefined));

  render(<PrivacyDataMap />);

  expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(disclosure());
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByText(/No destinations are set up/)).not.toBeInTheDocument();
});

it('gives an empty configured-route list a direct way to connections', async () => {
  privacy.readDataMap.mockResolvedValue({ ...MAP, retention_days: 90, destinations: [] });

  render(<PrivacyDataMap />);

  fireEvent.click(disclosure());
  expect(await screen.findByText(/deleted automatically 90 days after they are submitted/i)).toBeVisible();
  expect(screen.queryByText('Kept until you delete them')).not.toBeInTheDocument();
  expect(screen.getByText(/No destinations are set up/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Set up a destination' })).toHaveAttribute('href', '#settings?group=connections');
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

  fireEvent.click(disclosure());
  expect(await screen.findByText('Old automation')).toBeVisible();
  expect(screen.getByText(/cannot show which information it receives/i)).toBeVisible();
  expect(screen.queryByText(/Can receive:/)).not.toBeInTheDocument();
});

it('keeps a failed read inside the data-flow region and names a recovery', async () => {
  privacy.readDataMap.mockRejectedValue({ message: 'Privacy details are unavailable.' });

  render(<PrivacyDataMap />);

  await waitFor(() => expect(screen.getByText('Privacy details are unavailable.')).toBeVisible());
  expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Reload the page to try again.')).toBeVisible();
});

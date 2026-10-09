import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

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
    reopen_session: null,
    cart_recovery: null,
  },
  beacon_rate_limit_seconds: 60,
  capture_rate_limit_seconds: 600,
};

beforeEach(() => {
  vi.clearAllMocks();
  privacy.readDataMap.mockResolvedValue(MAP);
});

const storedTable = () => screen.findByRole('table', { name: 'What is stored' });
const rowWith = (table: HTMLElement, text: RegExp) => {
  const row = within(table).getAllByRole('row').find((each) => text.test(each.textContent ?? ''));
  if (!row) throw new Error(`No row matches ${text}`);
  return row;
};

it.each([
  ['plausible', 'Plausible', 'Google Analytics'],
  ['gtag', 'Google Analytics', 'Plausible'],
  ['gtm', 'Google Analytics', 'Plausible'],
])('names the configured recipient for %s analytics', async (route, provider, otherProvider) => {
  privacy.readDataMap.mockResolvedValue({ ...MAP, analytics_integration: { configured: true, route } });
  render(<PrivacyDataMap />);
  const sent = await screen.findByRole('table', { name: 'Sent to other services' });
  const row = rowWith(sent, /Analytics/);
  expect(row).toHaveTextContent(provider);
  expect(row).not.toHaveTextContent(otherProvider);
  expect(row).toHaveTextContent(/No form details/);
});

it('answers what is stored, why and for how long, as a table', async () => {
  render(<PrivacyDataMap />);

  const table = await storedTable();
  expect(within(table).getAllByRole('columnheader').map((each) => each.textContent)).toEqual(['What is stored', 'Why', 'How long']);
  const submissions = rowWith(table, /Form submissions/);
  expect(submissions).toHaveTextContent(/In WConvert/);
  expect(submissions).toHaveTextContent(/Until you delete them/);
  expect(within(submissions).getAllByRole('cell').map((cell) => cell.getAttribute('data-label'))).toEqual(['What is stored', 'Why', 'How long']);
  expect(rowWith(table, /Daily totals per campaign/)).toHaveTextContent(/Not individual visitors/);
  expect(rowWith(table, /saw, closed or completed/)).toHaveTextContent(/In the visitor’s browser/);
  expect(rowWith(table, /one-way code made from the IP address, not/)).toHaveTextContent(/One minute/);
  expect(rowWith(table, /IP address, per campaign/)).toHaveTextContent(/10 minutes/);
  // Modules this site does not run add no rows.
  expect(within(table).queryByText(/reopen button/i)).toBeNull();
  expect(within(table).queryByText(/item count/i)).toBeNull();

  const sent = screen.getByRole('table', { name: 'Sent to other services' });
  const newsletter = rowWith(sent, /Newsletter subscribers/);
  expect(newsletter).toHaveTextContent('MailPoet');
  expect(newsletter).toHaveTextContent('Email address, Name, Interest answer');
  expect(screen.getByText(/doesn’t delete copies at these services/)).toBeVisible();
});

it('folds the fine print away, closed', async () => {
  render(<PrivacyDataMap />);
  await storedTable();
  const detail = screen.getByText('More detail').closest('details');
  expect(detail).not.toHaveAttribute('open');
  expect(within(detail as HTMLElement).getByText(/a cookie keeps the display history for up to 365 days/)).toBeInTheDocument();
});

it('adds rows only for the storage this site actually uses', async () => {
  privacy.readDataMap.mockResolvedValue({
    ...MAP,
    retention_days: 90,
    product_activity_retention_days: 400,
    resource_send_limit_seconds: 600,
    browser: { ...MAP.browser, stores_ab_assignment: true, reopen_session: 'wcv_teaser1:', content_unlock: 'wcv_unlock1:',
      cart_recovery: { key: 'c', expires_with_cart_session: true, contains_item_count: true, contains_cart_total: true, contains_contact_details: false } },
  });
  render(<PrivacyDataMap />);
  const table = await storedTable();
  expect(rowWith(table, /Form submissions/)).toHaveTextContent('90 days after submission');
  expect(rowWith(table, /A\/B test version/)).toBeInTheDocument();
  expect(rowWith(table, /reopen buttons/)).toHaveTextContent(/browser session ends/);
  expect(rowWith(table, /content locks/)).toHaveTextContent('30 days');
  expect(rowWith(table, /item count and total/)).toHaveTextContent(/cart session ends/);
  expect(rowWith(table, /product and campaign/)).toHaveTextContent('400 days');
  expect(rowWith(table, /recipient and the resource/)).toHaveTextContent('10 minutes');
});

it('shows a loading state without claiming the site has no destinations', () => {
  privacy.readDataMap.mockReturnValue(new Promise(() => undefined));

  render(<PrivacyDataMap />);

  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByText(/No destinations are set up/)).not.toBeInTheDocument();
});

it('gives an empty destination list a direct way to connections', async () => {
  privacy.readDataMap.mockResolvedValue({ ...MAP, destinations: [] });

  render(<PrivacyDataMap />);

  expect(await screen.findByText(/No destinations are set up/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Set up a destination' })).toHaveAttribute('href', '#settings?group=connections');
  expect(screen.queryByRole('table', { name: 'Sent to other services' })).toBeNull();
});

it('keeps an unavailable destination visible without guessing its fields or printing its key', async () => {
  privacy.readDataMap.mockResolvedValue({
    ...MAP,
    destinations: [{
      id: 'OLD', label: 'Old automation', type: 'removed-provider',
      type_label: 'removed-provider', fields: null,
    }],
  });

  render(<PrivacyDataMap />);

  const sent = await screen.findByRole('table', { name: 'Sent to other services' });
  const row = rowWith(sent, /Old automation/);
  expect(row).toHaveTextContent(/isn’t available on this site/);
  expect(row).not.toHaveTextContent('removed-provider');
});

it('names a mapped-answers field rather than printing its key', async () => {
  privacy.readDataMap.mockResolvedValue({
    ...MAP,
    destinations: [{ ...MAP.destinations[0], fields: ['email', 'mapped form/quiz answers', 'some_future_field'] }],
  });
  render(<PrivacyDataMap />);
  const sent = await screen.findByRole('table', { name: 'Sent to other services' });
  expect(rowWith(sent, /Newsletter/)).toHaveTextContent('Email address, Mapped form and quiz answers, Other answers');
  expect(sent).not.toHaveTextContent('some_future_field');
});

it('keeps a failed read inside the region and offers Try again', async () => {
  privacy.readDataMap.mockRejectedValueOnce({ message: 'Privacy details are unavailable.' });

  render(<PrivacyDataMap />);

  expect(await screen.findByText('Privacy details are unavailable.')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'What visitor data is stored' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await storedTable()).toBeInTheDocument();
});

it('names a service only where it adds something to the destination’s own name', async () => {
  privacy.readDataMap.mockResolvedValue({
    ...MAP,
    destinations: [...MAP.destinations, { id: 'DEST2', label: 'Lead magnet email', type: 'resource_email', type_label: 'Lead magnet email', fields: ['email'] }],
  });
  render(<PrivacyDataMap />);
  const sent = await screen.findByRole('table', { name: 'Sent to other services' });
  expect(rowWith(sent, /Newsletter subscribers/)).toHaveTextContent('MailPoet');
  expect(within(rowWith(sent, /Lead magnet email/)).getAllByText('Lead magnet email')).toHaveLength(1);
});

it('links the privacy-policy text WConvert suggests to WordPress', async () => {
  render(<PrivacyDataMap />);
  await storedTable();
  expect(screen.getByRole('link', { name: 'Suggested privacy-policy text' })).toHaveAttribute('href', 'options-privacy.php?tab=policyguide');
});

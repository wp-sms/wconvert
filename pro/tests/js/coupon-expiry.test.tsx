import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import CouponLinkSettings, { expiryWarning } from '../../modules/cart-recovery/admin/CouponLinkSettings';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  window.wconvertAdmin = { ...(window.wconvertAdmin ?? {}), commerce: true } as typeof window.wconvertAdmin;
});
afterEach(() => {
  if (window.wconvertAdmin) delete (window.wconvertAdmin as { commerce?: boolean }).commerce;
});

it('warns when the coupon outlives the campaign, and says nothing otherwise', () => {
  expect(expiryWarning('BF30', { verdict: 'outlives', expires: 'December 31, 2026', ends: 'December 2, 2026 00:00' }))
    .toBe('BF30 stays valid until December 31, 2026, after this campaign ends on December 2, 2026 00:00.');
  expect(expiryWarning('BF30', { verdict: 'no_expiry', expires: null, ends: 'December 2, 2026 00:00' }))
    .toBe('BF30 never expires, so it keeps working after this campaign ends on December 2, 2026 00:00.');
  expect(expiryWarning('BF30', { verdict: 'ok', expires: 'December 1, 2026', ends: 'December 2, 2026 00:00' })).toBeNull();
  expect(expiryWarning('BF30', { verdict: 'unknown', expires: null, ends: 'December 2, 2026 00:00' })).toBeNull();
  expect(expiryWarning('BF30', null)).toBeNull();
});

it('asks the store about the block’s code against the campaign’s end and shows the hint', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ verdict: 'outlives', expires: 'December 31, 2026', ends: 'December 2, 2026 00:00' });
  render(<CouponLinkSettings code="BF30" href="" endsAt="2026-12-02 00:00" onChange={() => undefined} />);
  expect(await screen.findByText(/BF30 stays valid until December 31, 2026/)).toBeInTheDocument();
  expect(vi.mocked(apiFetch).mock.calls[0][0]).toMatchObject({ path: '/wconvert/v1/coupon-expiry?code=BF30&ends_at=2026-12-02+00%3A00' });
});

it('does not ask while the campaign has no end, or on a site without a store', async () => {
  render(<CouponLinkSettings code="BF30" href="" onChange={() => undefined} />);
  await new Promise((resolve) => setTimeout(resolve, 450));
  expect(apiFetch).not.toHaveBeenCalled();

  (window.wconvertAdmin as { commerce?: boolean }).commerce = false;
  const { container } = render(<CouponLinkSettings code="BF30" href="" endsAt="2026-12-02 00:00" onChange={() => undefined} />);
  await new Promise((resolve) => setTimeout(resolve, 450));
  expect(apiFetch).not.toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
});

it('keeps the panel quiet when the check fails', async () => {
  vi.mocked(apiFetch).mockRejectedValue({ message: 'nope' });
  render(<CouponLinkSettings code="BF30" href="" endsAt="2026-12-02 00:00" onChange={() => undefined} />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  expect(screen.queryByText(/stays valid|never expires/)).not.toBeInTheDocument();
});

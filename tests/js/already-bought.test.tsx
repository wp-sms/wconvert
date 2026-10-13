import { afterEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoreWithPro } from '../../resources/admin/src/settings-page/MoreWithPro';
import { HeaderTools, PORTAL_DOWNLOADS_URL } from '../../resources/admin/src/shell/HeaderTools';

/**
 * S11: a free install whose owner already paid finds the download in two
 * places — beside Explore Pro, and under More with Pro. Plain links: no
 * remote call, and no locked feature (wp.org guidelines 5, 7 and 11).
 */
afterEach(() => { delete window.wconvertAdmin; });

it('offers the download under More with Pro', () => {
  render(<MoreWithPro />);

  expect(screen.getByText(/Already bought Pro\?/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Download it from your account/ })).toHaveAttribute('href', PORTAL_DOWNLOADS_URL);
});

it('offers it beside Explore Pro on a free install only', () => {
  window.wconvertAdmin = { exportUrl: '', installedTier: 'free' };
  const { unmount } = render(<HeaderTools />);
  expect(screen.getByRole('link', { name: /Download it/ })).toHaveAttribute('href', PORTAL_DOWNLOADS_URL);
  unmount();

  window.wconvertAdmin = { exportUrl: '', installedTier: 'pro' };
  render(<HeaderTools />);
  expect(screen.queryByRole('link', { name: /Download it/ })).toBeNull();
});

import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpPage } from '../../resources/admin/src/help/HelpPage';
import { docsSearchUrl, docsUrl, GUIDES } from '../../resources/admin/src/shell/docs';
import { HELP_PAGE } from '../../resources/admin/src/help/page';
import { extraPageFor } from '../../resources/admin/src/extraPages';
import { Shell } from '../../resources/admin/src/shell/Shell';
import { HELP_URLS } from '../../resources/admin/src/shell/HeaderTools';
import { markSubmenuCurrent } from '../../resources/admin/src/shell/menuHighlight';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn(() => Promise.resolve([])) }));

/**
 * WConvert → Help (ADR 0144): every way out leads to wconvert.io in a new tab,
 * and the page itself fetches nothing.
 */
afterEach(() => { delete window.wconvertAdmin; });

it('searches the docs on wconvert.io with a plain form, opening a new tab', () => {
  render(<HelpPage />);

  const form = screen.getByRole('search');
  expect(form).toHaveAttribute('action', 'https://wconvert.io/docs/');
  expect(form).toHaveAttribute('method', 'get');
  expect(form).toHaveAttribute('target', '_blank');
  expect(within(form).getByRole('searchbox', { name: 'Search the guides on wconvert.io' })).toHaveAttribute('name', 'q');
  expect(within(form).getByRole('link', { name: /^Scroll trigger/ })).toHaveAttribute('href', 'https://wconvert.io/docs/?q=Scroll%20trigger');
  expect(docsSearchUrl('a&b')).toBe('https://wconvert.io/docs/?q=a%26b');
  expect(docsUrl(GUIDES.publishBlocked, 'publication-blockers')).toBe('https://wconvert.io/docs/form-rejected/#publication-blockers');
  expect(docsUrl()).toBe('https://wconvert.io/docs/');
});

it('leads to the first guide, the topics, the quick fixes and support, all on wconvert.io', () => {
  window.wconvertAdmin = { exportUrl: '', installedTier: 'free', version: '1.0.0' };
  render(<HelpPage />);

  expect(screen.getByRole('link', { name: /Create your first campaign/ })).toHaveAttribute('href', HELP_URLS.start);
  const topics = within(screen.getByRole('region', { name: 'Browse by topic' })).getAllByRole('link');
  expect(topics.map((link) => link.getAttribute('href'))).toContain('https://wconvert.io/docs/#spam-protection');
  expect(screen.getByRole('link', { name: /^Contact support/ })).toHaveAttribute('href', HELP_URLS.support);
  expect(screen.getByRole('link', { name: 'Tools → Site Health → Info' })).toHaveAttribute('href', 'site-health.php?tab=debug');
  expect(screen.getByText(/WConvert 1\.0\.0/)).toBeInTheDocument();
  for (const link of screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('https://'))) {
    expect(link).toHaveAttribute('target', '_blank');
  }
});

it('names the Pro troubleshooting guide and Pro support only where Pro is installed (ADR 0116)', () => {
  window.wconvertAdmin = { exportUrl: '', installedTier: 'free' };
  const { unmount } = render(<HelpPage />);
  expect(screen.queryByRole('link', { name: /Pro features or license updates/ })).toBeNull();
  unmount();

  window.wconvertAdmin = { exportUrl: '', installedTier: 'pro', tiers: { pro: { name: 'Pro', product_name: 'WConvert Pro' } } };
  render(<HelpPage />);
  expect(screen.getByRole('link', { name: /Pro features or license updates/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Contact Pro support/ })).toBeInTheDocument();
});

it('is registered at #help by the app itself, so Pro\'s entry has it too', async () => {
  await import('../../resources/admin/src/App');
  expect(extraPageFor('#help')).toBe(HELP_PAGE);
});

it('marks the header ? as current on the Help page, and its popover leaves out the page it is on', async () => {
  const { unmount } = render(<Shell section="optins"><p>Campaigns</p></Shell>);
  expect(screen.getByRole('button', { name: 'Help' })).not.toHaveAttribute('aria-current');
  await userEvent.click(screen.getByRole('button', { name: 'Help' }));
  expect(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Open the Help page' })).toHaveAttribute('href', '#help');
  unmount();

  render(<Shell page={{ id: 'help', title: 'Help', description: 'Guides.' }}><p>Body</p></Shell>);
  const trigger = screen.getByRole('button', { name: 'Help' });
  expect(trigger).toHaveAttribute('aria-current', 'page');
  await userEvent.click(trigger);
  const help = await screen.findByRole('dialog');
  expect(within(help).getByRole('link', { name: 'Guides (opens in a new tab)' })).toHaveAttribute('href', 'https://wconvert.io/docs/');
  expect(within(help).queryByRole('link', { name: 'Open the Help page' })).toBeNull();
  // The menu searches the docs the same way the page does.
  const search = within(help).getByRole('search');
  expect(search).toHaveAttribute('action', 'https://wconvert.io/docs/');
  expect(search).toHaveAttribute('target', '_blank');
  expect(within(search).getByRole('searchbox', { name: 'Search the guides on wconvert.io' })).toHaveAttribute('name', 'q');
});

it('makes the page\'s own WordPress submenu entry current, and puts Campaigns back on leaving', () => {
  const menu = document.createElement('ul');
  document.body.append(menu);
  menu.innerHTML = `<li id="toplevel_page_wconvert"><ul class="wp-submenu">
    <li class="current"><a class="current" href="admin.php?page=wconvert">Campaigns</a></li>
    <li><a href="admin.php?page=wconvert#help">Help</a></li>
    <li><a href="admin.php?page=wconvert#license">License</a></li></ul></li>`;
  const [campaigns, help, license] = Array.from(menu.querySelectorAll('a'));

  const undo = markSubmenuCurrent('help');
  expect(help).toHaveAttribute('aria-current', 'page');
  expect(help.parentElement).toHaveClass('current');
  expect(campaigns).not.toHaveClass('current');
  expect(license).not.toHaveClass('current');

  undo();
  expect(help).not.toHaveAttribute('aria-current');
  expect(campaigns).toHaveClass('current');
  menu.remove();
});

/** A free install's suggestions and topic lines name only what it does (ADR 0147). */
it('keeps Pro features out of a free install’s searches and topics', () => {
  window.wconvertAdmin = { exportUrl: '', installedTier: 'free' };
  const { unmount } = render(<HelpPage />);
  expect(screen.queryByRole('link', { name: /^Exit intent/ })).toBeNull();
  expect(screen.queryByText(/Recommend products|quiz answers/)).toBeNull();
  expect(screen.getByText('Target baskets and understand product activity.')).toBeInTheDocument();
  unmount();

  window.wconvertAdmin = { exportUrl: '', installedTier: 'pro', tiers: { pro: { name: 'Pro', product_name: 'WConvert Pro' } } };
  render(<HelpPage />);
  expect(screen.getByRole('link', { name: /^Exit intent/ })).toBeInTheDocument();
  expect(screen.getByText(/Recommend products/)).toBeInTheDocument();
});

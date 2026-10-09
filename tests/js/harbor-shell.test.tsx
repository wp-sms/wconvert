import { afterEach, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from '../../resources/admin/src/shell/Shell';
import { PageAction } from '../../resources/admin/src/shell/PageActions';

afterEach(() => { delete window.wconvertAdmin; });

it('keeps section navigation and portaled actions in the light heading area', () => {
  render(<Shell section="analytics"><PageAction><button>Choose period</button></PageAction><p>Report</p></Shell>);
  expect(within(screen.getByRole('navigation', { name: 'WConvert sections' })).getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('heading', { level: 1, name: 'Analytics' }).closest('.wconvert-panel-nav')).toBeNull();
  expect(screen.getByRole('button', { name: 'Choose period' }).closest('.wconvert-panel-heading')).not.toBeNull();
  expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Visitor experience' })).toHaveAttribute('href', '#settings?group=experience');
});

it('shows publisher branding without site identity and opens working footer help', async () => {
  window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.test/shop/', siteName: 'A & B', installedTier: 'free' };
  render(<Shell section="optins"><p>Campaigns</p></Shell>);
  expect(screen.queryByRole('link', { name: 'A & B' })).toBeNull();
  expect(screen.queryByText(/A & B/)).toBeNull();
  expect(within(screen.getByRole('contentinfo')).getByText('Free')).toBeVisible();
  expect(screen.getByRole('link', { name: 'By VeronaLabs (opens in a new tab)' })).toHaveAttribute('href', 'https://veronalabs.com/');
  expect(screen.getByRole('img', { name: 'VeronaLabs' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Need a hand? Help' }));
  expect(screen.getByRole('link', { name: 'Connections & destinations' })).toHaveAttribute('href', '#settings?group=connections');
  expect(screen.getByRole('link', { name: 'WConvert website' })).toHaveAttribute('href', 'https://wconvert.io/');
});

it('omits the service footer and visible page heading during creation', () => {
  render(<Shell section="optins" hidePageHeading><p>Choose a goal</p></Shell>);
  expect(screen.queryByRole('contentinfo')).toBeNull();
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('sr-only');
  expect(screen.queryByRole('link', { name: 'View website' })).toBeNull();
});

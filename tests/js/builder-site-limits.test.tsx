import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteAllowance } from '../../resources/admin/src/optins/api';

const request = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: request }));
const { SiteLimitsNote } = await import('../../resources/admin/src/builder/rules/SiteLimitsNote');

const OFF: SiteAllowance = { maxImpressions: null, cooldownDays: null, stopAfterDismiss: false, stopAfterConversion: false };
const SAVED: SiteAllowance = { maxImpressions: 3, cooldownDays: 2, stopAfterDismiss: true, stopAfterConversion: true };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => { request.mockReset().mockResolvedValue(OFF); });

afterEach(() => {
  // Exercise the real API helper, and refuse a write regardless of the path
  // through loading, retry or effect cleanup that the case took.
  for (const [options] of request.mock.calls) {
    expect(options).toEqual({ path: '/wconvert/v1/optins/frequency' });
  }
});

describe('saved site-wide limits beside an Optin draft', () => {
  it('says nothing while it loads, then names the saved limits', async () => {
    const pending = deferred<SiteAllowance>();
    request.mockReturnValue(pending.promise);
    const view = render(<SiteLimitsNote />);
    expect(view.container).toBeEmptyDOMElement();
    expect(screen.queryByText(/No site-wide limits/)).toBeNull();
    expect(screen.queryByText(/at most/)).toBeNull();
    await act(async () => { pending.resolve(SAVED); });
    const note = screen.getByRole('complementary', { name: 'Site-wide limits' });
    expect(note).toHaveTextContent('Show campaigns at most 3 times per visitor · Wait 2 days between campaigns · Stop showing campaigns after a visitor closes one · Stop showing campaigns after a visitor converts');
    expect(note).toHaveTextContent('A campaign cannot override these limits.');
    expect(screen.getByRole('link', { name: 'Manage them in Settings' })).toHaveAttribute('href', '#settings?group=experience');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('draws nothing when the site sets no limit', async () => {
    const view = render(<SiteLimitsNote />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(view.container).toBeEmptyDOMElement();
  });

  it('shows a failed read distinctly and lets Retry replace it with saved values', async () => {
    const retry = deferred<SiteAllowance>();
    request.mockRejectedValueOnce(new Error('The server is unavailable.')).mockReturnValueOnce(retry.promise);
    render(<SiteLimitsNote />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check the site-wide limits. The server is unavailable.');
    expect(screen.queryByText(/No site-wide limits/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => { retry.resolve(SAVED); });
    expect(screen.getByRole('complementary')).toHaveTextContent('at most 3 times per visitor');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it.each(['success', 'failure'] as const)('ignores late %s from an effect cleaned up before the current read', async (outcome) => {
    const stale = deferred<SiteAllowance>();
    request.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(SAVED);
    // StrictMode re-runs an effect after cleanup while keeping the component
    // instance. Without the active guard, its first read overwrites the second.
    render(<StrictMode><SiteLimitsNote /></StrictMode>);
    await waitFor(() => expect(screen.getByRole('complementary')).toHaveTextContent('at most 3 times per visitor'));
    await act(async () => { if (outcome === 'success') stale.resolve(OFF); else stale.reject(new Error('old request')); });
    expect(screen.getByRole('complementary')).toHaveTextContent('at most 3 times per visitor');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/No site-wide limits/)).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('settles a request after unmount without creating another read or changing settings', async () => {
    const pending = deferred<SiteAllowance>();
    request.mockReturnValueOnce(pending.promise);
    const view = render(<SiteLimitsNote />);
    view.unmount();
    await act(async () => { pending.resolve(SAVED); });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

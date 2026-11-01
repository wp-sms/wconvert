import { Suspense, type ReactElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * A lazily loaded screen counts as in flight from its download until it mounts
 * (#397), so the header's bell never reads in the gap React leaves between a
 * chunk landing and the screen it holds appearing. Each way out is pinned:
 * mounting, never mounting, and a download that fails.
 */
vi.mock('@wordpress/api-fetch', () => ({ default: Object.assign(() => Promise.resolve([]), { use: () => {} }) }));
const { lazyScreen, resetRequestActivity, whenQuiet } = await import('../../resources/admin/src/lib/requestActivity');
const { ChunkBoundary } = await import('../../resources/admin/src/shell/ChunkBoundary');

function chunk() {
  let land!: () => void;
  let fail!: (cause: Error) => void;
  const promise = new Promise<{ default: () => ReactElement }>((done, reject) => {
    land = () => done({ default: () => <p>The screen</p> });
    fail = reject;
  });
  return { promise, land, fail };
}

/** How long after `from` the screen counted as quiet. */
const quietAfter = (quiet: Promise<void>, from: () => number) => quiet.then(() => performance.now() - from());

beforeEach(() => resetRequestActivity());
afterEach(() => resetRequestActivity());

it('holds until the screen mounts, then lets go', async () => {
  const download = chunk();
  const Screen = lazyScreen(() => download.promise);
  render(<Suspense fallback={<p>Waiting</p>}><Screen /></Suspense>);
  let landed = 0;
  let early = false;
  const quiet = quietAfter(whenQuiet(5000).then(() => { early = landed === 0; }), () => landed);

  await new Promise((wait) => setTimeout(wait, 400));
  expect(early).toBe(false);
  landed = performance.now();
  download.land();
  expect(await screen.findByText('The screen')).toBeInTheDocument();
  expect(await quiet).toBeLessThan(800);
  expect(early).toBe(false);
});

it('lets go a second after the file lands when the screen never mounts', async () => {
  const download = chunk();
  const Screen = lazyScreen(() => download.promise);
  const { unmount } = render(<Suspense fallback={<p>Waiting</p>}><Screen /></Suspense>);
  unmount();
  const landed = performance.now();
  download.land();

  const waited = await quietAfter(whenQuiet(5000), () => landed);
  expect(waited).toBeGreaterThanOrEqual(1000);
  expect(waited).toBeLessThan(2000);
});

it('lets go at once when the download fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const download = chunk();
  const Screen = lazyScreen(() => download.promise);
  render(<ChunkBoundary><Suspense fallback={<p>Waiting</p>}><Screen /></Suspense></ChunkBoundary>);
  const failed = performance.now();
  download.fail(new Error('Failed to fetch dynamically imported module'));

  expect(await screen.findByText('Part of WConvert didn’t load.')).toBeInTheDocument();
  expect(await quietAfter(whenQuiet(5000), () => failed)).toBeLessThan(800);
});

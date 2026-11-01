import { describe, expect, it, vi } from 'vitest';

/**
 * Pro's renderer registrations arrive as loaders (#397), and every boundary
 * that draws a design waits for them beside its own chunk. A fresh module per
 * test, since loaders are registered once per page.
 */
async function fresh() {
  vi.resetModules();
  return import('../../resources/admin/src/renderExtensions');
}

function deferred() {
  let resolve!: () => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

/** Whether a promise has settled, after letting microtasks run. */
async function settled(promise: Promise<unknown>) {
  let done = false;
  promise.then(() => { done = true; }, () => { done = true; });
  await new Promise((wait) => setTimeout(wait, 0));
  return done;
}

describe('withRenderExtensions', () => {
  it('waits for a registered loader before the chunk counts as loaded', async () => {
    const { renderExtensions, withRenderExtensions } = await fresh();
    const journeys = deferred();
    const registered: string[] = [];
    renderExtensions.load(() => journeys.promise.then(() => { registered.push('journeys'); }));

    const design = withRenderExtensions(Promise.resolve({ default: 'CampaignDesign' }));
    expect(await settled(design)).toBe(false);

    journeys.resolve();
    await expect(design).resolves.toEqual({ default: 'CampaignDesign' });
    expect(registered).toEqual(['journeys']);
  });

  it('runs each loader once, however many boundaries ask', async () => {
    const { renderExtensions, withRenderExtensions } = await fresh();
    const loader = vi.fn(() => Promise.resolve());
    renderExtensions.load(loader);

    await Promise.all([withRenderExtensions(Promise.resolve(1)), withRenderExtensions(Promise.resolve(2))]);
    await withRenderExtensions(Promise.resolve(3));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('rejects the boundary’s import when a loader fails, rather than drawing without it', async () => {
    const { renderExtensions, withRenderExtensions } = await fresh();
    renderExtensions.load(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));

    await expect(withRenderExtensions(Promise.resolve({ default: 'CampaignDesign' }))).rejects.toThrow('Failed to fetch');
  });

  it('is the chunk alone when nothing is registered, as on free', async () => {
    const { withRenderExtensions } = await fresh();
    await expect(withRenderExtensions(Promise.resolve('chunk'))).resolves.toBe('chunk');
  });
});

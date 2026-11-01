/**
 * What another bundle adds to the renderer, loaded only where a design is drawn.
 *
 * Pro's journey screens, its question and result leaves and its product
 * preview are registered INTO the renderer, which is itself behind every lazy
 * boundary that draws a design (ADR 0038). Calling those registrations from
 * Pro's entry put the renderer back in Pro's main file and on every Pro screen.
 * So the entry registers a loader here instead, and each boundary that draws a
 * design waits for every loader alongside its own chunk.
 *
 * - **Order.** Loaders are registered as the entry runs, before React mounts,
 *   so no boundary can start before they are all known.
 * - **Once.** Each loader runs the first time any boundary asks, and every
 *   later boundary shares its answer.
 * - **A failure** rejects the boundary's import, which is the boundary's
 *   reload message rather than a design drawn without what it needs.
 */
const loaders: Array<{ run: () => Promise<unknown>; done?: Promise<unknown> }> = [];

export const renderExtensions = {
  /** Called by another bundle's entry, before React mounts. */
  load(run: () => Promise<unknown>): void {
    loaders.push({ run });
  },
};

/** Resolves once every registered loader has finished. */
export function renderExtensionsReady(): Promise<void> {
  return Promise.all(loaders.map((loader) => (loader.done ??= loader.run()))).then(() => undefined);
}

/** A chunk that draws designs, ready only once the renderer's extensions are. */
export function withRenderExtensions<T>(chunk: Promise<T>): Promise<T> {
  return Promise.all([chunk, renderExtensionsReady()]).then(([module]) => module);
}

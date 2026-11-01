import { createElement, lazy, useEffect, type ComponentProps, type ComponentType, type LazyExoticComponent } from 'react';
import apiFetch, { type APIFetchMiddleware, type APIFetchOptions } from '@wordpress/api-fetch';

/**
 * What WConvert's admin has in flight, and the reads it can share (#395).
 *
 * One `apiFetch` middleware sees every request, which gives two things no call
 * site has to remember:
 *
 * - **When the screen has settled**, so a side widget (the header's bell) can
 *   wait its turn instead of queueing three reads ahead of the screen's own.
 * - **When anything changed.** Any non-GET but the few POSTs that only read
 *   ({@link READS_BY_POST}) forgets every shared read, so a publish, a delete
 *   or a saved destination is never followed by stale news.
 *
 * `apiFetch` here is WordPress's own `wp.apiFetch` (see `vite.admin-config.mjs`),
 * so another plugin's script on the page goes through it too. Only requests to
 * WConvert's namespace count.
 */

const NAMESPACE = '/wconvert/v1/';
/** How long nothing must be in flight before the screen counts as settled. */
const SETTLE_MS = 150;
/** How old a shared read may be and still serve a side widget. */
export const RECENT_MS = 30_000;

let inFlight = 0;
let lastSettled = 0;
/** Bumped by every change; a read that started before one is not remembered. */
let generation = 0;
const reads = new Set<{ forget(): void }>();
let installed = false;

/**
 * POSTs that only read: the lead log's query (its filters stay out of URLs),
 * the builder's previews and a template export. Anything else that is not a
 * GET counts as a change, which is the safe side to be wrong on.
 */
const READS_BY_POST = /\/wconvert\/v1\/(?:leads\/query|(?:[^?#]*\/)?[\w-]*preview|(?:[^?#]*\/)?export)(?:[?#]|$)/;

const target = (options: APIFetchOptions) => `${options.path ?? options.url ?? ''}`;
const ours = (options: APIFetchOptions) => target(options).includes(NAMESPACE);
const changes = (options: APIFetchOptions) =>
  (options.method ?? 'GET').toUpperCase() !== 'GET' && !READS_BY_POST.test(target(options));

function forgetAll() {
  generation += 1;
  for (const read of reads) read.forget();
}

const middleware: APIFetchMiddleware = (options, next) => {
  if (!ours(options)) return next(options);
  const change = changes(options);
  if (change) forgetAll();
  inFlight += 1;
  const settle = () => {
    settleOne();
    // Again on the way out: a read that started while this ran may hold the old state.
    if (change) forgetAll();
  };
  return next(options).then(
    (value) => { settle(); return value; },
    (cause: unknown) => { settle(); throw cause; },
  );
};

const settleOne = () => {
  inFlight -= 1;
  lastSettled = Date.now();
};

/**
 * Count `work` as in flight until it settles, as a request is. For the code a
 * screen downloads before it can ask for data: without it the bell saw nothing
 * in flight while the editor's chunk arrived, and went first. A failed download
 * still releases it, and {@link whenQuiet}'s cap still applies.
 */
export function track<T>(work: Promise<T>): Promise<T> {
  inFlight += 1;
  return work.finally(settleOne);
}

/** How long a downloaded screen that never mounts may still count as in flight. */
const MOUNT_MS = 1000;

/**
 * `React.lazy`, with the download counted as in flight until the screen has
 * mounted. Every lazily loaded screen goes through it.
 *
 * **Until it mounts, not until the file arrives.** React holds a suspended
 * screen back for up to 300 ms after its fallback appeared, so the file landing
 * left a gap with nothing in flight and none of the screen's reads started yet,
 * and the bell went first. A screen's reads start in its effects, which run
 * before the wrapper's, so releasing there hands over to them. A screen that
 * never mounts (the merchant moved on) is released after {@link MOUNT_MS}, and a
 * failed download at once.
 */
// `any` as React's own `lazy` has it: a component's props are whatever it takes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyScreen<T extends ComponentType<any>>(load: () => Promise<{ default: T }>): LazyExoticComponent<ComponentType<ComponentProps<T>>> {
  return lazy(() => {
    let mounted!: () => void;
    const shown = new Promise<void>((done) => { mounted = done; });
    const loaded = load();
    // In flight from the download to the mount, or MOUNT_MS after the file
    // lands if it never mounts; a failed download releases at once. Its
    // failure is the boundary's to report, not this count's.
    void track(loaded.then(() => Promise.race([shown, new Promise<void>((done) => { setTimeout(done, MOUNT_MS); })])))
      .catch(() => undefined);
    return loaded.then(({ default: Loaded }) => {
      function Mounted(props: ComponentProps<T>) {
        useEffect(mounted, []);
        return createElement(Loaded, props);
      }
      return { default: Mounted };
    });
  });
}

/** Install the middleware, once. A test's `apiFetch` mock without `.use` is left alone. */
export function installRequestActivity() {
  if (installed || typeof apiFetch.use !== 'function') return;
  installed = true;
  apiFetch.use(middleware);
}

/**
 * Resolves once no WConvert request has been in flight for {@link SETTLE_MS},
 * or after `maxMs` whatever is still running.
 */
export function whenQuiet(maxMs = 3000): Promise<void> {
  installRequestActivity();
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const now = Date.now();
      if (now - started >= maxMs || (inFlight === 0 && now - Math.max(lastSettled, started) >= SETTLE_MS)) {
        resolve();
        return;
      }
      setTimeout(check, 50);
    };
    setTimeout(check, SETTLE_MS);
  });
}

export interface SharedRead<T> {
  /**
   * A new read. Identical calls in flight together share one, but never a side
   * widget's: a Try again pressed while the bell is reading must not be handed
   * the bell's answer, which was asked before whatever the retry is about.
   */
  (): Promise<T>;
  /** A result younger than `maxMs`, else a read. For side widgets, never for a screen's own data. */
  recent(maxMs?: number): Promise<T>;
  /** The remembered result if younger than `maxMs`, without reading. */
  remembered(maxMs?: number): T | undefined;
}

/** One read that callers share: concurrent calls coalesce, a success is remembered until a change. */
export function sharedRead<T>(read: () => Promise<T>): SharedRead<T> {
  installRequestActivity();
  let pending: { request: Promise<T>; side: boolean } | null = null;
  let held: { value: T; at: number } | null = null;
  /** The newest request started; only its answer is remembered. */
  let latest = 0;
  const state = { forget() { pending = null; held = null; } };
  reads.add(state);

  const start = (side: boolean): Promise<T> => {
    const started = generation;
    const id = ++latest;
    const request = read().then((value) => {
      if (generation === started && id === latest) held = { value, at: Date.now() };
      return value;
    }).finally(() => {
      if (pending?.request === request) pending = null;
    });
    pending = { request, side };
    return request;
  };
  const fresh = (): Promise<T> => (pending && !pending.side ? pending.request : start(false));
  const remembered = (maxMs = RECENT_MS) => (held && Date.now() - held.at < maxMs ? held.value : undefined);
  return Object.assign(fresh, {
    remembered,
    recent: (maxMs = RECENT_MS) => {
      const value = remembered(maxMs);
      if (value !== undefined) return Promise.resolve(value);
      return pending ? pending.request : start(true);
    },
  });
}

/** For tests: forget every shared read and what is in flight. */
export function resetRequestActivity() {
  forgetAll();
  inFlight = 0;
  lastSettled = 0;
}

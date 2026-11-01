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
const READS_BY_POST = /\/wconvert\/v1\/(?:leads\/query|.*preview|.*\/export)(?:[?#]|$)/;

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
    inFlight -= 1;
    lastSettled = Date.now();
    // Again on the way out: a read that started while this ran may hold the old state.
    if (change) forgetAll();
  };
  return next(options).then(
    (value) => { settle(); return value; },
    (cause: unknown) => { settle(); throw cause; },
  );
};

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
  /** Always a new read, except that identical calls in flight together share one. */
  (): Promise<T>;
  /** A result younger than `maxMs`, else a read. For side widgets, never for a screen's own data. */
  recent(maxMs?: number): Promise<T>;
  /** The remembered result if younger than `maxMs`, without reading. */
  remembered(maxMs?: number): T | undefined;
}

/** One read that callers share: concurrent calls coalesce, a success is remembered until a change. */
export function sharedRead<T>(read: () => Promise<T>): SharedRead<T> {
  installRequestActivity();
  let pending: Promise<T> | null = null;
  let held: { value: T; at: number } | null = null;
  const state = { forget() { pending = null; held = null; } };
  reads.add(state);

  const fresh = (): Promise<T> => {
    if (pending) return pending;
    const started = generation;
    const request = read().then((value) => {
      if (generation === started) held = { value, at: Date.now() };
      return value;
    }).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
    return request;
  };
  const remembered = (maxMs = RECENT_MS) => (held && Date.now() - held.at < maxMs ? held.value : undefined);
  return Object.assign(fresh, {
    remembered,
    recent: (maxMs = RECENT_MS) => {
      const value = remembered(maxMs);
      return value === undefined ? fresh() : Promise.resolve(value);
    },
  });
}

/** For tests: forget every shared read and what is in flight. */
export function resetRequestActivity() {
  forgetAll();
  inFlight = 0;
  lastSettled = 0;
}

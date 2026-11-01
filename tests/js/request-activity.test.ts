import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The admin's request log (#395): when the screen has settled, and which reads
 * can be shared. Driven through a fake `apiFetch` that runs middleware the way
 * WordPress's does, because the middleware is the whole mechanism.
 */
type Options = { path?: string; url?: string; method?: string };
type Next = (options: Options) => Promise<unknown>;
const fake = vi.hoisted(() => {
  const middlewares: Array<(options: Options, next: Next) => Promise<unknown>> = [];
  const handler = vi.fn<(options: Options) => Promise<unknown>>();
  const run = (index: number, options: Options): Promise<unknown> =>
    index < middlewares.length ? middlewares[index](options, (next) => run(index + 1, next)) : handler(options);
  const apiFetch = Object.assign((options: Options) => run(0, options), {
    use: vi.fn((middleware: (options: Options, next: Next) => Promise<unknown>) => { middlewares.push(middleware); }),
  });
  return { apiFetch, handler };
});
vi.mock('@wordpress/api-fetch', () => ({ default: fake.apiFetch }));
const { installRequestActivity, resetRequestActivity, sharedRead, whenQuiet } = await import('../../resources/admin/src/lib/requestActivity');

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Whether a promise has settled, without waiting for it. */
async function settled(promise: Promise<unknown>) {
  let done = false;
  void promise.then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(0);
  return done;
}

const OPTINS = '/wconvert/v1/optins';
const readOptins = () => fake.apiFetch({ path: OPTINS });

beforeEach(() => {
  vi.useFakeTimers();
  fake.handler.mockReset();
  fake.handler.mockResolvedValue([]);
  resetRequestActivity();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('whenQuiet', () => {
  it('waits for the reads in flight, then a moment more', async () => {
    installRequestActivity();
    const screen = deferred();
    fake.handler.mockReturnValueOnce(screen.promise);
    void readOptins();
    const quiet = whenQuiet();

    await vi.advanceTimersByTimeAsync(1000);
    expect(await settled(quiet)).toBe(false);
    screen.resolve([]);
    await vi.advanceTimersByTimeAsync(50);
    expect(await settled(quiet)).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(quiet)).toBe(true);
  });

  it('gives up at the cap while a read is still running', async () => {
    installRequestActivity();
    fake.handler.mockReturnValueOnce(new Promise(() => {}));
    void readOptins();
    const quiet = whenQuiet(3000);

    await vi.advanceTimersByTimeAsync(2900);
    expect(await settled(quiet)).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(quiet)).toBe(true);
  });

  it('does not wait on another plugin’s request through the same apiFetch', async () => {
    installRequestActivity();
    fake.handler.mockReturnValueOnce(new Promise(() => {}));
    void fake.apiFetch({ path: '/wp/v2/posts' });
    const quiet = whenQuiet();

    await vi.advanceTimersByTimeAsync(250);
    expect(await settled(quiet)).toBe(true);
  });
});

describe('sharedRead', () => {
  it('makes one request for identical reads at the same time', async () => {
    const read = sharedRead(readOptins);
    const [a, b] = await Promise.all([read(), read()]);

    expect(fake.handler).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('reads again for a screen, and serves a side widget from memory', async () => {
    const read = sharedRead(readOptins);
    await read();
    await read.recent();
    expect(fake.handler).toHaveBeenCalledTimes(1);

    await read();
    expect(fake.handler).toHaveBeenCalledTimes(2);
  });

  it('forgets a remembered read after 30 s', async () => {
    const read = sharedRead(readOptins);
    await read();
    await vi.advanceTimersByTimeAsync(29_000);
    await read.recent();
    expect(fake.handler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    await read.recent();
    expect(fake.handler).toHaveBeenCalledTimes(2);
  });

  it('forgets every shared read when anything changes', async () => {
    const read = sharedRead(readOptins);
    await read();
    await fake.apiFetch({ path: `${OPTINS}/01JQ00000000000000000000AA/publish`, method: 'POST' });
    await read.recent();

    expect(fake.handler).toHaveBeenCalledTimes(3);
  });

  it('keeps shared reads through a POST that only reads', async () => {
    const read = sharedRead(readOptins);
    await read();
    await fake.apiFetch({ path: '/wconvert/v1/leads/query', method: 'POST' });
    await fake.apiFetch({ path: `${OPTINS}/01JQ00000000000000000000AA/draft-preview`, method: 'POST' });
    await read.recent();

    expect(fake.handler).toHaveBeenCalledTimes(3);
  });

  it('still forgets on a write whose path only mentions a preview or an export', async () => {
    const read = sharedRead(readOptins);
    await read();
    await fake.apiFetch({ path: '/wconvert/v1/export/apply', method: 'POST' });
    await read.recent();
    await fake.apiFetch({ path: '/wconvert/v1/connections?preview=1', method: 'POST' });
    await read.recent();

    expect(fake.handler).toHaveBeenCalledTimes(5);
  });

  it('does not remember a read that was running while something changed', async () => {
    const read = sharedRead(readOptins);
    const before = deferred();
    fake.handler.mockReturnValueOnce(before.promise);
    const stale = read();
    await fake.apiFetch({ path: `${OPTINS}/01JQ00000000000000000000AA`, method: 'DELETE' });
    before.resolve(['old']);
    await stale;
    await read.recent();

    expect(fake.handler).toHaveBeenCalledTimes(3);
  });

  it('does not remember a failed read', async () => {
    const read = sharedRead(readOptins);
    fake.handler.mockRejectedValueOnce(new Error('Offline'));
    await expect(read()).rejects.toThrow('Offline');
    await read.recent();

    expect(fake.handler).toHaveBeenCalledTimes(2);
  });
});

it('installs its middleware once', () => {
  installRequestActivity();
  installRequestActivity();
  sharedRead(readOptins);
  void whenQuiet();

  expect(fake.apiFetch.use).toHaveBeenCalledTimes(1);
});

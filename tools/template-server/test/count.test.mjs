import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker from '../dist/index.js';
import { catalogue } from './fixtures.mjs';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const H = 'c'.repeat(64);
/** The bundled Worker with recording bindings: one log shows the order of every call. */
function recorder({ downloads = true, throws = false } = {}) {
  const log = [];
  const bucket = name => ({ get: async key => { log.push(`${name}:${key}`); return null; } });
  const limiter = name => ({ limit: async () => { log.push(`limit:${name}`); return { success: true }; } });
  const env = { ...config.vars, NEXUS_SERVICE_KEY: 'k', PUBLIC_TEMPLATES: bucket('public'), PRIVATE_TEMPLATES: bucket('private'),
    GRANT_RATE_LIMITER: limiter('grant'), GRANT_IP_RATE_LIMITER: limiter('grant-ip'), DOWNLOAD_RATE_LIMITER: limiter('download'), DOWNLOAD_IP_RATE_LIMITER: limiter('download-ip'),
    ...(downloads ? { DOWNLOADS: { writeDataPoint: point => { if (throws) throw Error('dataset unavailable'); log.push(['point', point]); } } } : {}) };
  const fetch = (path, { method = 'GET', agent = 'WConvert template catalog', headers = {} } = {}) =>
    worker.fetch(new Request('https://templates.wconvert.io' + path, { method, headers: { ...(agent ? { 'User-Agent': agent } : {}), ...headers } }), env);
  return { log, fetch, points: () => log.filter(entry => Array.isArray(entry)).map(entry => entry[1]) };
}

test('a plugin design GET is counted first, before any storage, cache or grant lookup', async () => {
  const free = recorder();
  assert.equal((await free.fetch(`/v3/designs/${H}.json`)).status, 404);
  assert.deepEqual(free.log, [['point', { blobs: [H, 'free'], doubles: [1], indexes: [H] }], `public:v3/designs/${H}.json`]);
  const premium = recorder();
  await premium.fetch(`/v3/premium/designs/${H}.json`, { agent: 'WConvert template downloads', headers: { Authorization: 'Bearer a.b.c', 'CF-Connecting-IP': '192.0.2.7' } });
  assert.deepEqual(premium.log.slice(0, 3), [['point', { blobs: [H, 'premium'], doubles: [1], indexes: [H] }], 'limit:download-ip', 'limit:download']);
  assert(premium.log.slice(3).some(entry => String(entry).startsWith('private:grants/')), 'the grant lookup follows the count');
  // Only the digest and tier: nothing that names a site, a licence or a pass.
  assert.doesNotMatch(JSON.stringify(premium.points()), /a\.b\.c|templates\.wconvert\.io|192\.0\.2/);
});

test('nothing is counted for other agents, other methods or other paths', async () => {
  for (const [path, options] of [
    [`/v3/designs/${H}.json`, { agent: 'Mozilla/5.0' }], [`/v3/designs/${H}.json`, { agent: null }],
    [`/v3/designs/${H}.json`, { agent: 'wconvert template catalog' }], [`/v3/designs/${H}.json`, { agent: 'Not WConvert template catalog' }],
    [`/v3/designs/${H}.json`, { method: 'HEAD' }], [`/v3/designs/${H}.json?x=1`, {}],
    [`/v3/setups/${H}.json`, {}], [`/v3/premium/setups/${H}.json`, {}], [`/v3/assets/${H}.png`, {}], [`/v3/premium/assets/${H}.png`, {}],
    ['/v3/manifest.json', {}], [`/v3/index/${H}.json`, {}], [`/v3/thumbs/${H}.webp`, {}], [`/packs/${H}.json`, {}], [`/v3/designs/${H}.html`, {}],
  ]) {
    const { points, fetch } = recorder();
    await fetch(path, options);
    assert.deepEqual(points(), [], `${options.method ?? 'GET'} ${path} ${options.agent}`);
  }
});

test('a missing or failing dataset never breaks the response', async () => {
  for (const options of [{ downloads: false }, { throws: true }]) {
    const { fetch, log } = recorder(options);
    const response = await fetch(`/v3/designs/${H}.json`);
    assert.equal(response.status, 404); assert.deepEqual(log, [`public:v3/designs/${H}.json`]);
  }
});

test('actual runtime: the bound dataset accepts the point and the download still succeeds', async t => {
  const library = catalogue();
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
    compatibilityDate: '2026-10-01', r2Buckets: ['PUBLIC_TEMPLATES'], analyticsEngineDatasets: { DOWNLOADS: { dataset: 'wconvert_design_downloads' } } }));
  t.after(() => mf.dispose());
  const bucket = await mf.getR2Bucket('PUBLIC_TEMPLATES');
  for (const [key, bytes] of library.public) await bucket.put(key, bytes);
  const design = library.objects['reading-slip'];
  const response = await mf.dispatchFetch(`https://templates.wconvert.io/v3/designs/${design.sha256}.json`, { headers: { 'User-Agent': 'WConvert template catalog' } });
  assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), design.bytes);
});

test('wrangler binds the dataset', () => {
  assert.deepEqual(config.analytics_engine_datasets, [{ binding: 'DOWNLOADS', dataset: 'wconvert_design_downloads' }]);
});

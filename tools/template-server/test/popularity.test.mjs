import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryDownloads, liveIndex, popularity, query } from '../scripts/popularity.mjs';
import { validatePopularity } from '../scripts/storage.mjs';
import { catalogue } from './fixtures.mjs';

const library = catalogue({ designs: [{ id: 'reading-slip' }, { id: 'night-owl', tier: 'pro', images: ['premium'] }] });
const sha = id => library.objects[id].sha256;

test('the SQL API is asked for 90 days of sampled downloads per digest', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ meta: [], data: [{ sha: sha('reading-slip'), downloads: '120' }, { sha: sha('night-owl'), downloads: 3 }], rows: 2 });
  };
  const downloads = await queryDownloads({ account: 'a'.repeat(32), dataset: 'wconvert_design_downloads', token: 'secret', fetcher });
  assert.deepEqual([...downloads], [[sha('reading-slip'), 120], [sha('night-owl'), 3]]);
  assert.equal(calls[0].url, `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/analytics_engine/sql`);
  assert.equal(calls[0].options.body, "SELECT blob1 AS sha, SUM(_sample_interval) AS downloads FROM wconvert_design_downloads WHERE timestamp > NOW() - INTERVAL '90' DAY GROUP BY sha");
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
  assert.throws(() => query('downloads; DROP'), /dataset/);
  await assert.rejects(queryDownloads({ account: 'a'.repeat(32), dataset: 'd', token: 'secret', fetcher: async () => new Response('token secret leaked', { status: 403 }) }),
    error => /HTTP 403/.test(error.message) && !error.message.includes('secret'));
  await assert.rejects(queryDownloads({ account: 'a'.repeat(32), dataset: 'd', token: 't', fetcher: async () => Response.json({ data: [{ sha: 'x', downloads: 1 }] }) }), /invalid row/);
});

test('digests map to ids through the live index; unknown digests are counted, not guessed', async () => {
  const files = new Map([['/v3/manifest.json', library.pointer], ...[...library.public].map(([key, bytes]) => ['/' + key, bytes])]);
  const fetcher = async url => {
    const bytes = files.get(url.pathname);
    return new Response(bytes ?? 'missing', { status: bytes ? 200 : 404 });
  };
  const { release, ids } = await liveIndex('https://templates.example', fetcher);
  assert.equal(release, library.id); assert.equal(ids.get(sha('night-owl')), 'night-owl');
  const result = popularity(new Map([[sha('reading-slip'), 120], [sha('night-owl'), 3], ['f'.repeat(64), 9]]), ids, '2026-10-20');
  assert.deepEqual(JSON.parse(result.bytes), { schema: 3, generated: '2026-10-20', downloads: { 'night-owl': 3, 'reading-slip': 120 } });
  assert.equal(result.unmapped, 9); assert.equal(result.designs, 2);
  validatePopularity(result.bytes);
  files.set(`/v3/index/${library.page}.json`, Buffer.from('changed'));
  await assert.rejects(liveIndex('https://templates.example', fetcher), /Could not read/);
});

import { parseArgs } from 'node:util';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { cloudTarget, loadCredentials } from './cloud-config.mjs';
import { hash, validatePointer, validatePopularity, POINTER } from './storage.mjs';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const query = dataset => {
  if (!/^[a-z0-9_]{1,64}$/.test(dataset)) throw Error('Invalid Analytics Engine dataset name');
  return `SELECT blob1 AS sha, SUM(_sample_interval) AS downloads FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '90' DAY GROUP BY sha`;
};

/** Downloads per design-object digest over 90 days. `_sample_interval` undoes Analytics Engine sampling. */
export async function queryDownloads({ account, dataset, token, fetcher = fetch }) {
  if (!/^[a-f0-9]{32}$/.test(account) || !token) throw Error('Missing Analytics Engine account or token');
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: query(dataset), redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  // Never echo the provider body: it can repeat request details.
  if (!response.ok) throw Error(`Analytics Engine query failed (HTTP ${response.status}); no token or response was logged`);
  const rows = (await response.json())?.data;
  if (!Array.isArray(rows)) throw Error('Analytics Engine returned no rows array');
  const downloads = new Map();
  for (const row of rows) {
    // 64-bit sums arrive as JSON strings.
    const count = Number(row?.downloads);
    if (!digest(row?.sha) || !Number.isSafeInteger(count) || count < 0) throw Error('Analytics Engine returned an invalid row');
    downloads.set(row.sha, count);
  }
  return downloads;
}

/** Design-object digest → design id, from the live pointer's release pages, verified by hash. */
export async function liveIndex(origin, fetcher = fetch) {
  const read = async (path, limit, sha) => {
    const response = await fetcher(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'WConvert operator popularity' } });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.status !== 200 || bytes.length > limit || (sha && hash(bytes) !== sha)) throw Error(`Could not read ${path} from the live service`);
    return bytes;
  };
  const { release } = validatePointer(await read('/' + POINTER, 65536));
  const { pages } = JSON.parse(await read(`/v3/releases/${release}.json`, 262144, release));
  if (!Array.isArray(pages) || pages.length > 16 || !pages.every(digest)) throw Error('Invalid live release');
  const ids = new Map();
  for (const sha of pages) for (const entry of JSON.parse(await read(`/v3/index/${sha}.json`, 262144, sha)).designs ?? []) ids.set(entry.sha256, entry.id);
  return { release, ids };
}

/** Sum downloads per design id; revisions of one design add up. Digests the live index does not list are reported, not guessed. */
export function popularity(downloads, ids, generated = new Date().toISOString().slice(0, 10)) {
  const counts = {}; let unmapped = 0;
  for (const [sha, count] of downloads) {
    const id = ids.get(sha);
    if (id) counts[id] = (counts[id] ?? 0) + count; else unmapped += count;
  }
  const sidecar = { schema: 3, generated, downloads: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) };
  const bytes = Buffer.from(JSON.stringify(sidecar, null, 2) + '\n');
  validatePopularity(bytes);
  return { bytes, designs: Object.keys(counts).length, unmapped };
}

async function main() {
  const { values } = parseArgs({ options: { credentials: { type: 'string' }, output: { type: 'string' }, env: { type: 'string' } } });
  if (!values.output || !isAbsolute(values.output)) throw Error('Supply --output /absolute/new-popularity.json');
  loadCredentials(values.credentials);
  const target = cloudTarget(undefined, values.env);
  const downloads = await queryDownloads({ account: target.account, dataset: target.dataset, token: process.env.WCONVERT_ANALYTICS_API_TOKEN });
  const { release, ids } = await liveIndex(target.origin);
  const result = popularity(downloads, ids);
  writeFileSync(values.output, result.bytes, { flag: 'wx', mode: 0o644 });
  console.log(JSON.stringify({ environment: target.environment, dataset: target.dataset, release, output: values.output, sha256: hash(result.bytes),
    digests: downloads.size, designs: result.designs, unmappedDownloads: result.unmapped,
    next: `npm run publish -- --expected ${release} --popularity ${values.output} --apply --credentials …` }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

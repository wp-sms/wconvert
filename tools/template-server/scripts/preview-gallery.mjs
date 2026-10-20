import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readPublicRelease, promote } from './storage.mjs';

// Public storage only: the website never reads premium objects.
const directory = process.argv[2];
if (!directory) throw Error('Supply a local release directory');
const release = await readPublicRelease(directory);
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url)));
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: config.compatibility_date, host: '127.0.0.1', port: 9464,
  r2Buckets: ['PUBLIC_TEMPLATES'], bindings: { PREVIEW_EMBED_ORIGINS: config.vars.PREVIEW_EMBED_ORIGINS },
}));
try {
  await promote(await mf.getR2Bucket('PUBLIC_TEMPLATES'), release, null);
  const base = (await mf.ready).origin, closure = release.closures.get(release.id);
  console.log(JSON.stringify({
    localOnly: true, pointer: `${base}/v3/manifest.json`, release: `${base}/v3/releases/${release.id}.json`,
    examples: ['free', 'premium'].map(tier => {
      const detail = closure.details.find(detail => detail.preview && (closure.designs.get(detail.id)?.tier === 'free') === (tier === 'free'));
      return detail ? { tier, id: detail.id, preview: `${base}/v3/previews/${detail.preview}.html`, ...(detail.og ? { og: `${base}/v3/og/${detail.og}.jpg` } : {}) } : { tier, unavailable: true };
    }),
  }, null, 2));
  await new Promise(done => { process.once('SIGINT', done); process.once('SIGTERM', done); });
} finally { await mf.dispose(); }

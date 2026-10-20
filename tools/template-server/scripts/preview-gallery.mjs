import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readPublicRelease, promote } from './storage.mjs';

const directory = process.argv[2];
if (!directory) throw Error('Supply a local release directory');
const release = readPublicRelease(directory);
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url)));
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: config.compatibility_date, host: '127.0.0.1', port: 9464,
  r2Buckets: ['PUBLIC_TEMPLATES'], bindings: { PREVIEW_EMBED_ORIGINS: config.vars.PREVIEW_EMBED_ORIGINS },
}));
try {
  await promote(await mf.getR2Bucket('PUBLIC_TEMPLATES'), release, null);
  const base = (await mf.ready).origin;
  const catalogue = JSON.parse(release.objects.get(`releases/${release.id}/designs.json`));
  console.log(JSON.stringify({
    localOnly: true, catalogue: `${base}/releases/${release.id}/designs.json`,
    examples: ['free', 'pro'].map(tier => {
      const design = catalogue.designs.find(design => design.availability === tier && design.embed_url);
      return design ? { tier, id: design.id, url: base + new URL(design.embed_url).pathname } : { tier, unavailable: true };
    }),
  }, null, 2));
  await new Promise(done => { process.once('SIGINT', done); process.once('SIGTERM', done); });
} finally { await mf.dispose(); }

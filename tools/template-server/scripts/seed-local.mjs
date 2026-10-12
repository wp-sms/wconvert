import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { readPublicRelease, promote } from './storage.mjs';
const [directory, expected, retainedRelease] = process.argv.slice(2);
if (!directory || !expected || ![4, 5].includes(process.argv.length)) throw Error('Usage: npm run seed -- /absolute/release-directory none|expected-release [retained-release]');
const release = readPublicRelease(directory, retainedRelease);
// No remote flag, credentials, environment selection or network upload path.
const proxy = await getPlatformProxy({ configPath: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)) });
try { console.log(JSON.stringify({ ...await promote(proxy.env.PUBLIC_TEMPLATES, release, expected === 'none' ? null : expected), localOnly: true, metadataOrigin: release.origin, mirror: 'http://127.0.0.1:9454', premiumDownloads: 'disabled' }, null, 2)); }
finally { await proxy.dispose(); }

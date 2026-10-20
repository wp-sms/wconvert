import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { readPublicRelease, readPrivateRelease, stagePrivate, promote } from './storage.mjs';
const [directory, expected, retainedRelease] = process.argv.slice(2);
if (!directory || !expected || ![4, 5].includes(process.argv.length)) throw Error('Usage: npm run seed -- /absolute/release-directory none|expected-release [retained-release]');
const release = await readPublicRelease(directory, retainedRelease);
const privateObjects = await readPrivateRelease(directory, release);
// No remote flag, credentials, environment selection or network upload path.
const proxy = await getPlatformProxy({ configPath: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)) });
try { await stagePrivate(proxy.env.PRIVATE_TEMPLATES, privateObjects); console.log(JSON.stringify({ ...await promote(proxy.env.PUBLIC_TEMPLATES, release, expected === 'none' ? null : expected), localOnly: true, mirror: 'http://127.0.0.1:9454/v3/manifest.json', premiumDownloads: 'requires Nexus configuration', privateObjects: privateObjects.size }, null, 2)); }
finally { await proxy.dispose(); }

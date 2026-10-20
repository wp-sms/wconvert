import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { R2Storage, r2Client } from '../scripts/r2-storage.mjs';
import { publishRemote, currentRelease, currentPointer, parseWithdrawal, parseReinstatement, main } from '../scripts/publish-remote.mjs';
import { cloudTarget } from '../scripts/cloud-config.mjs';
import { hash } from '../scripts/storage.mjs';
import { catalogue, release, privateObjects as privately, writeDirectory, json } from './fixtures.mjs';

const free = { id: 'reading-slip' }, pro = { id: 'night-owl', tier: 'pro', images: ['premium', 'free'] };
const A = catalogue({ designs: [free, pro], label: 'a' }), B = catalogue({ designs: [free, pro, { id: 'third-design' }], label: 'b' }), C = catalogue({ designs: [free, pro, { id: 'fourth-design' }], label: 'c' });
const first = A.id, second = B.id, third = C.id;
const privateObjects = privately(A);
const releases = { [first]: A, [second]: B, [third]: C };
const fresh = id => release(releases[id]);
const pointerOf = async f => JSON.parse(f.objects.get('templates-public/v3/manifest.json').bytes);

/** Exercise the real AWS SDK's signed requests/conditional headers over HTTP. */
async function fixture(t) {
 const objects=new Map(), requests=[];let failKey, corruptKey, dropKey;
 const server=createServer(async(req,res)=>{
  const key=new URL(req.url,'http://localhost').pathname.slice(1);requests.push({method:req.method,key});
  const failure=(status,code)=>{res.writeHead(status,{'Content-Type':'application/xml'});res.end(`<Error><Code>${code}</Code><Message>provider-secret-must-not-leak</Message></Error>`);};
  if(!req.headers.authorization?.startsWith('AWS4-HMAC-SHA256 '))return failure(403,'AccessDenied');
  if(key===failKey)return failure(503,'ServiceUnavailable');
  const old=objects.get(key);
  if(req.method==='GET') {
   if(!old)return failure(404,'NoSuchKey');
   const data=key===corruptKey?Buffer.from('corrupt'):old.bytes;
   res.writeHead(200,{'Content-Length':data.length,ETag:`"${old.etag}"`});res.end(data);return;
  }
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);
  if(req.headers['x-amz-checksum-sha256']!==Buffer.from(hash(bytes),'hex').toString('base64'))return failure(400,'BadDigest');
  if(!req.headers['if-match']&&!req.headers['if-none-match'])return failure(400,'MissingCondition');
  if((req.headers['if-none-match']==='*'&&old)||(req.headers['if-match']&&req.headers['if-match']!==`"${old?.etag}"`))return failure(412,'PreconditionFailed');
  const etag=createHash('md5').update(bytes).digest('hex');objects.set(key,{bytes,etag});
  if(key===dropKey){req.socket.destroy();return;}
  res.writeHead(200,{ETag:`"${etag}"`});res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const client=new S3Client({region:'auto',endpoint:`http://127.0.0.1:${server.address().port}`,forcePathStyle:true,credentials:{accessKeyId:'fixture',secretAccessKey:'fixture-secret'},maxAttempts:1,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
 t.after(async()=>{client.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 return {objects,requests,publicBucket:new R2Storage(client,'templates-public','public'),privateBucket:new R2Storage(client,'templates-private','private'),fail:key=>failKey=key,corrupt:key=>corruptKey=key,drop:key=>dropKey=key};
}

test('S3 wire contract: initial publication, unchanged retry, update and retained rollback', async t => {
 const f = await fixture(t);
 const one = await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null); assert.equal(one.created, A.public.size);
 const writes = f.requests.filter(r => r.method === 'PUT'); assert.match(writes[0].key, /^templates-private\/v3\//); assert.equal(writes.at(-1).key, 'templates-public/v3/manifest.json');
 assert.equal((await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, first)).created, 0);
 assert.equal((await publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first)).created, [...B.public.keys()].filter(key => !A.public.has(key)).length);
 // Rolling back drops third-design, which is live: refused until withdrawn.
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, second), /would drop live designs: third-design\./);
 const back = await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, second, { withdraw: [{ id: 'third-design', reason: 'broken' }] });
 assert.equal(back.created, 0); assert.equal(await currentRelease(f.publicBucket), first);
 assert.deepEqual((await pointerOf(f)).withdrawn, [{ id: 'third-design', reason: 'broken' }]);
 assert(f.objects.has(`templates-public/v3/releases/${second}.json`), 'the newer release stays for a later roll forward');
 for (const key of A.private.keys()) assert(!f.objects.has(`templates-public/${key}`) && f.objects.has(`templates-private/${key}`));
});

test('S3 concurrent publishers cannot both change the same pointer', async t => {
 const f = await fixture(t); await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 const outcomes = await Promise.allSettled([publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first), publishRemote(f.publicBucket, f.privateBucket, fresh(third), privateObjects, first)]);
 assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
 assert([second, third].includes(await currentRelease(f.publicBucket)));
});

test('stale expected release refuses before any private or public upload', async t => {
 const f = await fixture(t); await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 const before = f.requests.length; await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, null), /Current release changed/);
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, { objects: new Map() }, new Map(), second, { withdraw: [{ id: 'reading-slip', reason: 'rights' }] }), /Current release changed/);
 assert(f.requests.slice(before).every(r => r.method === 'GET'));
});

test('interrupted dependency uploads preserve the catalogue and can be resumed', async t => {
 const f = await fixture(t); await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 f.fail(`templates-public/v3/releases/${second}.json`);
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first), e => !e.message.includes('provider-secret'));
 assert.equal(await currentRelease(f.publicBucket), first);
 f.fail(undefined); await publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first); assert.equal(await currentRelease(f.publicBucket), second);
});

test('private upload failure never exposes a catalogue needing missing premium files', async t => {
 const f = await fixture(t); f.fail(`templates-private/v3/designs/${A.objects['night-owl'].sha256}.json`);
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null), /R2 read failed/);
 assert.equal(await currentRelease(f.publicBucket), null);
});

test('changed existing immutable bytes block promotion', async t => {
 const f = await fixture(t); await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 f.corrupt(`templates-public/v3/designs/${A.objects['reading-slip'].sha256}.json`);
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first), /Immutable object changed/);
 assert.equal(await currentRelease(f.publicBucket), first);
});

test('corrupt first read-back after a successful public PUT preserves the old pointer', async t => {
 const f = await fixture(t); await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 const key = `templates-public/v3/releases/${second}.json`;
 f.corrupt(key);
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first), /Read-back failed/);
 assert(f.objects.has(key), 'The PUT must have completed before the corrupt read-back');
 assert.equal(f.requests.filter(r => r.method === 'PUT' && r.key === key).length, 1);
 assert.equal(await currentRelease(f.publicBucket), first);
});

test('corrupt first read-back after a successful private PUT preserves the old pointer', async t => {
 const f = await fixture(t); await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 const updated = json({ schema: 3, id: 'night-owl', revision: 2, tier: 'pro', assets: [] });
 const path = `v3/designs/${hash(updated)}.json`, key = `templates-private/${path}`;
 f.corrupt(key);
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(second), new Map([[path, updated]]), first), /Private read-back failed/);
 assert(f.objects.has(key), 'The private PUT must have completed before the corrupt read-back');
 assert(!f.objects.has(`templates-public/v3/releases/${second}.json`));
 assert.equal(await currentRelease(f.publicBucket), first);
});

test('lost promotion response is reported as uncertain, never blindly retried', async t => {
 const f = await fixture(t); f.drop('templates-public/v3/manifest.json');
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null), /write may have completed/);
 assert.equal(f.requests.filter(r => r.method === 'PUT' && r.key === 'templates-public/v3/manifest.json').length, 1);
 assert.equal(await currentRelease(f.publicBucket), first);
 f.drop(undefined); await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, first);
});

test('bounded reads, missing bucket/access errors and scope restrictions fail closed', async () => {
 for (const name of ['NoSuchBucket', 'AccessDenied']) {
  const bucket = new R2Storage({ send: async () => { throw Object.assign(Error('SECRET'), { name, $metadata: { httpStatusCode: name === 'NoSuchBucket' ? 404 : 403 } }); } }, 'templates-public', 'public');
  await assert.rejects(bucket.get('v3/manifest.json'), e => e.message.includes('R2 read failed') && !e.message.includes('SECRET'));
 }
 for (const result of [{ ContentLength: 99999999, Body: Readable.from(['x']) }, { ContentLength: 1, Body: Readable.from([Buffer.alloc(65537)]) }]) {
  const bucket = new R2Storage({ send: async () => ({ ...result, ETag: '"abc"' }) }, 'templates-public', 'public'); await assert.rejects(bucket.get('v3/manifest.json'), /R2 read failed/);
 }
 const bucket = new R2Storage({ send: () => { throw Error('must not send'); } }, 'templates-private', 'private');
 for (const key of [`grants/${first}.json`, `packs/${first}.json`, 'v3/manifest.json', `v3/thumbs/${first}.webp`]) await assert.rejects(bucket.get(key), /outside/, key);
 const pub = new R2Storage({ send: () => { throw Error('must not send'); } }, 'templates-public', 'public');
 for (const key of ['manifest.json', `packs/${first}.json`, `assets/premium/${first}.png`, `v3/premium/designs/${first}.json`]) await assert.rejects(pub.get(key), /outside/, key);
 await assert.rejects(bucket.put(`v3/designs/${first}.json`, Buffer.from('{}'), {}), /Invalid upload/);
 assert.throws(() => r2Client('a'.repeat(32), {}), /Missing R2/);
});

test('cloud target: production, an explicit staging environment, and no shared buckets', () => {
 const buckets = suffix => [{ binding: 'PUBLIC_TEMPLATES', bucket_name: `templates-public${suffix}` }, { binding: 'PRIVATE_TEMPLATES', bucket_name: `templates-private${suffix}` }];
 const staging = { routes: [{ pattern: 'staging.templates.example', custom_domain: true }], r2_buckets: buckets('-staging'), analytics_engine_datasets: [{ binding: 'DOWNLOADS', dataset: 'downloads_staging' }] };
 const config = { account_id: 'a'.repeat(32), routes: [{ pattern: 'templates.example', custom_domain: true }], r2_buckets: buckets(''),
  analytics_engine_datasets: [{ binding: 'DOWNLOADS', dataset: 'downloads' }], workers_dev: false, preview_urls: false, env: { staging } };
 assert.deepEqual(cloudTarget(config), { environment: 'production', account: 'a'.repeat(32), origin: 'https://templates.example', publicBucket: 'templates-public', privateBucket: 'templates-private', dataset: 'downloads' });
 assert.deepEqual(cloudTarget(config, 'staging'), { environment: 'staging', account: 'a'.repeat(32), origin: 'https://staging.templates.example', publicBucket: 'templates-public-staging', privateBucket: 'templates-private-staging', dataset: 'downloads_staging' });
 assert.throws(() => cloudTarget(config, 'production'), /--env staging/);
 assert.throws(() => cloudTarget({ ...config, env: undefined }, 'staging'), /no env.staging/);
 assert.throws(() => cloudTarget({ ...config, env: { staging: { ...staging, r2_buckets: buckets('') } } }, 'staging'), /Configure/);
 assert.throws(() => cloudTarget({ ...config, env: { staging: { ...staging, routes: undefined } } }, 'staging'), /Configure/, 'routes are not inherited');
 assert.throws(() => cloudTarget({ ...config, workers_dev: true }), /Configure/);
 assert.throws(() => cloudTarget({ ...config, analytics_engine_datasets: [] }), /Configure/);
 assert.throws(() => cloudTarget({ ...config, r2_buckets: config.r2_buckets.map(b => ({ ...b, bucket_name: 'same-bucket' })) }), /Configure/);
 const live = cloudTarget(undefined, 'staging');
 assert.equal(live.origin, 'https://templates-staging.wconvert.io'); assert.equal(live.dataset, 'wconvert_design_downloads_staging');
});

test('the publish guard refuses to drop a live design unless the new pointer withdraws it', async t => {
 const f = await fixture(t);
 await publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, null);
 const before = f.requests.length;
 // C drops third-design and adds fourth-design.
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(third), privateObjects, second), /Publication would drop live designs: third-design\. Restore them, or withdraw each with --withdraw ID:REASON\./);
 assert(f.requests.slice(before).every(r => r.method === 'GET'), 'refused before any upload');
 assert.equal(await currentRelease(f.publicBucket), second);
 // A revision-specific withdrawal names the id too.
 await publishRemote(f.publicBucket, f.privateBucket, fresh(third), privateObjects, second, { withdraw: [{ id: 'third-design', revision: 1, reason: 'quality' }] });
 assert.equal(await currentRelease(f.publicBucket), third);
 // Live withdrawals carry into the next pointer, even when the release does not repeat them.
 await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, third, { withdraw: [{ id: 'fourth-design', reason: 'rights' }] });
 assert.deepEqual((await pointerOf(f)).withdrawn, [{ id: 'fourth-design', reason: 'rights' }, { id: 'third-design', revision: 1, reason: 'quality' }]);
 await publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first, { reinstate: [{ id: 'third-design', revision: 1 }] });
 assert.deepEqual((await pointerOf(f)).withdrawn, [{ id: 'fourth-design', reason: 'rights' }]);
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, second, { reinstate: [{ id: 'third-design' }] }), /Nothing to reinstate/);
 // A rename that keeps the old id as an alias drops nothing.
 const renamed = catalogue({ designs: [free, pro, { id: 'third-renamed', aliases: ['third-design'] }], label: 'renamed' });
 await publishRemote(f.publicBucket, f.privateBucket, release(renamed), privateObjects, second);
 assert.equal(await currentRelease(f.publicBucket), renamed.id);
});

test('corrupt live catalogue pages block the guard before uploading', async t => {
 const f = await fixture(t);
 await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 f.corrupt(`templates-public/v3/index/${A.page}.json`);
 const before = f.requests.length;
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first), /Missing or changed catalogue page/);
 assert(f.requests.slice(before).every(r => r.method === 'GET'));
});

test('--withdraw and --popularity republish only the pointer, keeping its release', async t => {
 const f = await fixture(t);
 await publishRemote(f.publicBucket, f.privateBucket, fresh(first), privateObjects, null);
 const before = f.requests.length;
 const withdrawn = await publishRemote(f.publicBucket, f.privateBucket, { objects: new Map() }, new Map(), first, { withdraw: [parseWithdrawal('night-owl@1:rights')] });
 assert.equal(withdrawn.created, 0); assert.equal(withdrawn.release, first);
 assert.deepEqual(f.requests.slice(before).filter(r => r.method === 'PUT').map(r => r.key), ['templates-public/v3/manifest.json']);
 assert.deepEqual(await pointerOf(f), { schema: 3, minor: 0, release: first, withdrawn: [{ id: 'night-owl', revision: 1, reason: 'rights' }] });
 const sidecar = json({ schema: 3, generated: '2026-10-20', downloads: { 'night-owl': 3, 'reading-slip': 120 } });
 const ranked = await publishRemote(f.publicBucket, f.privateBucket, { objects: new Map() }, new Map(), first, { popularity: sidecar });
 assert.equal(ranked.created, 1); assert.equal(ranked.popularity, hash(sidecar));
 assert.deepEqual(f.objects.get(`templates-public/v3/index/${hash(sidecar)}.json`).bytes, sidecar);
 const pointer = await pointerOf(f);
 assert.equal(pointer.popularity, hash(sidecar)); assert.equal(pointer.withdrawn.length, 1, 'the withdrawal survives');
 // A later release keeps the live sidecar unless it names its own.
 await publishRemote(f.publicBucket, f.privateBucket, fresh(second), privateObjects, first);
 assert.equal((await pointerOf(f)).popularity, hash(sidecar));
 await assert.rejects(publishRemote(f.publicBucket, f.privateBucket, { objects: new Map() }, new Map(), second, { popularity: json({ schema: 3, downloads: {} }) }), /Invalid popularity sidecar/);
 assert.equal((await currentPointer(f.publicBucket)).pointer.release, second);
});

test('CLI arguments: withdrawal syntax, modes and a local-only dry run', async t => {
 assert.deepEqual(parseWithdrawal('old-design:rights'), { id: 'old-design', reason: 'rights' });
 assert.deepEqual(parseWithdrawal('old-design@2:other'), { id: 'old-design', revision: 2, reason: 'other' });
 for (const bad of ['old-design', 'old-design:legal', 'Old:rights', 'old@0:rights', 'old@x:rights']) assert.throws(() => parseWithdrawal(bad), /--withdraw/, bad);
 assert.deepEqual(parseReinstatement('old-design@2'), { id: 'old-design', revision: 2 });
 assert.throws(() => parseReinstatement('old-design:rights'), /--reinstate/);
 const root = mkdtempSync(join(tmpdir(), 'publish-cli-')); t.after(() => rmSync(root, { recursive: true, force: true }));
 writeDirectory(root, A);
 const dry = await main(['--directory', root, '--expected', 'none', '--withdraw', 'night-owl:quality']);
 assert.equal(dry.dryRun, true); assert.equal(dry.release, first); assert.equal(dry.publicObjects, A.public.size); assert.equal(dry.privateObjects, A.private.size);
 assert.deepEqual(dry.withdraw, [{ id: 'night-owl', reason: 'quality' }]);
 const file = join(root, 'popularity.json'); writeFileSync(file, json({ schema: 3, generated: '2026-10-20', downloads: {} }));
 const pointerOnly = await main(['--expected', first, '--popularity', file, '--env', 'staging']);
 assert.equal(pointerOnly.environment, 'staging'); assert.equal(pointerOnly.popularity.length, 64); assert.equal(pointerOnly.publicObjects, 0);
 await assert.rejects(main(['--withdraw', 'night-owl:quality']), /--expected/);
 await assert.rejects(main(['--expected', first]), /--withdraw/);
 await assert.rejects(main(['--expected', first, '--retained', first, '--withdraw', 'night-owl:quality']), /--directory/);
 await assert.rejects(main(['--status', '--withdraw', 'night-owl:quality']), /cannot be combined/);
 await assert.rejects(main(['--directory', root, '--expected', 'none', '--remove-pack', 'x']), /Unknown option/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign, createHash, randomUUID } from 'node:crypto';
const hash = b => createHash('sha256').update(b).digest('hex');
const keys = [0, 1].map(n => { const pair = generateKeyPairSync('ed25519'); return { privateKey: pair.privateKey, jwk: { ...pair.publicKey.export({ format: 'jwk' }), kid: `key-${n}`, alg: 'EdDSA', use: 'sig' } }; });
const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
const signed = (claims, index = 0, header = {}) => { const input = `${encode({ alg: 'EdDSA', typ: 'nexus-entitlement+jwt', kid: keys[index].jwk.kid, ...header })}.${encode(claims)}`; return input + '.' + sign(null, Buffer.from(input), keys[index].privateKey).toString('base64url'); };
import { catalogue } from './fixtures.mjs';
const library = catalogue({ designs: [{ id: 'night-owl', tier: 'pro', images: ['premium', 'free'] }, { id: 'other-pro', tier: 'pro', images: ['premium'] }],
 setups: [{ id: 'night-start', design: 'night-owl' }] });
const night = library.objects['night-owl'], digest = night.sha256, setup = library.objects['night-start'].sha256, other = library.objects['other-pro'].sha256;
const [premiumImage, freeImage] = night.assets, imageHash = premiumImage.sha256, image = library.private.get(`v3/assets/${imageHash}.png`);
const designPath = `/v3/premium/designs/${digest}.json`, setupPath = `/v3/premium/setups/${setup}.json`, imagePath = `/v3/premium/assets/${imageHash}.png`;
const origin = 'https://templates.example', nexus = 'https://nexus.example';
const settings = { NEXUS_GRANT_URL: nexus + '/api/v1/wconvert/entitlements/grant', NEXUS_KEYS_URL: nexus + '/api/v1/wconvert/entitlements/keys', NEXUS_ISSUER: nexus, NEXUS_AUDIENCE: origin, NEXUS_ENVIRONMENT: 'staging', NEXUS_SERVICE_KEY: 'test-service-secret' };
async function fixture(t, overrides = {}) {
 const config = { ...settings, ...overrides };
 const state = { calls: [], error: null, override: {}, key: 0, header: {}, outage: false };
 const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'), compatibilityDate: '2026-10-01', r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'], bindings: config,
  ratelimits: {
   GRANT_RATE_LIMITER: { namespace_id: '1', simple: { limit: 10000, period: 60 } },
   GRANT_IP_RATE_LIMITER: { namespace_id: '2', simple: { limit: 10000, period: 60 } },
   DOWNLOAD_RATE_LIMITER: { namespace_id: '3', simple: { limit: 10000, period: 60 } },
   DOWNLOAD_IP_RATE_LIMITER: { namespace_id: '4', simple: { limit: 10000, period: 60 } },
  },
  outboundService: async request => {
   state.calls.push({ url: request.url, headers: Object.fromEntries(request.headers), body: request.method === 'POST' ? await request.json() : null });
   if (state.outage) return new Response('{}', { status: 503 });
   if (state.rawResponse && request.url === config.NEXUS_GRANT_URL) return state.rawResponse();
   if (state.keysUnavailable && request.url === config.NEXUS_KEYS_URL) return new Response('{}', { status: 503 });
   if (request.url === config.NEXUS_KEYS_URL) return Response.json({ keys: keys.map(k => k.jwk) });
   assert.equal(request.url, config.NEXUS_GRANT_URL); assert.equal(request.headers.get('Authorization'), 'Bearer test-service-secret'); assert.equal(request.headers.get('X-License-Key'), 'test-customer-secret');
   if (state.error) return Response.json({ success: false, error_code: state.error.code }, { status: state.error.status, headers: { 'Retry-After': '45' } });
   const body = state.calls.at(-1).body;
   const at = Math.floor(Date.now() / 1000);
   const claims = { iss: nexus, aud: origin, environment: 'staging', store: 'wconvert', item: 'wconvert-pro', permission: 'templates:download', site: body.domain, activation_id: 'active-site-123', resource_digest: body.resource_digest, version: 1, iat: at, exp: at + 300, jti: randomUUID(), ...state.override };
   return Response.json({ success: true, token_type: 'Bearer', grant: signed(claims, state.key, state.header), expires_in: 300 });
  }
 }));
 t.after(() => mf.dispose());
 const bucket = await mf.getR2Bucket('PRIVATE_TEMPLATES'), publicBucket = await mf.getR2Bucket('PUBLIC_TEMPLATES');
 for (const [key, bytes] of library.private) await bucket.put(key, bytes);
 for (const [key, bytes] of library.public) await publicBucket.put(key, bytes);
 const fetch = (path, options) => mf.dispatchFetch(origin + path, options);
 const issue = (body = { domain: 'shop.example/blog', designs: [digest], setups: [setup] }) => fetch('/v3/grants', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-License-Key': 'test-customer-secret' }, body: JSON.stringify(body) });
 return { state, mf, bucket, fetch, issue };
}
test('one Nexus pass authorizes an exact batch: objects plus premium images, including HEAD and retries', async t => {
 const { state, bucket, fetch, issue } = await fixture(t);
 const response = await issue(); assert.equal(response.status, 200, await response.clone().text());
 const { grant } = await response.json(); const headers = { Authorization: `Bearer ${grant}` };
 assert.match(response.headers.get('cache-control'), /private, no-store/);
 assert.equal(state.calls[0].body.permission, 'templates:download'); assert.equal(Object.keys(state.calls[0].body).sort().join(','), 'domain,permission,resource_digest');
 // The free image is public, so it is not in the pass's file list.
 const expectedFiles = [[imagePath, imageHash, image.length], [designPath, digest, night.bytes.length], [setupPath, setup, library.objects['night-start'].bytes.length]];
 assert.equal(state.calls[0].body.resource_digest, hash(JSON.stringify(expectedFiles)));
 for (const [path, expected] of [[designPath, night.bytes], [setupPath, library.objects['night-start'].bytes], [imagePath, image]]) {
  const first = await fetch(path, { headers }); assert.equal(first.status, 200); assert.deepEqual(Buffer.from(await first.arrayBuffer()), expected); assert.match(first.headers.get('cache-control'), /private, no-store/);
  assert.equal((await fetch(path, { headers, method: 'HEAD' })).status, 200);
  assert.equal((await fetch(path, { headers: { ...headers, 'If-None-Match': '*' } })).status, 200);
  assert.equal((await fetch(path, { method: 'HEAD' })).status, 401);
 }
 // Files outside the batch are refused, even existing premium ones.
 for (const path of [`/v3/premium/assets/${'a'.repeat(64)}.png`, `/v3/premium/designs/${other}.json`, `/v3/premium/assets/${freeImage.sha256}.png`]) {
  const refused = await fetch(path, { headers }); assert.equal(refused.status, 403, path); assert.deepEqual(await refused.json(), { error_code: 'resource_not_allowed' });
 }
 assert.equal((await fetch(`/v3/assets/${freeImage.sha256}.png`)).status, 200, 'the free image is public');
 assert.equal((await fetch(designPath, { headers: { Authorization: `Bearer ${grant.slice(0,-3)}xxx` } })).status, 401);
 state.outage = true;
 assert.equal((await fetch(designPath, { headers })).status, 200, 'issued pass finishes through Nexus outage');
 assert.equal((await issue()).status, 503, 'new issuance fails closed');
 await bucket.put(`v3/assets/${imageHash}.png`, 'damaged');
 assert.equal((await fetch(imagePath, { headers })).status, 503);
 const stored = JSON.parse(await (await bucket.get(`grants/${hash(grant)}.json`)).text());
 stored.claims.site = 'other.example'; await bucket.put(`grants/${hash(grant)}.json`, JSON.stringify(stored));
 assert.equal((await fetch(designPath, { headers })).status, 401, 'context binding checked');
});
test('licence, activation, service and availability failures stay distinct', async t => {
 const { state, issue } = await fixture(t);
 for (const [status, code, expected] of [[401,'invalid_key',401], [403,'license_expired',403], [403,'key_disabled',403], [403,'domain_not_allowed',403], [401,'service_authentication_failed',503], [403,'permission_not_allowed',503], [429,'rate_limited',429], [503,'verification_unavailable',503]]) {
  state.error = { status, code }; const r = await issue(); assert.equal(r.status, expected, code);
  const error = await r.json(); assert.equal(error.error_code, expected === 503 ? 'verification_unavailable' : code);
  if (expected === 429) assert.equal(r.headers.get('retry-after'), '45');
 }
});
test('signed but wrong claims, algorithms and lifetimes cannot issue access', async t => {
 const { state, issue } = await fixture(t);
 const at = Math.floor(Date.now()/1000);
 for (const override of [{iss:'wrong'}, {aud:'wrong'}, {environment:'production'}, {store:'other'}, {item:'other'}, {permission:'other'}, {site:'wrong'}, {activation_id:''}, {resource_digest:'a'.repeat(64)}, {version:2}, {exp:at-1}, {iat:at+20,exp:at+200}, {exp:at+600}, {jti:''}]) {
  state.override = override; const r = await issue(); assert.notEqual(r.status, 200, JSON.stringify(override));
 }
 state.override = {}; state.header = { alg: 'none' }; assert.notEqual((await issue()).status,200);
 state.header = {}; state.key = 1; assert.equal((await issue()).status,200,'rotated published key accepted');
});
test('public access never calls Nexus; clients cannot supply resource sets or credentials in URLs', async t => {
 const { state, mf, fetch, issue } = await fixture(t);
 assert.equal((await fetch(`/v3/assets/${freeImage.sha256}.png`)).status,200); assert.equal(state.calls.length,0);
 assert.equal((await issue({ domain:'shop.example', designs:[digest], setups:[], files:['anything'] })).status,400);
 assert.equal((await fetch('/v3/grants?key=secret',{method:'POST'})).status,400);
 assert.equal((await fetch('/v3/grants')).status,405);
 assert.equal((await fetch(`${designPath}?grant=secret`)).status,400);
 assert.equal((await fetch(`/v3/designs/${digest}.json`)).status,404, 'a premium object has no public address');
 assert.equal((await fetch('/grants/'+digest+'.json')).status,404);
 assert.equal((await fetch('/v3/grants/'+digest+'.json')).status,404);
 assert.equal(state.calls.length,0);
});

test('expiry is enforced on each file; context loss and storage outages never grant access', async t => {
 const { bucket, fetch, issue } = await fixture(t);
 const { grant } = await (await issue()).json();
 const context = JSON.parse(await (await bucket.get(`grants/${hash(grant)}.json`)).text());
 const at = Math.floor(Date.now()/1000);
 const expiredClaims = { ...context.claims, iat: at-100, exp: at-1 };
 const expired = signed(expiredClaims);
 await bucket.put(`grants/${hash(expired)}.json`, JSON.stringify({ ...context, claims: expiredClaims }));
 for (const method of ['GET','HEAD']) assert.equal((await fetch(designPath,{method, headers:{Authorization:`Bearer ${expired}`}})).status,401);
 await bucket.delete(`grants/${hash(grant)}.json`);
 assert.equal((await fetch(designPath,{headers:{Authorization:`Bearer ${grant}`}})).status,401);
});

test('unknown signing key refresh is bounded, rotations and outage fail safely', async t => {
 const { mf, state, issue } = await fixture(t);
 assert.equal((await issue()).status,200);
 const cache = (await mf.getCaches()).default;
 await cache.put(settings.NEXUS_KEYS_URL, new Response(JSON.stringify({at:Math.floor(Date.now()/1000),keys:[keys[0].jwk]}),{headers:{'Cache-Control':'public,max-age=60'}}));
 state.key=1;
 const before=state.calls.filter(c=>c.url===settings.NEXUS_KEYS_URL).length;
 assert.equal((await issue()).status,503); assert.equal((await issue()).status,503);
 assert.equal(state.calls.filter(c=>c.url===settings.NEXUS_KEYS_URL).length,before,'unknown kid does not cause repeated key fetches');
 await cache.put(settings.NEXUS_KEYS_URL, new Response(JSON.stringify({at:Math.floor(Date.now()/1000)-31,keys:[keys[0].jwk]}),{headers:{'Cache-Control':'public,max-age=60'}}));
 assert.equal((await issue()).status,200);
 assert.equal(state.calls.filter(c=>c.url===settings.NEXUS_KEYS_URL).length,before+1);
});

test('malformed and oversized requests are bounded and never call Nexus', async t => {
 const { fetch, state } = await fixture(t);
 for (const [body,status] of [['{',400],['x'.repeat(8193),413]]) {
  const response=await fetch('/v3/grants',{method:'POST',headers:{'Content-Type':'application/json','X-License-Key':'test'},body});
  assert.equal(response.status,status);
 }
 assert.equal(state.calls.length,0);
});


test('Nexus malformed replies, redirects, oversized responses and missing keys fail closed', async t => {
 const { mf, state, issue } = await fixture(t);
 for (const reply of [() => new Response('not JSON'), () => Response.json({success:false}), () => new Response('x'.repeat(16385)), () => new Response('{}',{status:302,headers:{Location:'https://untrusted.example'}})]) {
  state.rawResponse=reply; assert.equal((await issue()).status,503);
 }
 state.rawResponse=null;
 state.keysUnavailable=true;
 assert.equal((await issue()).status,503);
 state.keysUnavailable=false;
 assert.equal((await issue()).status,200);
 assert.ok(state.calls.every(c=>c.url.startsWith(nexus+'/')),'never follow another origin');
 const cache=(await mf.getCaches()).default;
 await cache.delete(settings.NEXUS_KEYS_URL);
 state.keysUnavailable=true;
 assert.equal((await issue()).status,503);
});


test('custom API hostname accepts the pinned issuer, never the API origin as issuer', async t => {
 const api = 'https://my.wconvert.example';
 const { state, issue, fetch } = await fixture(t, {
  NEXUS_GRANT_URL: api + '/api/v1/wconvert/entitlements/grant',
  NEXUS_KEYS_URL: api + '/api/v1/wconvert/entitlements/keys',
 });
 const response = await issue(); assert.equal(response.status, 200);
 const { grant } = await response.json();
 assert.equal((await fetch(designPath, { headers: { Authorization: `Bearer ${grant}` } })).status, 200);
 assert.ok(state.calls.every(c => new URL(c.url).origin === api));
 state.override = { iss: api };
 assert.equal((await issue()).status, 503, 'API hostname is not the trusted signed issuer');
 state.override = {};
 state.rawResponse = () => new Response('{}', { status: 302, headers: { Location: nexus + '/grant' } });
 assert.equal((await issue()).status, 503, 'even redirects to the issuer must not be followed');
 assert.ok(state.calls.every(c => new URL(c.url).origin === api));
});

test('unsafe or mismatched configured endpoints never send credentials', async t => {
 for (const overrides of [
  { NEXUS_KEYS_URL: 'https://other.example/keys' },
  { NEXUS_GRANT_URL: 'http://nexus.example/grant' },
  { NEXUS_GRANT_URL: 'https://user:password@nexus.example/grant' },
  { NEXUS_KEYS_URL: settings.NEXUS_KEYS_URL + '?key=value' },
  { NEXUS_ISSUER: nexus + '#fragment' },
  { NEXUS_AUDIENCE: 'http://templates.example' },
 ]) {
  await t.test(JSON.stringify(overrides), async sub => {
   const { issue, state } = await fixture(sub, overrides);
   const result = await issue(); assert.equal(result.status, 503);
   assert.equal((await result.json()).error_code, 'service_not_configured');
   assert.equal(state.calls.length, 0);
  });
 }
});

test('a batch is 1-50 unique premium digests the service stores; anything else never reaches Nexus', async t => {
 const { state, bucket, issue } = await fixture(t);
 const many = [];
 for (let n = 0; n < 50; n++) { const bytes = Buffer.from(JSON.stringify({ schema: 3, n, assets: [] })); await bucket.put(`v3/designs/${hash(bytes)}.json`, bytes); many.push(hash(bytes)); }
 const fifty = await issue({ domain: 'shop.example', designs: many, setups: [] });
 assert.equal(fifty.status, 200, 'fifty is allowed');
 assert.equal(state.calls.filter(c => c.body).length, 1);
 const before = state.calls.length;
 for (const [body, status, code] of [
  [{ domain: 'shop.example', designs: [...many, digest], setups: [] }, 400, 'invalid_request'],
  [{ domain: 'shop.example', designs: many.slice(0, 49), setups: [setup, 'f'.repeat(64)] }, 400, 'invalid_request'],
  [{ domain: 'shop.example', designs: [], setups: [] }, 400, 'invalid_request'],
  [{ domain: 'shop.example', designs: [digest, digest], setups: [] }, 400, 'invalid_request'],
  [{ domain: 'shop.example', designs: [digest], setups: [digest] }, 400, 'invalid_request'],
  [{ domain: 'shop.example', designs: ['ABC'], setups: [] }, 400, 'invalid_request'],
  [{ domain: 'shop.example', designs: [digest] }, 400, 'invalid_request'],
  [{ domain: 'shop.example', pack: digest }, 400, 'invalid_request'],
  [{ domain: 'shop.example', designs: ['f'.repeat(64)], setups: [] }, 404, 'not_found'],
  [{ domain: 'shop.example', designs: [setup], setups: [] }, 404, 'not_found'],
  [{ domain: 'shop.example', designs: [], setups: [digest] }, 404, 'not_found'],
 ]) {
  const response = await issue(body); assert.equal(response.status, status, JSON.stringify(body).slice(0, 120));
  assert.deepEqual(await response.json(), { error_code: code });
 }
 assert.equal(state.calls.length, before, 'refused batches never call Nexus');
});

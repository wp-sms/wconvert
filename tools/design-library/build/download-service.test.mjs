import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadObject } from './download-service.mjs';
const digest = createHash('sha256').update('{}').digest('hex'), site = 'activation-test-site';
const resource = { access: 'premium', product: 'wconvert-pro', mime: 'application/json', key: 'private-pack' };
const request = { digest, site, credential: 'test-only-secret' };
const resources = new Map([[digest, resource]]);
test('premium bytes require an exact server decision and are never publicly cacheable', async () => {
  let reads = 0;
  const read = async value => { assert.equal(value.key, resource.key); reads++; return Buffer.from('{}'); };
  for (const status of ['expired', 'revoked', 'wrong_plan', 'wrong_site', 'unavailable']) {
    await assert.rejects(downloadObject(request, { resources, read, authorize: async () => ({ status }) }), error => error.code === (status === 'unavailable' ? 'verification_unavailable' : status));
  }
  assert.equal(reads, 0);
  const allowed = { status: 'allowed', digest, site, product: 'wconvert-pro' };
  const result = await downloadObject(request, { resources, read, authorize: async () => allowed });
  assert.equal(reads, 1); assert.equal(result.headers['Cache-Control'], 'private, no-store');
  await assert.rejects(downloadObject(request, { resources, read, authorize: async () => ({ ...allowed, site: 'another-site' }) }), { code: 'verification_unavailable' });
  await assert.rejects(downloadObject(request, { resources, read, authorize: async () => { throw new Error('test-only-secret'); } }), error => error.code === 'verification_unavailable' && !error.message.includes('secret'));
  assert.equal(reads, 1);
});
test('Free downloads need no licence; withdrawn content cannot be read', async () => {
  const providers = { resources: new Map([[digest, { ...resource, access: 'free' }]]), authorize: () => { throw new Error('Free must not verify a licence'); }, read: async () => Buffer.from('{}') };
  assert.equal((await downloadObject({ digest }, providers)).headers['Cache-Control'], 'public, max-age=31536000, immutable');
  providers.resources.set(digest, { ...resource, withdrawn: true });
  await assert.rejects(downloadObject(request, providers), { code: 'not_available' });
});

test('refuses storage corruption even after authorization', async () => {
  await assert.rejects(downloadObject({ digest }, { resources: new Map([[digest, { ...resource, access: 'free' }]]), read: async () => Buffer.from('wrong') }), { code: 'storage_unavailable' });
});

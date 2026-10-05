// Swap only disposable extracted ZIPs. Preserve a copy of the previous committed build first.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const destination = '/tmp/wconvert-quiz-installed';
const baseline = '/tmp/wconvert-quiz-baseline/stage';
const candidate = resolve('dist/stage');
const endpoint = 'http://127.0.0.1:9445/';
const status = async () => { const r = await fetch(endpoint + '?wconvert_rc_status=1'); assert.equal(r.status, 200); return r.json(); };
const copy = (source, target) => execFileSync('rsync', ['-a', '--delete', source + '/', target + '/']);
const restore = () => { copy(candidate + '/plain/wconvert', destination + '/wconvert'); copy(candidate + '/elite/wconvert-pro', destination + '/wconvert-pro'); };
const before = await status(); assert.ok(before.quiz_available); assert.ok(before.campaigns.quiz); assert.equal(before.quiz_suspended, null);
const results = [];
const check = async (name, quiz, suspended) => {
  const after = await status(); assert.equal(after.quiz_available, quiz); assert.equal(after.quiz_suspended, suspended); assert.deepEqual(after.campaigns, before.campaigns);
  const page = await fetch(endpoint + 'product/coffee-machine/'); assert.equal(page.status, 200);
  const html = await page.text(); assert.doesNotMatch(html, /Fatal error|There has been a critical error/);
  results.push({ name, passed: true, runtime: after.runtime });
};
try {
  copy(baseline + '/plain/wconvert', destination + '/wconvert'); copy(baseline + '/elite/wconvert-pro', destination + '/wconvert-pro');
  await check('previous committed packages retain saved campaigns and product statistics', false, null);
  restore(); await check('upgrade to quiz candidate retains saved campaigns and product statistics', true, null);
  for (const tier of ['basic', 'pro']) {
    copy(candidate + `/${tier}/wconvert-pro`, destination + '/wconvert-pro');
    await check(`${tier} suspends quizzes configured with cart buttons and retains data`, false, 'cart_products');
    restore(); await check(`Elite restoration after ${tier} re-enables quiz actions with data unchanged`, true, null);
  }
} finally { restore(); }
writeFileSync('docs/reviews/quiz-cart-2026-10-05/package-cycle.json', JSON.stringify({ before: before.runtime, results }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));

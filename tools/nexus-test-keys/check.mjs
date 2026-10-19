#!/usr/bin/env node
// Ask the real store about the thirteen WCTEST- keys and say which ones no
// longer answer the way tests/fixtures/nexus-test-keys.json recorded them.
// Read-only: it sends the SDK's domain-less validate, which takes no seat.
//
//   node tools/nexus-test-keys/check.mjs
//
// The keys are never in the repo. Put them, in the fixture's order, in
// tools/nexus-test-keys/keys.local.json (git ignores it): ["WCTEST-…", …].
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/nexus-test-keys.json', here), 'utf8'));
let keys;

try {
  keys = JSON.parse(readFileSync(new URL('keys.local.json', here), 'utf8'));
} catch {
  console.error('No tools/nexus-test-keys/keys.local.json: a JSON list of the thirteen keys, in order.');
  process.exit(2);
}

const store = process.env.WCONVERT_NEXUS_URL || 'https://my.wconvert.io';
// The parts of an answer the licence state is built from.
const summary = (body) => ({
  success: body.success,
  error_code: body.error_code ?? null,
  status: body.license?.status ?? null,
  renewal: body.license?.renewal?.state ?? null,
  subscription: body.license?.renewal?.subscription_status ?? null,
  auto_renews: body.license?.renewal?.auto_renews ?? null,
  expires_at: body.license?.expires_at ?? null,
});
let drifted = 0;

for (const [index, recorded] of fixture.keys.entries()) {
  const response = await fetch(`${store}/api/v1/license/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ license_key: keys[index], product_slug: 'wconvert', domain: '' }),
  });

  if (response.status === 429) {
    console.error(`Rate limited at key ${recorded.key}; try again after ${response.headers.get('retry-after') ?? 'a minute'}s.`);
    process.exit(2);
  }

  const now = summary(await response.json());
  const then = summary(recorded.refresh.body);
  const same = JSON.stringify(now) === JSON.stringify(then) && response.status === recorded.refresh.status;

  if (!same) {
    drifted++;
  }

  console.log(`${same ? 'same   ' : 'CHANGED'}  key ${String(recorded.key).padStart(2)}  ${recorded.situation}`);

  if (!same) {
    console.log(`         recorded ${JSON.stringify(then)}\n         now      ${JSON.stringify(now)}`);
  }
}

process.exit(drifted === 0 ? 0 : 1);

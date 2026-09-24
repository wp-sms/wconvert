#!/usr/bin/env node
/** The optional phone asset and the page totals it creates, measured with gzip -9. */
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const size = (path) => gzipSync(readFileSync(new URL(path, root)), { level: 9 }).length;
const phone = size('public/phone/phone.js');
const cap = 16 * 1024;
if (phone > cap) throw new Error(`phone asset: ${phone} B exceeds ${cap} B`);
console.log(`  ✓ phone feature: ${phone} B gzipped (budget ${cap} B)`);
for (const [label, path, base] of [
  ['free', 'public/loader/loader.js', 14012],
  ['basic', 'pro/public/tiers/basic/loader/loader.js', 24064],
  ['pro', 'pro/public/tiers/pro/loader/loader.js', 25088],
  ['elite', 'pro/public/loader/loader.js', 25344],
]) {
  const total = size(path) + phone;
  console.log(`  ✓ ${label} phone page: ${total} B gzipped (combined ceiling ${base + cap} B)`);
  if (total > base + cap) throw new Error(`${label} phone page exceeds combined ceiling`);
}

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
  // ADR 0167: +1024 B for bounded artwork; both bases follow their loader budget's +2560 B.
  // ADR 0168: the approved styling and form alignment changes add 192 B to both bases.
  // ADR 0184: both bases follow their loader budget, +80 B free and +32 B Pro.
  ['free', 'public/loader/loader.js', 18192],
  // ADR 0158: the Pro base follows the Pro loader budget's +288 B.
  // ADR 0186: the country list following its field adds 96 B to the Pro base only.
  ['pro', 'pro/public/loader/loader.js', 30816],
]) {
  const total = size(path) + phone;
  console.log(`  ✓ ${label} phone page: ${total} B gzipped (combined ceiling ${base + cap} B)`);
  if (total > base + cap) throw new Error(`${label} phone page exceeds combined ceiling`);
}

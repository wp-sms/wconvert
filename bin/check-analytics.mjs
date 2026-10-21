#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const size = path => gzipSync(readFileSync(new URL('../' + path, import.meta.url)), { level: 9 }).length;
const analytics = size('pro/public/analytics/analytics.js');
const cap = 4096;
if (analytics > cap) throw new Error(`Analytics asset ${analytics} B exceeds ${cap} B`);
console.log(`Analytics feature: ${analytics} B gzip (budget ${cap} B, enabled pages only)`);
// The Pro loader budget from check-loader.mjs (ADR 0155, ADR 0158, ADR 0159).
const base = 30720;
const loader = size('pro/public/loader/loader.js');
const phone = size('public/phone/phone.js');
if (loader + analytics > base + cap || loader + analytics + phone > base + cap + 16384) throw new Error('pro analytics page exceeds its combined budget');
console.log(`pro: loader + analytics ${loader + analytics} B; with phone ${loader + analytics + phone} B gzip`);

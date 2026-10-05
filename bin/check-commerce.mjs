#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const size = path => gzipSync(readFileSync(new URL('../' + path, import.meta.url)), { level: 9 }).length;
const commerce = size('pro/modules/cart-recovery/public/commerce.js');
const loader = size('pro/public/loader/loader.js');
// ADR 0121: session protection, explicit add states and native cart refresh.
const cap = 4800;
if (commerce > cap || loader + commerce > 27040 + cap) throw new Error(`Commerce page exceeds budget: loader ${loader} B + commerce ${commerce} B gzip`);
console.log(`Commerce: ${commerce} B gzip (cap ${cap} B); loader + commerce ${loader + commerce} B, commerce campaigns only.`);

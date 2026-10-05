#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const size = path => gzipSync(readFileSync(new URL('../' + path, import.meta.url)), { level: 9 }).length;
const commerce = size('pro/modules/cart-recovery/public/commerce.js');
const loader = size('pro/public/loader/loader.js');
// ADR 0122: visible-card observations and product-link activity add ~600 B gzip.
const cap = 5400;
if (commerce > cap || loader + commerce > 27168 + cap) throw new Error(`Commerce page exceeds budget: loader ${loader} B + commerce ${commerce} B gzip`);
console.log(`Commerce: ${commerce} B gzip (cap ${cap} B); loader + commerce ${loader + commerce} B, commerce campaigns only.`);

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const bytes = gzipSync(readFileSync('pro/modules/analytics/public/revenue.js'), { level: 9 }).length;
if (bytes > 2048) throw new Error(`Revenue asset ${bytes} B exceeds 2048 B`);
console.log(`Revenue feature: ${bytes} B gzip (budget 2048 B, enabled stores only)`);

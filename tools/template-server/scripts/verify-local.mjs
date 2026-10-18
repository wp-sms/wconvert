import { verifyService } from './verify-service.mjs';
const base = new URL(process.argv[2] || 'http://127.0.0.1:9454');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('This rehearsal is local only');
console.log(JSON.stringify(await verifyService(base), null, 2));

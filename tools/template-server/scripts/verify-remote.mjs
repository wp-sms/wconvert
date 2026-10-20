import { parseArgs } from 'node:util';
import { cloudTarget } from './cloud-config.mjs';
import { verifyService } from './verify-service.mjs';
const { values } = parseArgs({ options: { expected: { type: 'string' }, premium: { type: 'string', default: 'unconfigured' } } });
if (!/^[a-f0-9]{64}$/.test(values.expected ?? '')) throw Error('Supply --expected with the exact published release ID');
const { origin } = cloudTarget();
try { console.log(JSON.stringify({ origin, ...await verifyService(origin, { expected: values.expected, premiumMode: values.premium }) }, null, 2)); }
catch { console.error('Hosted verification failed. Check the deployed configuration, release ID and service responses; no credentials were used.'); process.exitCode = 1; }

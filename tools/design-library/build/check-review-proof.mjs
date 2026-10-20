import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkProof } from './review-proof.mjs';
const root = resolve(import.meta.dirname, '../../..');
if (process.argv.length !== 3) throw Error('Pass a proof ledger: npm run templates:review:proof -- docs/reviews/<batch>/proof.json');
const read = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
console.log(checkProof(read(process.argv[2]), read('tools/design-library/out/pilot.json'), root));

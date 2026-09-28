import { readFileSync } from 'node:fs';
const batch = process.argv[2];
const entries = JSON.parse(readFileSync(new URL('../out/pilot.json', import.meta.url)));
const queue = JSON.parse(readFileSync(new URL('../out/review-queue.json', import.meta.url)));
const selected = entries.filter(e => !batch || e.batch === batch);
if (!selected.length) throw new Error(`No campaigns in batch: ${batch}`);
const pending = selected.map(e => queue.find(q => q.id === e.id)).filter(q => q.state !== 'approved');
console.log(`${selected.length - pending.length}/${selected.length} current editorial approvals. External delivery and release approval are outside this gate.`);
for (const row of pending) console.log(`${row.id}: ${row.state} — ${row.reason}`);
if (pending.length) process.exitCode = 1;

const maintenance = JSON.parse(readFileSync(new URL('../out/maintenance.json', import.meta.url))).maintenance;
const undocumented = maintenance.filter(d => d.unrecorded_change);
for (const design of undocumented) console.log(`${design.id}: record the design change and review ${design.dependents.length} dependent setups.`);
if (undocumented.length) process.exitCode = 1;

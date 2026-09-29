import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateBacklog } from './backlog.mjs';
const plan = JSON.parse(readFileSync(new URL('../pilot/next-batch.json', import.meta.url)));
const entries = JSON.parse(execFileSync('php', [fileURLToPath(new URL('pilot.php',import.meta.url))], {encoding:'utf8'}));
test('planned needs are separate from actual campaigns and compared with known examples', () => {
  validateBacklog(plan, entries);
  const fixture = { schema: 1, entries: [0, 1].map(i => ({ id: 'planned-' + i, status: 'planned', audience: 'stores', goal: 'find_match', display_type: 'popup', design_intent: 'new_design', name: 'New need ' + i, visitor_need: 'Different task ' + i, difference: 'A useful difference', compare_campaigns: [entries[0].id], acceptance: ['Walk the actual route'] })) };
  for (const mutate of [p=>p.entries[0].id=entries[0].id,p=>p.entries[0].compare_campaigns=['missing'],p=>p.entries[1].visitor_need=p.entries[0].visitor_need,p=>p.entries[0].acceptance=[]]) {
    const copy=structuredClone(fixture);mutate(copy);assert.throws(()=>validateBacklog(copy,entries));
  }
});

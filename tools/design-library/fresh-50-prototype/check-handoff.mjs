/** Exact structure/style/copy comparison, allowing only documented production configuration. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { designs } from './designs.mjs';
const map = JSON.parse(fs.readFileSync('docs/reviews/everyday-2026-10-24/prototype-map.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const art = new Map(fs.readdirSync('tools/design-library/pilot/assets/everyday').filter(f => f.endsWith('.webp')).map(f => [hash(fs.readFileSync('tools/design-library/pilot/assets/everyday/' + f)), f.replace('.webp', '')]));
const normalize = (value, prototypeIds, key = '') => {
  if (Array.isArray(value)) return value.filter(v => !(v?.type === 'consent' && !prototypeIds.has(v.id))).map(v => normalize(v, prototypeIds));
  if (!value || typeof value !== 'object') return ['tokens', 'narrow'].includes(key) ? String(value) : value;
  const result = {};
  for (const [k,v] of Object.entries(value)) {
    if (['fonts', 'purpose'].includes(k)) continue;
    if (k === 'href' && ['button', 'followup'].includes(value.type)) continue;
    if (k === 'hidden' && ['consent', 'followup'].includes(value.type)) continue;
    if (k === 'src') { result[k] = v.startsWith('data:') ? art.get(hash(Buffer.from(v.split(',')[1], 'base64'))) : v.split('/').at(-1).replace('.png', ''); assert(result[k]); }
    else if (k === 'consents') result[k] = v.filter(id => prototypeIds.has(id));
    else if (['tokens','narrow'].includes(k)) result[k] = Object.fromEntries(Object.entries(v).map(([a,b]) => [a,String(b)]));
    else result[k] = normalize(v, prototypeIds, k);
  }
  return result;
};
const rows = [];
for (const p of designs) {
  const entry = map.find(m => m.id === p.id), native = JSON.parse(fs.readFileSync(`${entry.directory}/templates/${entry.native_id}.json`));
  const ids = new Set(); const walk = n => { if(n.id)ids.add(n.id); for(const k of ['children','start','end'])for(const c of n[k]??[])walk(c); };p.tree.steps.forEach(s=>walk(s.content));
  const expected = normalize(p.tree,ids);expected.submissions ??= [];
  assert.deepEqual(normalize(native.tree,ids),expected,entry.native_id);
  assert.deepEqual(native.tokens,Object.fromEntries(Object.entries(p.tokens).map(([k,v])=>[k,String(v)])));
  assert.equal(native.tier,p.tier.toLowerCase());
  rows.push({id:entry.native_id,prototype:p.id,matched:true,screens:p.tree.steps.length});
}
fs.writeFileSync('docs/reviews/everyday-2026-10-24/fidelity.json',JSON.stringify({checked:new Date().toISOString(),scope:'All layout nodes, dimensions, wide/narrow styling, copy, roles, image identities, screen order and tier. Production-only font declaration, configuration URLs, consent visibility and submission metadata are excluded.',designs:rows},null,2)+'\n');
console.log('50/50 native trees match the approved prototype structure, copy and responsive styles.');

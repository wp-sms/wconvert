import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function designRevision(design) { return hash(Object.fromEntries(Object.entries(design).filter(([key])=>key!=='source'))); }

/** Internal authoring history. This never mutates saved customer campaigns. */
export function maintenanceReport(designs, usage, entries, lifecycle) {
  if (lifecycle.schema !== 1 || !Array.isArray(lifecycle.designs)) throw new Error('Invalid design history');
  const known = new Map(designs.map(d => [d.id, d]));
  const records = new Map();
  for (const record of lifecycle.designs) {
    if (!known.has(record.id) || records.has(record.id) || !['active','retired'].includes(record.status)
      || !record.history?.length) throw new Error(`Invalid design history: ${record.id}`);
    record.history.forEach((v,i) => {
      if (v.version !== i+1 || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !v.note?.trim() || !/^[a-f0-9]{64}$/.test(v.revision)) throw new Error(`Invalid version: ${record.id}`);
    });
    if (record.status === 'retired' && (!record.reason?.trim() || !known.has(record.replacement) || record.replacement === record.id)) throw new Error(`Retirement needs reason and replacement: ${record.id}`);
    records.set(record.id,record);
  }
  if (records.size !== known.size) throw new Error('Every design needs an explicit history baseline');
  for (const record of records.values()) if (record.status === 'retired' && records.get(record.replacement)?.status !== 'active') throw new Error(`Replacement must be active: ${record.id}`);
  for (const use of usage) if (!known.has(use.template_id)) throw new Error(`Unknown design dependency: ${use.id}`);
  return designs.map(design => {
    const record = records.get(design.id), current = designRevision(design), last = record.history.at(-1);
    const campaigns = entries.filter(e => e.template_id === design.id).map(e=>({id:e.id,name:e.name}));
    const dependents = usage.filter(e=>e.template_id===design.id);
    return {...record,name:design.name,source:design.source,display_type:design.display_type,current_revision:current,
      unrecorded_change:current!==last.revision,version:last.version,campaigns,dependents,
      action:current!==last.revision?'Record a new version and review all dependent setups.':record.status==='retired'?'Use the replacement for future authoring; retain existing customer snapshots.':'Current history recorded.'};
  });
}

/** Heuristics prompt editorial inspection; they do not certify design quality. */
export function editorialFindings(entry) {
  const findings=[];
  const add=(screen,node,issue)=>findings.push({id:entry.id,screen,node:node.id??null,issue});
  function visit(node,screen,kind) {
    if (!node || typeof node!=='object' || node.hidden) return;
    if (['heading','text','eyebrow','badge'].includes(node.type) && node.role !== 'wordmark' && !node.text?.trim()) add(screen,node,'Empty copy slot: inspect spacing and remove unused content.');
    const children=node.children??[];
    if (!(kind==='acknowledgement' && children.every(n=>n.type==='icon' && n.name==='check')) && children.some(n=>n.type==='icon') && children.filter(n=>n.type!=='icon').every(n=>n.hidden||!String(n.text??n.label??'').trim())) add(screen,node,'Icon without visible companion copy: confirm its purpose.');
    if (node.type==='grid' && children.some(n=>n.type==='row'&&n.children?.some(c=>c.type==='icon'))) add(screen,node,'Benefit icon rows may wrap inconsistently: inspect unequal phrases.');
    for(const key of ['children','start','end']) for(const child of node[key]??[])visit(child,screen,kind);
  }
  entry.tree.steps.forEach((step,i)=>visit(step.content,i+1,step.kind));return findings;
}

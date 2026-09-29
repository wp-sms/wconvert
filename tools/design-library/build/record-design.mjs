import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDesigns } from './inventory.mjs';
import { designRevision } from './maintenance.mjs';
const [id,...words]=process.argv.slice(2),note=words.join(' ').trim();
if(!id||!note)throw new Error('Usage: npm run templates:record -- design-id "Why the design changed"');
const root=resolve(import.meta.dirname,'../../..'),design=readDesigns(root).find(d=>d.id===id);
if(!design)throw new Error(`Unknown design: ${id}`);
const file=resolve(root,'tools/design-library/review/design-history.json'),data=JSON.parse(readFileSync(file,'utf8'));
let record=data.designs.find(d=>d.id===id);
if(!record){record={id,status:'active',history:[]};data.designs.push(record);}
const revision=designRevision(design);
if(record.history.at(-1)?.revision===revision)throw new Error('Design has not changed; no version was added.');
record.history.push({version:record.history.length+1,date:new Date().toISOString().slice(0,10),revision,note});
writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log(`Recorded ${id} v${record.history.length}. Rebuild and review every affected campaign; this does not approve or publish anything.`);

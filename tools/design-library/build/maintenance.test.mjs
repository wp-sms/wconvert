import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designRevision, maintenanceReport, editorialFindings } from './maintenance.mjs';
const design={id:'a',name:'A',tree:{steps:[]},tokens:{bg:'white'}};
const record=d=>({id:d.id,status:'active',history:[{version:1,date:'2026-09-28',note:'Initial',revision:designRevision(d)}]});
test('design edits identify all dependent setups without touching saved campaigns',()=>{
 const history={schema:1,designs:[record(design)]},usage=[{id:'one',template_id:'a'},{id:'two',template_id:'a'}];
 const changed={...design,tokens:{bg:'black'}};const r=maintenanceReport([changed],usage,[usage[0]],history)[0];
 assert.equal(r.unrecorded_change,true);assert.equal(r.dependents.length,2);assert.equal(r.campaigns.length,1);
 assert.equal(history.designs[0].history.length,1);
 history.designs[0].history.push({version:2,date:'2026-09-29',note:'Improve contrast',revision:designRevision(changed)});
 assert.equal(maintenanceReport([changed],usage,[],history)[0].unrecorded_change,false);
});
test('retirement requires an active replacement and rejects missing, cyclic or duplicate records',()=>{
 const b={...design,id:'b'},a={...record(design),status:'retired',reason:'Consolidate',replacement:'b'};
 assert.equal(maintenanceReport([design,b],[],[],{schema:1,designs:[a,record(b)]})[0].status,'retired');
 for(const records of [[a],[a,a], [a,{...record(b),status:'retired',reason:'Cycle',replacement:'a'}],[{...a,replacement:'missing'},record(b)]])assert.throws(()=>maintenanceReport([design,b],[],[],{schema:1,designs:records}));
});
test('editorial review catches empty slots, stranded icons and wrapping benefit rows',()=>{
 const entry={id:'one',tree:{steps:[{content:{type:'grid',children:[{type:'row',children:[{type:'icon',name:'truck'},{type:'text',id:'n2',text:''}]},{type:'text',id:'n3',hidden:true,text:''}]}}]}};
 const findings=editorialFindings(entry);assert.equal(findings.length,3);assert.ok(findings.every(f=>f.node!=='n3'));
});

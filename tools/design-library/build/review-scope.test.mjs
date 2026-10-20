import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewScope, maintenanceScope} from './review-scope.mjs';
const screen={id:'form',name:'Details',kind:'input'};
const input=()=>({base:'base',paths:[],designs:[{id:'shared',tree:{steps:[screen]}},{id:'other',tree:{steps:[screen]}}],
 setups:[{id:'one',template_id:'shared',tree:{steps:[screen]}},{id:'unlisted-dependent',template_id:'shared',tree:{steps:[screen]}},{id:'unrelated',template_id:'other',tree:{steps:[screen]}}],
 briefsBefore:[{id:'one'}],briefsAfter:[{id:'one'}],collectionsBefore:[{id:'collection',items:[{setup_id:'one'}]}],collectionsAfter:[{id:'collection',items:[{setup_id:'one'}]}],queue:[{id:'unrelated',state:'stale'}]});
test('design change includes registered dependents outside the studio, not unrelated backlog',()=>{
 const x=input();x.paths=['resources/templates/library/shared.json'];const p=reviewScope(x);
 assert.deepEqual(p.setups.map(e=>e.id),['one','unlisted-dependent']);assert.equal(p.setups[1].in_studio,false);
 assert.deepEqual(p.collections,['collection']);assert.equal(p.unrelated_pending.length,1);assert.equal(p.mode,'affected-only');
});
test('copy and individual brief changes have a local scope',()=>{
 const x=input();x.paths=['resources/playbooks/one.php'];assert.deepEqual(reviewScope(x).setups.map(e=>e.id),['one']);
 x.paths=[];x.briefsAfter=[{id:'one',requirements:['new requirement']}];assert.deepEqual(reviewScope(x).setups.map(e=>e.id),['one']);
});
test('renderer, phone and capture changes require the whole library',()=>{
 for(const path of ['resources/renderer/src/css.ts','resources/phone/src/enhance.ts','resources/loader/src/index.ts','src/Playbook/Prefill.php','pro/modules/journeys/loader/index.ts','pro/modules/journeys/module.php','wconvert.php','resources/templates/manifest.json','tools/design-library/pilot/assets/example.svg']){
 const x=input();x.paths=[path];const p=reviewScope(x);assert.equal(p.mode,'whole-library',path);assert.equal(p.setups.length,3);assert.equal(p.designs.length,2);
 }
});
test('new designs, removed entries, collection metadata and documentation are distinguished',()=>{
 const x=input();x.paths=['resources/templates/library/new.json','resources/playbooks/removed.php','README.md'];
 x.designs.push({id:'new',tree:{steps:[screen]}});x.collectionsAfter[0].name='Renamed';const p=reviewScope(x);
 assert.deepEqual(p.designs.map(e=>e.id),['new']);assert.deepEqual(p.removed_setups,['removed']);assert.deepEqual(p.collections,['collection']);assert.equal(p.setups.length,0);
 assert.equal(reviewScope({...input(),paths:['README.md']}).setups.length,0);
});
test('every result is enumerated and output fingerprint changes after a final copy edit',()=>{
 const x=input();x.paths=['resources/playbooks/one.php'];x.setups[0].tree.steps.push({id:'result',name:'Match',kind:'result',results:[{id:'a'},{id:'b'}]});
 const p=reviewScope(x);assert.deepEqual(p.setups[0].screens.map(s=>s.result),[null,'a','b']);
 x.setups[0].tree.steps[0]={...screen,content:{text:'Changed after review'}};assert.notEqual(reviewScope(x).setups[0].output,p.setups[0].output);
});
test('a batch gates every selected design without clearing unrelated maintenance debt',()=>{
 const maintenance=[{id:'shared',unrecorded_change:true},{id:'other',unrecorded_change:true},{id:'clean',unrecorded_change:false}];
 const selected=[{template_id:'shared'}];
 const batch=maintenanceScope(maintenance,selected,'batch');
 assert.deepEqual(batch.required.map(d=>d.id),['shared']);
 assert.deepEqual(batch.outside.map(d=>d.id),['other']);
 assert.deepEqual(maintenanceScope(maintenance,selected).required.map(d=>d.id),['shared','other']);
 assert.deepEqual(maintenanceScope(maintenance,selected).outside,[]);
});

// Only the disposable, extracted package directories; never a saved WordPress site.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const destination='/tmp/wconvert-rc-installed';
const root=process.cwd();
const old='/tmp/wconvert-rc-baseline/dist/stage';
const endpoint='http://127.0.0.1:9445/';
const status=async()=>{const r=await fetch(endpoint+'?wconvert_rc_status=1');assert.equal(r.status,200);return r.json();};
const copy=(source,target)=>execFileSync('rsync',['-a','--delete',source+'/',target+'/']);
const restore=()=>{copy(resolve(root,'dist/stage/plain/wconvert'),destination+'/wconvert');copy(resolve(root,'dist/stage/elite/wconvert-pro'),destination+'/wconvert-pro');};
const before=await status();assert.ok(before.addition_available);assert.equal(Object.keys(before.campaigns).length,4);
const results=[];
const check=async(name,expected)=>{const after=await status();assert.equal(after.addition_available,expected);assert.deepEqual(after.campaigns,before.campaigns);const page=await fetch(endpoint+'product/coffee-machine/');assert.equal(page.status,200);const html=await page.text();assert.doesNotMatch(html,/Fatal error|There has been a critical error/);if(!expected)assert.ok(!html.includes('data-commerce-add='));results.push({name,passed:true,runtime:after.runtime});};
try {
  assert.ok(readFileSync(old+'/plain/wconvert/wconvert.php','utf8').includes('WConvert'));
  copy(old+'/plain/wconvert',destination+'/wconvert');copy(old+'/elite/wconvert-pro',destination+'/wconvert-pro');
  await check('rollback to branch-base packages preserves snapshots and statistics',false);
  restore();await check('upgrade back to recommendation candidate preserves snapshots and statistics',true);
  copy(resolve(root,'dist/stage/basic/wconvert-pro'),destination+'/wconvert-pro');
  await check('Basic tier hides commerce without deleting campaigns or statistics',false);
  restore();await check('Elite restoration re-enables commerce without data changes',true);
} finally {restore();}
writeFileSync('docs/reviews/recommendations-rc-2026-10-05/package-cycle.json',JSON.stringify({before:before.runtime,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));

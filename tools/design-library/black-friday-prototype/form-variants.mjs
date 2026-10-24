/** Exercise the editor's real conversion on real WordPress Prefill responses. Disposable site only. */
import fs from 'node:fs';
import { build } from 'esbuild';
const base=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9462';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Disposable WordPress required');
await build({entryPoints:['resources/admin/src/builder/structure/captureConversion.ts'],bundle:true,platform:'node',format:'esm',outfile:'tools/design-library/out/capture-conversion.mjs'});
const {convertCapture,captureState}=await import('../out/capture-conversion.mjs');
const map=JSON.parse(fs.readFileSync('docs/reviews/black-friday-2026-10-24/prototype-map.json'));
const selected=process.env.FIDELITY_IDS?.split(',');
const file='tools/design-library/out/wordpress-form-variants.json';
const result=selected&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
for(const entry of map.filter(entry=>!selected||selected.includes(entry.id))){
 const {draft,goals}=await(await fetch(`${base}/?wconvert_collection_approval=${entry.native_id}&conversion_source=1`)).json();
 if(captureState(draft.config.template.tree)!=='none')continue;
 const converted=convertCapture(draft,{capture:'email'},{goals});
 if('reason' in converted)throw Error(entry.native_id+': '+converted.reason);
 result[entry.native_id]=converted;
}
fs.writeFileSync('tools/design-library/out/wordpress-form-variants.json',JSON.stringify(result,null,2)+'\n');
console.log(Object.keys(result).length+' actual editor form conversions ready');

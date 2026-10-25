import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDesigns } from './inventory.mjs';

// A focused browser check of shared controls, not a new editorial approval.
// Run after templates:pilot; open control-proof.html and press Run checks.
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(import.meta.dirname, '../out');
const designs = readDesigns(root, { pictures: true });
const setups = JSON.parse(execFileSync('php', ['tools/design-library/build/pilot.php'], {
  cwd: root, env: { ...process.env, WCONVERT_EXPORT_ALL: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
}));
const entries = [...designs.map(d => ({ ...d, source: 'design' })), ...setups.map(s => ({
  id: s.id, source: 'setup', display_type: s.display_type, ...s.config.template,
}))];
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
writeFileSync(resolve(out, 'control-proof.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shared visitor control proof</title><style>body{font:16px/1.5 system-ui;margin:24px;background:#f3f4f6;color:#172338}button{font:inherit;padding:10px 16px}#stage{margin-top:24px}pre{white-space:pre-wrap}</style>
<h1>Shared visitor control proof</h1><p>Every design and registered setup, every screen/result, 320/390/768/1440px, LTR/RTL, every close shape. Checks actual icon geometry, the close target size and select clearance. This is not visual approval of the whole library.</p><button id="run">Run checks</button><p id="status">Ready</p><div id="stage"></div><pre id="results"></pre>
<script>${renderer}</script><script>
const entries=${JSON.stringify(entries).replaceAll('<','\\u003c')}, R=WConvertRenderer;
const stage=document.getElementById('stage'), status=document.getElementById('status');
const rect=el=>el.getBoundingClientRect(), centre=r=>[r.x+r.width/2,r.y+r.height/2];
const difference=(a,b)=>Math.max(...centre(a).map((n,i)=>Math.abs(n-centre(b)[i])));
document.getElementById('run').onclick=async()=>{
 const report={entries:entries.length,cases:0,close:0,select:0,phone:0,failures:[],coverage:[]};
 for(const entry of entries){
  let cases=0,selects=0;
  for(const width of [320,390,768,1440])for(const dir of ['ltr','rtl'])for(let step=0;step<entry.tree.steps.length;step++)for(const result of entry.tree.steps[step].results||[null]){
   const host=document.createElement('div');host.style.width=width+'px';host.dir=dir;
   const shadow=host.attachShadow({mode:'open'}), style=document.createElement('style');style.textContent=R.SHADOW_CSS;shadow.append(style);
   const panel=R.render(entry.tree,entry.tokens,step);panel.style.maxHeight='none';
   if(result)R.previewResult(panel,result,entry.tree.steps[step].products_required);
   if(entry.display_type!=='inline')panel.append(R.closeButton(()=>{}));
   shadow.append(panel);R.disposePreview(stage);stage.replaceChildren(host);R.prepareControls(panel,shadow);
   const context={id:entry.id,source:entry.source,width,dir,screen:entry.tree.steps[step].id,result:result?.id};
   const fail=issue=>report.failures.push({...context,issue});
   const close=panel.querySelector('.wc-close');
   // Every shape a design may choose (ADR 0159): the target keeps its size and the × its centre.
   if(close)for(const shape of ['50%','0.375rem','0']){report.close++;panel.style.setProperty('--wc-close-radius',shape);const svg=close.querySelector('svg'),path=svg?.querySelector('path'),box=rect(close),target=matchMedia('(pointer:coarse)').matches?44:32;
    if(!path)fail('Close must use font-independent geometry');
    else if(difference(box,rect(path))>.51)fail('Close ink is not centred ('+shape+')');
    if(Math.abs(box.width-target)>.51||Math.abs(box.height-target)>.51)fail('Close target is not '+target+'px ('+shape+')');
   }
   panel.style.removeProperty('--wc-close-radius');
   for(const input of panel.querySelectorAll('select.wc-input')){report.select++;selects++;const svg=input.parentElement.querySelector('svg'),path=svg?.querySelector('path');
    if(!path){fail('Missing select chevron');continue;}
    const a=rect(input),b=rect(svg),ink=rect(path),css=getComputedStyle(input);
    if(Math.abs(centre(a)[1]-centre(ink)[1])>.51)fail('Chevron ink is not vertically centred');
    if(b.width<20 || ink.width<9)fail('Chevron is too small');
    if(b.left<a.left||b.right>a.right||b.top<a.top||b.bottom>a.bottom)fail('Chevron outside control');
    const space=dir==='rtl'?b.right-a.left:a.right-b.left;
    if(parseFloat(css.paddingInlineEnd)<space+4)fail('Text can collide with chevron');
    if(getComputedStyle(svg).pointerEvents!=='none')fail('Chevron can intercept native select clicks');
   }
   for(const trigger of panel.querySelectorAll('.lpi__trigger')){
    const svg=trigger.querySelector('.lpi__arrow svg');if(!trigger.querySelector('.lpi__arrow'))continue;
    report.phone++;
    if(!svg || rect(svg).width<20)fail('Phone country chevron missing or too small');
    else if(Math.abs(centre(rect(trigger))[1]-centre(rect(svg))[1])>.51)fail('Phone chevron is not centred');
   }
   report.cases++;cases++;
  }
  report.coverage.push({id:entry.id,source:entry.source,cases,selects});
  status.textContent='Checking '+entry.id; await new Promise(requestAnimationFrame);
 }
 R.disposePreview(stage);stage.replaceChildren();status.textContent=report.cases+' cases · '+report.close+' close buttons · '+report.select+' selects · '+report.phone+' phone selectors · '+report.failures.length+' failures';
 document.getElementById('results').textContent=JSON.stringify(report,null,2);
};</script></html>`);
console.log(`control-proof.html: ${designs.length} designs + ${setups.length} registered setups`);

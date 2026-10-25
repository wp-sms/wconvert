/* global mount, measure, settled, WConvertRenderer */
/** Full inventory review: every source design and filled setup, every screen/result. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readDesigns } from '../design-library/build/inventory.mjs';
const base=process.env.WCONVERT_STUDIO_URL||'http://127.0.0.1:9452';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local studio required');
const stress=process.env.WCONVERT_REVIEW_LONG_COPY==='1';
const output=process.env.WCONVERT_LIBRARY_EVIDENCE||('/tmp/library-polish'+(stress?'-long':''));fs.mkdirSync(output,{recursive:true});
const mode=process.argv[2]||'audit';
const datasets=[{kind:'designs',entries:readDesigns(process.cwd(),{pictures:true})},{kind:'campaigns',entries:JSON.parse(execFileSync('php',['tools/design-library/build/pilot.php'],{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,WCONVERT_EXPORT_ALL:'1'}}))}];
for(const {kind,entries} of datasets)fs.writeFileSync(`tools/design-library/out/all-${kind}.json`,JSON.stringify(entries));
const selectedIds=process.env.WCONVERT_REVIEW_IDS?.split(',');
if(selectedIds)for(const dataset of datasets)dataset.entries=dataset.entries.filter(entry=>selectedIds.includes(entry.id));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000},hasTouch:true});
 await page.goto(base+'/library-review.html');
 for(const {kind,entries} of datasets){
  if(mode==='audit'){
   const report=await page.evaluate(async({entries,kind,stress})=>{
    const cases=[],failures=[];
    for(const entry of entries)for(const width of [320,390,520,640,768,960,1280,1440])for(const rtl of [false,true])for(let step=0;step<entry.tree.steps.length;step++)for(const variant of entry.tree.steps[step].results||[null]){
     const {root,frame}=mount(entry,step,width,stress,rtl,variant);document.body.append(frame);await settled(root);
     const m=measure(root,width,entry.display_type),collisions=[];
     if(entry.display_type!=='inline'){
      const close=root.querySelector('.wc-close');
      const c=close.getBoundingClientRect();
      for(const el of root.querySelectorAll('.wc-heading,.wc-text,.wc-eyebrow,.wc-badge,.wc-label,.wc-consent-text,input,select,button:not(.wc-close),a.wc-button,.wc-code')){
       if(!el.getClientRects().length||getComputedStyle(el).position==='absolute')continue;
       let rects=[el.getBoundingClientRect()];
       if(el.matches('.wc-heading,.wc-text,.wc-eyebrow,.wc-label,.wc-consent-text')){const range=document.createRange();range.selectNodeContents(el);rects=[...range.getClientRects()];}
       if(rects.some(r=>r.width>1&&r.height>1&&r.left<c.right&&r.right>c.left&&r.top<c.bottom&&r.bottom>c.top))collisions.push((el.textContent||el.getAttribute('name')||el.tagName).slice(0,65));
      }
     }
     const smallCopy=[...root.querySelectorAll('.wc-text,.wc-label,.wc-consent-text')].filter(el=>el.getBoundingClientRect().height>1&&getComputedStyle(el).position!=='absolute'&&parseFloat(getComputedStyle(el).fontSize)<13.5).map(el=>el.textContent.slice(0,65));
     const issue={smallCopy,kind,id:entry.id,step,result:variant?.id||null,width,rtl,composition:m.composition,overflow:m.overflow,lowContrast:m.lowContrast,lowFieldContrast:m.lowFieldContrast,minText:m.minText,minControl:m.minControl,inputSize:m.inputSize,closeOverlap:collisions,height:m.height};cases.push(issue);
     if(m.composition.length||m.overflow.length||m.lowContrast.length||m.lowFieldContrast.length||collisions.length||m.minControl!==null&&m.minControl<44||m.inputSize!==null&&m.inputSize<16||smallCopy.length)failures.push(issue);
     WConvertRenderer.disposePreview(frame);frame.remove();
    }
    return{kind,total:cases.length,failures,cases};
   },{entries,kind,stress});
   fs.writeFileSync(`${output}/${kind}-audit.json`,JSON.stringify(report,null,2));console.log(kind,report.total,'cases',report.failures.length,'flagged',new Set(report.failures.map(x=>x.id)).size,'entries');if(report.failures.length)process.exitCode=1;
  }else{
   // Four screens per board; each has an actual-size phone and a fitted desktop.
   const screens=entries.flatMap(entry=>entry.tree.steps.flatMap((screen,step)=>(screen.results||[null]).map(variant=>({entry,step,variant}))));
   for(let index=0;index<screens.length;index+=4){
    const group=screens.slice(index,index+4);
    await page.evaluate(async group=>{
     let controls=document.getElementById('original-controls');if(!controls){controls=document.createElement('div');controls.id='original-controls';controls.hidden=true;controls.append(...document.body.childNodes);}WConvertRenderer.disposePreview(document.body);document.body.replaceChildren(controls);document.body.style.cssText='margin:0;padding:16px;background:#eeeef0;font:14px system-ui;color:#171717;width:1210px';
     for(const {entry,step,variant,stress,rtl}of group){
      const row=document.createElement('section');row.style.cssText='margin-bottom:18px;background:white;padding:12px';
      const label=document.createElement('h2');label.textContent=`${entry.id} · ${entry.display_type} · ${entry.tree.steps[step].name}${variant?' · '+variant.id:''}`;label.style.cssText='font-size:16px;margin:0 0 12px';row.append(label);
      const pair=document.createElement('div');pair.style.cssText='display:flex;gap:20px;align-items:start';row.append(pair);document.body.append(row);
      for(const width of [320,1280]){
       const stage=document.createElement('div');stage.style.cssText=`width:${width===320?320:810}px;background:#e6e7e9;padding:8px;box-sizing:content-box;flex:none;overflow:hidden`;
       pair.append(stage);const {root,frame}=mount(entry,step,width,stress,rtl,variant);stage.append(frame);await settled(root);
       
       const scale=Math.min(1,(width===320?320:810)/frame.getBoundingClientRect().width);frame.style.transformOrigin='top left';frame.style.transform=`scale(${scale})`;stage.style.height=Math.ceil(root.getBoundingClientRect().height)+'px';
      }
     }
    },group.map(item=>({...item,stress,rtl:process.env.WCONVERT_REVIEW_RTL==='1'})));
    await page.screenshot({path:`${output}/${kind}-${String(index/4+1).padStart(2,'0')}.png`,fullPage:true});
   }
   console.log(kind,screens.length,'screens/results',Math.ceil(screens.length/4),'boards');
  }
 }
}finally{await browser.close();}

/** Real WordPress payload + shipping loader, with no review fonts or substitute renderer. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const base=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9462';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Disposable WordPress required');
const folder=process.env.WCONVERT_VISUAL_FOLDER||'docs/reviews/black-friday-wordpress';fs.mkdirSync(folder,{recursive:true});
const map=JSON.parse(fs.readFileSync('docs/reviews/black-friday-2026-10-24/prototype-map.json'));
const selected=process.env.FIDELITY_IDS?.split(',');
const forms=process.env.WCONVERT_FORM_REVIEW==='1';
const variants=forms?JSON.parse(fs.readFileSync('tools/design-library/out/wordpress-form-variants.json')):null;
const entries=map.filter(e=>(!selected||selected.includes(e.id))&&(!forms||variants[e.native_id]));
const previous=selected&&fs.existsSync(`${folder}/visual.json`)?JSON.parse(fs.readFileSync(`${folder}/visual.json`)):[];
const browser=await chromium.launch();const report=previous.filter(r=>!entries.some(e=>e.id===r.id));
try{
 for(const width of [1440,390])for(const entry of entries){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.addCookies([{name:'wcv_test_consent',value:'allow',url:base}]);
  await context.addInitScript(()=>{const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return attach.call(this,{...options,mode:'open'});};});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const result={id:entry.id,native_id:entry.native_id,name:entry.name,viewport:width};
  try{
   await page.goto(`${base}/?wconvert_collection_approval=${entry.native_id}&visual=1${forms?'&capture=email':''}`,{waitUntil:'domcontentloaded'});
   const root=page.locator('.wc-root');await root.waitFor({state:'visible',timeout:30000});
   await root.evaluate(async el=>{await document.fonts.ready;await Promise.all([...el.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));});
   await page.evaluate(()=>{document.activeElement?.shadowRoot?.activeElement?.blur();document.activeElement?.blur();});
   await page.screenshot({path:`${folder}/${entry.id}-${width}-viewport.png`});
   result.metrics=await root.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    const leaves=[...el.querySelectorAll('.wc-heading,.wc-text,.wc-eyebrow,.wc-button,.wc-label,.wc-code')];
    const fonts=leaves.map(n=>{const s=getComputedStyle(n),family=s.fontFamily.split(',')[0].replaceAll('"','').trim();return{text:n.textContent.slice(0,90),family,size:s.fontSize,weight:s.fontWeight,loaded:document.fonts.check(`${s.fontStyle} ${s.fontWeight} ${s.fontSize} "${family}"`)};});
    const faces=[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight,style:f.style,status:f.status}));
    const overflows=[...el.querySelectorAll('*')].filter(n=>n.clientWidth>2&&n.scrollWidth>n.clientWidth+2&&!n.matches('input,select,textarea')).map(n=>n.getAttribute('data-node-id')||n.className);
    const field=el.querySelector('input[type=email]'),button=el.querySelector('[data-action=submit]');let alignment=null;
    if(field&&button){const f=field.getBoundingClientRect(),b=button.getBoundingClientRect();const adjacent=(f.right<=b.left+1||b.right<=f.left+1)&&f.bottom>b.top&&b.bottom>f.top;alignment={adjacent,bottomDifference:Math.abs(f.bottom-b.bottom)};}
    const luminance=colour=>{const rgb=colour.match(/[\d.]+/g)?.slice(0,3).map(Number);if(!rgb||rgb.length!==3)return null;const linear=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;};
    const contrast=(fg,bg)=>{const a=luminance(fg),b=luminance(bg);return a===null||b===null?null:Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2));};
    const fields=[...el.querySelectorAll('input:not([type=checkbox]),textarea,select')].map(n=>{const s=getComputedStyle(n),placeholder=getComputedStyle(n,'::placeholder').color;return{name:n.name,colour:s.color,background:s.backgroundColor,placeholder,textContrast:contrast(s.color,s.backgroundColor),placeholderContrast:contrast(placeholder,s.backgroundColor)};});
    return{fields,width:rect.width,height:rect.height,scrollHeight:el.scrollHeight,fonts,faces,overflows,alignment};
   });
   // Preserve the real viewport above; expand only the scrolling surface for a complete-content comparison.
   await root.evaluate(el=>{for(let n=el;n;n=n.parentElement){n.style.maxBlockSize='none';n.style.maxHeight='none';}el.style.maxBlockSize='none';});
   result.file=`${entry.id}-${width}-wordpress.png`;
   await root.screenshot({path:path.join(folder,result.file),animations:'disabled'});
   result.errors=errors;
  }catch(error){result.failure=error.message;await page.screenshot({path:`${folder}/${entry.id}-${width}-failure.png`}).catch(()=>{});}
  report.push(result);fs.writeFileSync(`${folder}/visual.json`,JSON.stringify(report,null,2)+'\n');
  console.log(entry.id,width,result.failure||`${result.metrics.width}×${result.metrics.scrollHeight}; ${result.metrics.overflows.length} overflows`);
  await context.close();
 }
}finally{await browser.close();}
for(let batch=0;batch<10;batch++)for(const width of [1440,390]){
 const rows=report.filter(r=>Number(r.id)>batch*5&&Number(r.id)<=batch*5+5&&r.viewport===width);
 if(!rows.length)continue;
 const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#e9e7e3;font:14px system-ui}h2{margin:10px 0}section{margin-bottom:25px}.pair{display:flex;gap:12px;align-items:start}.pair img{width:100%;display:block}.pair div{width:48%}small{display:block;margin-bottom:8px}</style>${rows.map(r=>`<section><h2>${r.id} · ${r.name} · ${r.viewport}px</h2><div class="pair"><div><small>Approved prototype</small><img src="../black-friday-fidelity/${r.id}-${width}-prototype.png"></div><div><small>Actual WordPress · ${r.metrics?.width}×${r.metrics?.scrollHeight}</small><img src="${r.file}"></div></div></section>`).join('')}`;
 fs.writeFileSync(`${folder}/sheet-${batch+1}-${width}.html`,html);
}
if(report.some(r=>r.failure||r.errors?.length||r.metrics.overflows.length||r.metrics.fonts.some(f=>!f.loaded)))process.exitCode=1;

/** Representative native captures in the disposable older-essentials fixture. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9453';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Disposable local site required');
const evidence=process.env.WCONVERT_LIBRARY_EVIDENCE||'/tmp/library-polish-native';fs.mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch(),report=[];
try{
 const ids=process.env.WCONVERT_NATIVE_IDS?.split(',')||['article-end-newsletter','reading-notes-guide','repair-assessment','renovation-callback','vip-early-access','service-enquiry','headlines-optional-sms','consultation-corner','fullscreen-guide'];
 for(const id of ids)for(const width of [320,1280]){
  console.log(id,width);
  const context=await browser.newContext({viewport:{width,height:740},hasTouch:width===320});
  await context.addCookies([{name:'wcv_test_consent',value:'allow',url:base}]);
  const page=await context.newPage(),errors=[],captures=[];let endpoint='';
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async r=>{if(r.request().method()==='POST'&&r.url()===endpoint)captures.push({status:r.status(),body:await r.json()});});
  await page.addInitScript(()=>{window.reviewRoots=[];const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const root=attach.call(this,options);window.reviewRoots.push(root);return root;};});
  try { await page.goto(`${base}/?wconvert_older_essentials=${id}`); } catch(error) {
   if(!String(error).includes('ERR_NETWORK_IO_SUSPENDED'))throw error;
   await page.goto(`${base}/?wconvert_older_essentials=${id}`);
  }
  await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-root')));
  endpoint=await page.locator('#wconvert-payload').getAttribute('data-capture');
  const clickShadow = async selector => {
   await page.evaluate(selector=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'));const el=r.querySelector(selector);if(!el)throw Error('Missing '+selector);el.scrollIntoView({block:'center',behavior:'instant'});},selector);
   // Let the preceding scroll event finish before opening a selector that closes on scroll.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const point=await page.evaluate(selector=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'));const b=r.querySelector(selector).getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};},selector);
   await page.mouse.click(point.x,point.y);
  };
  const states=[];let finished=false;
  for(let step=0;step<8;step++){
   await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'));
   const before=await page.evaluate(()=>{
    const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'));
    const root=r.querySelector('.wc-root'),actions=[...r.querySelectorAll('[data-action="next"],[data-action="submit"]')];
    return {text:root.innerText,action:actions[0]?.dataset.action,overflow:root.scrollWidth>root.clientWidth+2||document.documentElement.scrollWidth>innerWidth,phone:!!r.querySelector('input[type="tel"]')};
   });
   if(before.overflow)throw Error(`${id}: horizontal overflow`);
   await page.screenshot({path:`${evidence}/${id}-${width}-${step}.png`,fullPage:true});
   states.push({step,phone:before.phone});
   if(!before.action){finished=true;break;}
   if(before.phone){
    await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.lpi__trigger')));
    await clickShadow('.lpi__trigger');
    await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.lpi__search')));
    await page.evaluate(()=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('input[type="tel"]'));const search=r.querySelector('.lpi__search');search.value='United Kingdom';search.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.lpi__option[data-code="GB"]')&&r.querySelectorAll('.lpi__option').length===1));
    const gap=await page.evaluate(()=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.lpi__dropdown'));const d=r.querySelector('.lpi__dropdown');if(d.classList.contains('lpi__dropdown--fullscreen'))return 0;const a=r.querySelector('.wc-phone').getBoundingClientRect(),b=d.getBoundingClientRect();return Math.abs(d.classList.contains('lpi__dropdown--above')?a.top-b.bottom:b.top-a.bottom);});
    if(gap>2)throw Error(id+': filtered country selector detached by '+gap+'px');
    await page.screenshot({path:`${evidence}/${id}-${width}-countries.png`});
    await clickShadow('.lpi__option[data-code="GB"]');
   }
   const previous=before.text;
   await page.evaluate(id=>{
    const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'));
    for(const el of r.querySelectorAll('.wc-field input,.wc-field select,.wc-field textarea,.wc-consent input,[data-question-id]')){
     if(el.type==='checkbox')el.checked=true;
     else if(el.type==='radio'){if(id==='service-enquiry')el.checked=el.value==='repair';else if(!r.querySelector(`input[name="${el.name}"]:checked`))el.checked=true;}
     else if(el.tagName==='SELECT')el.selectedIndex=Math.min(1,el.options.length-1);
     else if(el.type==='email')el.value='polish@example.test';
     else if(el.type==='tel')el.value='+447400123456';
     else if(el.type!=='hidden'&&!el.classList.contains('iti__search-input'))el.value='Review example';
     el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    }
   },id);
   // A real pointer click checks that the button can be reached inside native scrolling containers.
   await clickShadow('[data-action="next"],[data-action="submit"]');
   await page.waitForFunction(previous=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-root')?.innerText!==previous&&!r.querySelector('[aria-busy="true"]')),previous);
  }
  if(!finished||errors.length)throw Error(id+': unfinished journey or script error '+errors.join(';'));
  if(!captures.some(c=>c.body.id)||captures.some(c=>c.status>=300))throw Error(id+': no confirmed local Lead capture '+JSON.stringify(captures));
  report.push({id,width,states,localCaptures:captures.filter(c=>c.body.id).length,passed:true});await context.close();
 }
 fs.writeFileSync(`${evidence}/native-journeys.json`,JSON.stringify(report,null,2)+'\n');console.log('Passed',report.length,'native journeys');
}finally{await browser.close();}

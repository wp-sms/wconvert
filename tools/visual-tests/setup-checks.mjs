/**
 * The two mechanical review checks, run by a machine (tools/design-library/review/README.md):
 * every setup to review is built through Prefill on a disposable local WordPress
 * (mu/harness.php + mu/collection-approval.php), shown, and walked as a visitor
 * at 320 and 1280 px — empty and invalid input refused, required consent
 * enforced, one simulated failure kept the details, retry saved a local Lead,
 * the acknowledgement appeared, and real links, coupons and resource emails
 * work. One failing setup never stops the run.
 *
 *   WCONVERT_REVIEW_RESULTS=docs/reviews/<batch>/results.json node tools/visual-tests/setup-checks.mjs
 *
 * Setups: WCONVERT_REVIEW_IDS (comma-separated), else every setup the review
 * queue does not show as approved. Setups that show products need the commerce
 * fixture: they run only with WCONVERT_REVIEW_COMMERCE=1. Screenshots go to
 * WCONVERT_REVIEW_SHOTS (default: the temp folder) and are never evidence.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const base=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9453';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Disposable local site required');
const output=process.env.WCONVERT_REVIEW_RESULTS;
if(!output||!/^docs\/reviews\/[a-z0-9._-]+\/results\.json$/.test(output))throw Error('Set WCONVERT_REVIEW_RESULTS=docs/reviews/<batch>/results.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
const evidence=process.env.WCONVERT_REVIEW_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'setup-checks-'));fs.mkdirSync(evidence,{recursive:true});
const entries=JSON.parse(fs.readFileSync('tools/design-library/out/pilot.json','utf8'));
const queue=JSON.parse(fs.readFileSync('tools/design-library/out/review-queue.json','utf8'));
const approved=new Set(queue.filter(row=>row.state==='approved').map(row=>row.id));
const selected=process.env.WCONVERT_REVIEW_IDS?.split(',');
const showsProducts=entry=>JSON.stringify(entry.tree).includes('"product');
const chosen=entries.filter(entry=>selected?selected.includes(entry.id):!approved.has(entry.id));
const ids=chosen.filter(entry=>process.env.WCONVERT_REVIEW_COMMERCE==='1'||!showsProducts(entry)).map(entry=>entry.id);
const run=Date.now().toString(36);
const browser=await chromium.launch(),results=chosen.filter(entry=>!ids.includes(entry.id)).map(entry=>({id:entry.id,revision:entry.revision,skipped:'Shows products: run again with the commerce fixture and WCONVERT_REVIEW_COMMERCE=1'}));
const save=()=>fs.writeFileSync(output,JSON.stringify({schema:1,at:new Date().toISOString(),site:'disposable local WordPress',checks:['journey','wordpress'],setups:results},null,2)+'\n');
try{
 for(const id of ids)for(const width of [320,1280]){
  console.log(id,width);
  const revision=entries.find(entry=>entry.id===id).revision;
  const email=`review-${run}-${id}-${width}@example.test`;
  const context=await browser.newContext({viewport:{width,height:800},hasTouch:width===320});let page;
  try{
  if(id==='first-order-receipt')await context.grantPermissions(['clipboard-read','clipboard-write']);
  await context.addCookies([{name:'wcv_test_consent',value:'allow',url:base}]);
  page=await context.newPage();const errors=[],captures=[];let endpoint,failedOnce=false,attempts=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.reviewRoots=[];const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=attach.call(this,o);window.reviewRoots.push(r);return r;};});
  page.on('response',async r=>{if(r.url()===endpoint&&r.request().method()==='POST')captures.push({status:r.status(),body:await r.json()});});
  // A setup shown only to shoppers with items in their cart needs one there first.
  if(JSON.stringify(entries.find(entry=>entry.id===id).config).includes('cart_has_items')){
   const fixture=await (await context.request.get(`${base}/?wconvert_commerce_fixture=1&json=1`)).json();
   await page.goto(`${base}/?add-to-cart=${fixture.products[0]}`);
  }
  await page.goto(`${base}/?wconvert_collection_approval=${id}`);
  await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-root')));
  if(id==='sale-deadline')await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&/\d/.test(r.querySelector('.wc-countdown')?.textContent||'')));
  endpoint=await page.locator('#wconvert-payload').getAttribute('data-capture');
  await page.route(endpoint,async route=>{
   if(route.request().postDataJSON()?.submission)attempts++;
   if(route.request().postDataJSON()?.submission&&!failedOnce){failedOnce=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Simulated temporary failure. Try again.'})});}
   else await route.continue();
  });
  const state=()=>page.evaluate(()=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'));const n=r.querySelector('.wc-root');return{text:n.innerText,action:r.querySelector('[data-action="next"],[data-action="submit"]')?.dataset.action,phone:!!r.querySelector('input[type="tel"]'),overflow:n.scrollWidth>n.clientWidth+2||document.documentElement.scrollWidth>innerWidth};});
  const click=async selector=>{
   await page.evaluate(selector=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector(selector).scrollIntoView({block:'center'}),selector);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const p=await page.evaluate(selector=>{const b=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector(selector).getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};},selector);await page.mouse.click(p.x,p.y);
  };
  const states=[];let complete=false,backChecked=false,consentChecked=false;
  for(let step=0;step<6;step++){
   await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'));
   const before=await state();if(before.overflow)throw Error(id+': overflow');
   await page.screenshot({path:`${evidence}/${id}-${width}-${step}.png`,fullPage:true});states.push({step,action:before.action||null});
   if(!before.action){complete=true;break;}
   if(id==='repair-advice-request'&&step===1){
    await click('[data-action="back"]');await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('select')));
    const value=await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('select')).querySelector('select').value);if(value!=='chair')throw Error('Back lost selected repair item');backChecked=true;
    await click('[data-action="next"]');await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('input[type="email"]')));
   }
   if(before.action==='submit'){
    await click('[data-action="submit"]');
    if((await state()).action!=='submit')throw Error(id+': empty input bypassed');
   }
   if(before.phone){
    await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.lpi__trigger')));await click('.lpi__trigger');
    await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.lpi__search')));
    await page.evaluate(()=>{const s=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.lpi__search')).querySelector('.lpi__search');s.value='United Kingdom';s.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelectorAll('.lpi__option').length===1));
    await page.screenshot({path:`${evidence}/${id}-${width}-countries.png`});await click('.lpi__option[data-code="GB"]');
   }
   // Exercise invalid identifiers while preserving the same visible form.
   await page.evaluate(()=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'));for(const el of r.querySelectorAll('.wc-field input,.wc-consent input')){if(el.type==='email')el.value='invalid';else if(el.type==='tel')el.value='123';else if(el.type==='checkbox')el.checked=true;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}});
   if(before.action==='submit'){await click('[data-action="submit"]');if((await state()).action!=='submit')throw Error(id+': invalid identifier bypassed');}
   await page.evaluate(email=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'));for(const el of r.querySelectorAll('.wc-field input,.wc-field select,.wc-consent input')){
    if(el.type==='checkbox')el.checked=true;else if(el.tagName==='SELECT')el.selectedIndex=Math.min(1,el.options.length-1);else if(el.type==='email')el.value=email;else if(el.type==='tel')el.value='+447400123456';else if(el.type!=='hidden')el.value='Review example';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
   }
   // A question is answered with its first choice, as a visitor taking the quickest route would.
   const answered=new Set();for(const el of r.querySelectorAll('input[type="radio"]')){if(answered.has(el.name))continue;answered.add(el.name);el.checked=true;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
   },email);
   if(before.action==='submit'){
    const consent=await page.evaluate(()=>{const el=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector('.wc-consent input[required]');if(!el)return false;el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));return true;});
    if(consent){const sent=attempts;await click('[data-action="submit"]');if(attempts>sent||(await state()).action!=='submit')throw Error(id+': required consent bypassed');await page.evaluate(()=>{const el=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector('.wc-consent input');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});consentChecked=true;}
    // The journey's first submission fails once on purpose: the form must stay, keep the details and allow a retry.
    if(!failedOnce){
     await click('[data-action="submit"]');await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-error')?.textContent));
     if(!failedOnce)throw Error(id+': no submission was sent');
     if((await state()).action!=='submit')throw Error(id+': failed request left form');
     const value=await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector('input[type="email"],input[type="tel"]').value);if(!value.includes('@')&&!value.includes('7400'))throw Error('Retry lost details');
     await page.screenshot({path:`${evidence}/${id}-${width}-retry.png`,fullPage:true});
    }
   }
   const previous=(await state()).text;await click('[data-action="next"],[data-action="submit"]');
   await page.waitForFunction(previous=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-root')?.innerText!==previous&&!r.querySelector('[aria-busy="true"]')),previous);
  }
  if(!complete||errors.length)throw Error(id+': incomplete '+errors.join(';'));
  const resource=await page.locator('#configured-resource').getAttribute('href');const response=await context.request.get(resource);if(!response.ok()||!(await response.text()).includes('<h1'))throw Error(id+': resource unavailable');
  let copiedCode=false;
  if(id==='first-order-receipt'){await click('.wc-code + button');await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.textContent.includes('Copied')));if(await page.evaluate(()=>navigator.clipboard.readText())!=='REVIEW10')throw Error('Wrong copied code');copiedCode=true;await page.screenshot({path:`${evidence}/${id}-${width}-copied.png`,fullPage:true});}
  const link=await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector('a.wc-button')?.href);
  if(link){await click('a.wc-button');await page.waitForURL(link);}
  const form=states.some(s=>s.action==='submit');if(form&&!captures.some(c=>c.status===201&&c.body.id))throw Error(id+': no local Lead saved');
  if(id==='first-order-receipt'){
   const coupon=await context.request.get(`${base}/?wconvert_collection_approval=${id}&coupon_check=1`);const result=await coupon.json();if(!result.applied||Math.abs(result.discount-result.subtotal*0.1)>0.01)throw Error('Wrong coupon discount');
  }
  let localResourceEmail=false;
  if(['writing-checklist','reading-notes-guide','excerpt-window'].includes(id)){
   const outbox=await (await context.request.get(`${base}/?wconvert_collection_approval=${id}&outbox=1`)).json();
   if(!outbox.some(mail=>mail.to===email&&mail.message.includes(resource)))throw Error(id+': resource email not handed to local mail interceptor');
   localResourceEmail=true;
  }
  results.push({id,revision,width,passed:true,screens:states.length,validation:form,consentChecked,backChecked,simulatedFailureRetry:failedOnce,localLeadSaved:form,configuredResource:response.status(),actualCtaOpened:!!link,couponChecked:id==='first-order-receipt',copiedCode,localResourceEmail});
  }catch(error){results.push({id,revision,width,passed:false,failure:error.message.split('\n')[0]});await page?.screenshot({path:`${evidence}/${id}-${width}-failure.png`,fullPage:true}).catch(()=>{});}
  finally{save();await context.close();}
 }
 const failed=results.filter(row=>row.passed===false);
 console.log(`${results.filter(row=>row.passed).length} passed, ${failed.length} failed, ${results.filter(row=>row.skipped).length} skipped → ${output}`);
 for(const row of failed)console.log(`  ${row.id} @${row.width}: ${row.failure}`);
}finally{save();await browser.close();}

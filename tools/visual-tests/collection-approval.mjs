/** Configured, local-only visitor review for the non-commerce collection setups. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9453';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Disposable local site required');
const evidence=process.env.WCONVERT_REVIEW_EVIDENCE||'/tmp/collection-approvals-native';fs.mkdirSync(evidence,{recursive:true});
const commerce=['add-useful-extras','recommend-accessory','shopping-guidance','explore-compatible-extras','basket-cross-sells','coffee-taste-finder'];
const source=JSON.parse(fs.readFileSync('tools/design-library/collections/source.json'));
const selected=process.env.WCONVERT_REVIEW_IDS?.split(',');
const ids=[...new Set(source.collections.flatMap(c=>c.items.map(i=>i.setup_id)))].filter(id=>!commerce.includes(id)&&(!selected||selected.includes(id)));
const run=Date.now().toString(36);
const browser=await chromium.launch(),results=[];
try{
 for(const id of ids)for(const width of [320,1280]){
  console.log(id,width);
  const email=`review-${run}-${id}-${width}@example.test`;
  const context=await browser.newContext({viewport:{width,height:800},hasTouch:width===320});
  if(id==='first-order-receipt')await context.grantPermissions(['clipboard-read','clipboard-write']);
  await context.addCookies([{name:'wcv_test_consent',value:'allow',url:base}]);
  const page=await context.newPage(),errors=[],captures=[];let endpoint,failedOnce=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.reviewRoots=[];const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=attach.call(this,o);window.reviewRoots.push(r);return r;};});
  page.on('response',async r=>{if(r.url()===endpoint&&r.request().method()==='POST')captures.push({status:r.status(),body:await r.json()});});
  await page.goto(`${base}/?wconvert_collection_approval=${id}`);
  await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-root')));
  if(id==='sale-deadline')await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&/\d/.test(r.querySelector('.wc-countdown')?.textContent||'')));
  endpoint=await page.locator('#wconvert-payload').getAttribute('data-capture');
  await page.route(endpoint,async route=>{
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
   }},email);
   if(before.action==='submit'){
    const consent=await page.evaluate(()=>{const el=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector('.wc-consent input[required]');if(!el)return false;el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));return true;});
    if(consent){await click('[data-action="submit"]');if(failedOnce||(await state()).action!=='submit')throw Error(id+': required consent bypassed');await page.evaluate(()=>{const el=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector('.wc-consent input');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});consentChecked=true;}
    await click('[data-action="submit"]');await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-error')?.textContent));
    if((await state()).action!=='submit'||!failedOnce)throw Error(id+': failed request left form');
    const value=await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root')).querySelector('input[type="email"],input[type="tel"]').value);if(!value.includes('@')&&!value.includes('7400'))throw Error('Retry lost details');
    await page.screenshot({path:`${evidence}/${id}-${width}-retry.png`,fullPage:true});
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
  results.push({id,width,states,backChecked,consentChecked,localResourceEmail,validation:form,simulatedFailureRetry:failedOnce,localLeadSaved:form,configuredResource:response.status(),actualCtaOpened:!!link,couponChecked:id==='first-order-receipt',copiedCode,countdownConfigured:id==='sale-deadline',passed:true});fs.writeFileSync(`${evidence}/native.json`,JSON.stringify(results,null,2)+'\n');await context.close();
 }
 fs.writeFileSync(`${evidence}/native.json`,JSON.stringify(results,null,2)+'\n');console.log('Passed',results.length,'configured visitor journeys');
}finally{await browser.close();}

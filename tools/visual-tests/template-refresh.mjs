/** Run only against the disposable template-refresh.php / WooCommerce harness. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9453';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Disposable local site required');
const evidence=process.env.WCONVERT_REVIEW_EVIDENCE||'docs/reviews';fs.mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
await page.addInitScript(()=>{window.reviewRoots=[];const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=attach.call(this,o);window.reviewRoots.push(r);return r;};});
await page.context().addCookies([{name:'wcv_test_consent',value:'allow',url:base}]);
const visibleText=()=>page.evaluate(()=>window.reviewRoots.filter(r=>r.host.isConnected).map(r=>r.querySelector('.wc-root')?.innerText||'').join('\n'));
const reports=[]; const errors=[]; page.on('pageerror',e=>errors.push(e.message));
for(const id of ['add-useful-extras','recommend-accessory','shopping-guidance','explore-compatible-extras','basket-cross-sells','coffee-taste-finder']){
 console.log('Checking '+id);
 const response=await page.request.get(base+'/?wconvert_template_refresh='+id+'&json=1&refresh=1');
 const raw=await response.text();let entry;try{entry=JSON.parse(raw);}catch{throw Error(id+': '+raw.slice(-600));}
 await page.setViewportSize({width:1280,height:900});
 await page.goto(entry.url+'&basket=1');
 await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-root')));
 if(id==='coffee-taste-finder'){
  for(const [choice,heading,product] of [['bright','Start with bright and fruity','Bright coffee'],['smooth','Start with smooth and chocolatey','Smooth coffee'],['unsure','Explore a few different coffees','Explore coffee']]){
   await page.evaluate(choice=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('input[value="'+choice+'"]'));const el=r.querySelector('input[value="'+choice+'"]');el.click();r.querySelector('[data-action="next"]').click();},choice);
   await page.waitForFunction(product=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-products')?.textContent.includes(product)),product);
   if(!(await visibleText()).includes(heading)) throw Error('Wrong result '+choice);
   await page.screenshot({path:`${evidence}/october-live-${id}-${choice}.png`,fullPage:true});
   await page.setViewportSize({width:320,height:740});
   await page.screenshot({path:`${evidence}/october-live-${id}-${choice}-phone.png`,fullPage:true});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Result overflows phone: '+choice);
   const productUrl=await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-products')).querySelector('.wc-products a')?.href);
   if(!productUrl||!(await page.request.get(productUrl)).ok())throw Error('Unavailable result product: '+choice);
   await page.setViewportSize({width:1280,height:900});
   reports.push({id,choice,heading,product,desktopAndPhone:true,productLinkChecked:true,passed:true});
   await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('[data-action="back"]')).querySelector('[data-action="back"]').click());
  }
 }else if(id!=='shopping-guidance'){
  await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.textContent.includes('Reusable coffee filters')));
  if((await visibleText()).includes('Unavailable accessory'))throw Error('Out of stock product shown');
 }
 const ctaUrl=await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-root'))?.querySelector('a.wc-button,.wc-products a')?.href);
 if(ctaUrl&&!(await page.request.get(ctaUrl)).ok())throw Error('Unavailable action link: '+id);
 if(id==='shopping-guidance'&&!ctaUrl?.includes('collection-review-shopping-guide'))throw Error('Missing configured guide');
 await page.screenshot({path:`${evidence}/october-live-${id}-desktop.png`,fullPage:true});
 await page.setViewportSize({width:320,height:740});
 await page.screenshot({path:`${evidence}/october-live-${id}-phone.png`,fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow) throw Error(id+' overflows phone');
 if(id==='coffee-taste-finder'){
  const endpoint=new URL(await page.locator('#wconvert-payload').getAttribute('data-commerce-quiz'),base).href;
  await page.route(endpoint+'*',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.evaluate(()=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('input[value="bright"]'));r.querySelector('input[value="bright"]').click();r.querySelector('[data-action="next"]').click();});
  await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.textContent.includes('These products are unavailable')));
  const fallback=await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('[data-result-link]')).querySelector('[data-result-link]').href);
  if(!(await page.request.get(fallback)).ok())throw Error('Unavailable coffee fallback');
  await page.screenshot({path:`${evidence}/october-live-${id}-empty-phone.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:`${evidence}/october-live-${id}-empty-desktop.png`,fullPage:true});
  await page.unroute(endpoint+'*');
  reports.push({id,action:'simulated empty catalogue retains a working shop link',passed:true});
 }
 if(['add-useful-extras','basket-cross-sells'].includes(id)) {
  await page.evaluate(()=>{for(const r of window.reviewRoots.filter(r=>r.host.isConnected)){const b=[...r.querySelectorAll('button')].find(b=>b.textContent==='Add to cart');if(b){b.click();return;}}throw Error('No add button');});
  await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&/Added/.test(r.textContent)));
  reports.push({id,action:'confirmed WooCommerce basket addition',passed:true});
 }
 if(['basket-cross-sells','shopping-guidance'].includes(id)) {
  await page.goto(entry.url+'&basket=');
  await page.waitForTimeout(800);
  const shown=await page.evaluate(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.host.getBoundingClientRect().height>0&&r.querySelector('.wc-root')?.getBoundingClientRect().height>0));
  if(shown)throw Error(id+' shows for an empty basket');
  reports.push({id,action:'empty basket stays hidden',passed:true});
 }
 reports.push({id,action:'published and rendered on desktop and 320px',ctaLinkChecked:!!ctaUrl,passed:true});
}
await browser.close();if(errors.length)throw Error(errors.join('\n'));
fs.writeFileSync(`${evidence}/commerce-refresh-2026-10-12-live.json`,JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));

/** Live countdown checks on the disposable collection-approval WordPress fixture. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9453';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Disposable local WordPress required');
const output=process.env.WCONVERT_REVIEW_EVIDENCE||'docs/reviews/shopping-weekend-2026-10-22';
const entries=JSON.parse(fs.readFileSync('tools/design-library/out/pilot.json')).filter(e=>e.batch==='shopping-weekend-2026'&&JSON.stringify(e.tree).includes('"countdown"')&&(!process.env.WCONVERT_REVIEW_IDS||process.env.WCONVERT_REVIEW_IDS.split(',').includes(e.id)));
const browser=await chromium.launch(),results=[];
try{
 for(const entry of entries)for(const width of [320,1280]){
  const context=await browser.newContext({viewport:{width,height:850},hasTouch:width===320,permissions:['clipboard-read','clipboard-write']});
  await context.addCookies([{name:'wcv_test_consent',value:'allow',url:base}]);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.addInitScript(()=>{window.reviewRoots=[];const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=attach.call(this,o);window.reviewRoots.push(r);return r;};});

  await page.clock.install({time:new Date()});
  // Playwright's fake performance object omits navigation entries. Keep the
  // WordPress theme's DOM-ready check working while advancing the plugin clock.
  await page.route('**/wp-includes/js/dist/script-modules/interactivity/index.min.js*', async route => {
   const response = await route.fetch();
   const shim = 'const originalEntries = performance.getEntriesByType.bind(performance); performance.getEntriesByType = type => { const entries = originalEntries(type); return type === "navigation" && !entries.length ? [{ domContentLoadedEventStart: document.readyState === "loading" ? 0 : 1 }] : entries; };\n';
   await route.fulfill({ response, body: shim + await response.text() });
  });
  try{
   await page.goto(`${base}/?wconvert_collection_approval=${entry.id}`);
   await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-countdown')));
   const payload=await page.locator('#wconvert-payload').textContent();const live=JSON.parse(payload).find(e=>JSON.stringify(e.template).includes('"countdown"'));
   if(!Number.isFinite(live?.ends_at))throw Error('No real schedule deadline');
   const read=()=>page.evaluate(()=>{const r=window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-countdown'));const timer=r?.querySelector('.wc-countdown');return{time:timer?.textContent,daysHidden:timer?.querySelector('[data-unit="d"]')?.parentElement.hidden,overflow:r?.querySelector('.wc-root').scrollWidth>r?.querySelector('.wc-root').clientWidth+2};});
   await page.clock.runFor(1100);const before=await read();await page.clock.runFor(2200);const after=await read();
   if(!/\d/.test(before.time)||before.time===after.time||after.overflow)throw Error('Countdown did not tick or overflowed');
   // Reload the configured page, not the seeding route: it keeps the same saved campaign deadline.
   const url=await page.locator('#configured-resource').getAttribute('href');
   const inline=live.display_type==='inline';
   if(!inline){await page.goto(url);await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-countdown')));const reloaded=JSON.parse(await page.locator('#wconvert-payload').textContent()).find(e=>e.id===live.id);if(reloaded.ends_at!==live.ends_at)throw Error('Reload reset the deadline');}
   await page.clock.fastForward(live.ends_at-3600000-await page.evaluate(() => Date.now()));await page.clock.runFor(1100);const finalHour=await read();
   if(finalHour.daysHidden===false)throw Error('Zero days box still displayed');
   if(finalHour.overflow)throw Error('Final-hour clock overflowed');
   await page.screenshot({path:`${output}/${entry.id}-${width}-live-countdown.png`,fullPage:true});
   const hasCopy=await page.evaluate(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-code + button')));
   if(hasCopy){await page.evaluate(()=>window.reviewRoots.find(r=>r.host.isConnected&&r.querySelector('.wc-code + button')).querySelector('.wc-code + button').click());await page.waitForFunction(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.textContent.includes('Copied')));if(await page.evaluate(()=>navigator.clipboard.readText())!=='REVIEW10')throw Error('Wrong copied code');}
   await page.clock.fastForward(live.ends_at-1500-await page.evaluate(() => Date.now()));await page.clock.runFor(3000);
   const visible=await page.evaluate(()=>window.reviewRoots.some(r=>r.host.isConnected&&r.querySelector('.wc-root')?.getBoundingClientRect().height>0));
   if(visible)throw Error('Expired campaign remains visible on the open page');
   if(errors.length)throw Error(errors.join('; '));
   results.push({id:entry.id,width,passed:true,realDeadline:true,ticks:true,refreshPreservesDeadline:!inline,daysHide:true,copiedCode:hasCopy,expiresWhileOpen:true});
  }catch(e){console.error(entry.id,width,e.stack);results.push({id:entry.id,width,passed:false,error:e.message.split('\n')[0]});}
  finally{await context.close();fs.writeFileSync(`${output}/countdowns.json`,JSON.stringify({results},null,2)+'\n');}
 }
}finally{await browser.close();}
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;

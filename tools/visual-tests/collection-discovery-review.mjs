/** Review the real curated source through the shipping discovery model and WordPress. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base=process.env.WCONVERT_STUDIO_URL||'http://127.0.0.1:9452';
const wp=process.env.WCONVERT_TEMPLATE_REVIEW_URL||'http://127.0.0.1:9453';
for(const url of [base,wp])if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Local review sites required');
const evidence=process.env.WCONVERT_REVIEW_EVIDENCE||'/tmp/collection-approvals-discovery';fs.mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1420,height:960}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/collection-studio.html');
 await page.locator('#drafts').check();await page.locator('#placement').selectOption('browse');await page.locator('#plan').selectOption('pro');await page.locator('#day').fill('2026-11-06');await page.locator('#day').dispatchEvent('change');
 const records=await page.evaluate(()=>[...document.querySelectorAll('#collections article')].map(article=>({title:article.querySelector('h2').textContent,facts:article.querySelector('small').textContent})));
 if(records.length!==6)throw Error('Expected six review collections');
 await page.screenshot({path:evidence+'/overview.png',fullPage:true});
 for(let i=0;i<records.length;i++){
  await page.locator('#collections article button').nth(i).click();
  records[i].screens=await page.locator('#proofs .frame').count();
  if(!records[i].screens)throw Error('Collection has no prepared screens');
  await page.screenshot({path:`${evidence}/collection-${i+1}.png`});
 }
 const calendar=[];
 for(const [day,placement,expected]of [['2026-10-15','featured',false],['2026-10-15','browse',true],['2026-10-16','featured',true],['2026-11-27','featured',true],['2026-12-01','browse',false]]){
  await page.locator('#day').fill(day);await page.locator('#day').dispatchEvent('change');await page.locator('#placement').selectOption(placement);
  const visible=await page.locator('#collections').getByRole('heading',{name:'Prepare for Black Friday'}).count();if(!!visible!==expected)throw Error('Wrong event boundary '+day);
  calendar.push({day,placement,visible:!!visible,passed:true});
 }
 await page.locator('#day').fill('2026-11-06');await page.locator('#day').dispatchEvent('change');await page.locator('#plan').selectOption('free');
 const free=await page.locator('#collections article').count();if(free!==5||await page.locator('#collections').getByRole('heading',{name:'Help shoppers choose'}).count())throw Error('Free collection recommendations must exclude setups requiring Pro');
 const native=await (await page.request.get(wp+'/?wconvert_collection_approval=edition-early-access&discovery=1')).json();
 if(native.status!==200||!native.campaigns_unchanged||(!process.argv.includes('--candidate')&&native.data.collections.length!==6))throw Error('WordPress discovery changed campaigns or lost collections');
 if(errors.length)throw Error(errors.join(';'));
 fs.writeFileSync(evidence+'/discovery.json',JSON.stringify({records,calendar,freeUsableCollections:free,native:{status:native.status,collections:native.data.collections.map(c=>c.id),campaignsUnchanged:native.campaigns_unchanged},errors},null,2)+'\n');
 console.log(process.argv.includes('--candidate') ? 'Six candidate collections, prepared screens, event boundaries and Free availability passed; published WordPress membership still requires verification.' : 'Six published collections, prepared screens, event boundaries, Free availability and native discovery passed');
}finally{await browser.close();}

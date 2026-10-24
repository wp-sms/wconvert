import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {bundledFontComparison} from './bundled-fonts.mjs';
import {carriedRecords} from './visual-diff.mjs';
const root=resolve(import.meta.dirname,'../../..');

test('comparison embeds the shipping fonts, scopes declarations, and actually loads offline',async()=>{
 const fonts=bundledFontComparison(root),entry={tree:{fonts:[{family:'DM Sans'},{family:'Cormorant Garamond'}]}};
 const css=fonts.cssFor(entry);
 assert.equal(fonts.files.length,4);
 assert.match(css,/data:font\/woff2;base64/);
 assert.doesNotMatch(css,/Bebas Neue|https?:/);
 assert.equal(fonts.cssFor({tree:{fonts:[{family:'Creepster'}]}}),'');
 const browser=await chromium.launch();try{
  const page=await browser.newPage();let requests=0;
  await page.route('**/*',route=>{requests++;return route.abort();});
  await page.setContent(`<style>${css}</style><p style='font-family:"DM Sans";font-weight:950'>Black Friday</p><p style='font-family:"Cormorant Garamond";font-style:italic'>Private preview</p>`);
  const loaded=await page.evaluate(async()=>{await document.fonts.ready;return [...document.fonts].filter(f=>f.status==='loaded').map(f=>[f.family,f.style]);});
  assert.ok(loaded.some(([f])=>f==='DM Sans'));
  assert.ok(loaded.some(([f,s])=>f==='Cormorant Garamond'&&s==='italic'));
  assert.equal(requests,0);
 }finally{await browser.close();}
});

test('carried evidence states the font comparison boundary',()=>{
 const [record]=carriedRecords({carried:['a'],entries:[{id:'a',revision:'new'}],store:{records:[{id:'a',record_id:'old',decision:'approved',checks:{}}]},base:'baseline',at:'2026-10-24T00:00:00Z',fontComparison:'Same local fonts; historical delivery is not certified. '});
 assert.match(record.note,/historical delivery is not certified/);
 assert.equal(record.base_id,'old');
});

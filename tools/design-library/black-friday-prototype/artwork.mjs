/** Render original decorative vectors from this prototype, without any campaign copy. */
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('./reference/designs.js.txt',import.meta.url),'utf8'),context);
const face=colour=>vm.runInContext(`face('${colour}')`,context).replace(/currentColor/g,'#413251');
const flower=colour=>vm.runInContext(`flower('${colour}')`,context);
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const inner=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const drawings={
 'fidelity-face':svg(120,120,inner(face('#fff1a8'))),
 'fidelity-flowers':svg(430,300,`<g transform="translate(0 100) scale(.86)">${inner(flower('#ef779c'))}</g><g transform="translate(125 15) scale(1.14)">${inner(flower('#b7a0e7'))}</g><g transform="translate(280 100) scale(.86)">${inner(flower('#fa9754'))}</g>`),
 'fidelity-door':svg(300,400,'<defs><linearGradient id="door"><stop stop-color="#6f345d"/><stop offset=".48" stop-color="#7b385f"/><stop offset=".5" stop-color="#ffe7af"/><stop offset=".72" stop-color="#be7e68"/><stop offset="1" stop-color="#70405e"/></linearGradient></defs><path d="M35 385V160a115 115 0 0 1 230 0v225Z" fill="url(#door)" stroke="#68405d" stroke-width="12"/><path d="M150 51v333" stroke="#ffe7af" stroke-width="2"/>'),
 'fidelity-bubbles':svg(170,110,`<defs><radialGradient id="bubble" cx="35%" cy="30%"><stop stop-color="#fff"/><stop offset=".5" stop-color="#f4ebff"/><stop offset=".9" stop-color="#b9a8d1"/><stop offset="1" stop-color="#e9ddf6"/></radialGradient></defs>${[0,1,2,3,4,5].map(i=>`<circle cx="${29+(i%3)*55}" cy="${28+Math.floor(i/3)*54}" r="24" fill="url(#bubble)" stroke="#a597b5"/>`).join('')}`),
 'fidelity-pixels':svg(640,140,['#e57da8','#f3c365','#b19bdd','#84b5a0'].map((colour,i)=>`<g transform="translate(${30+i*160} 5)"><path d="M0 65h90v65H0Z" fill="#263b65"/><path d="M15 12h45v15h15v78H15V45H5V30h10Z" fill="${colour}"/><path d="M24 44h8v8h-8Zm28 0h8v8h-8ZM30 70h20v5H30Z" fill="#263b65"/></g>`).join('')),
 'fidelity-balloons':svg(800,300,`<g transform="translate(15 5)">${inner(face('#ffc289'))}<path d="M60 115v170" stroke="#413251"/></g><g transform="translate(665 5)">${inner(face('#b9a5f0'))}<path d="M60 115v170" stroke="#413251"/></g>`),
 'fidelity-globe':svg(120,120,'<g fill="none" stroke="#e7dac2" stroke-width="1.5"><circle cx="60" cy="60" r="52"/><ellipse cx="60" cy="60" rx="29" ry="52"/><ellipse cx="60" cy="60" rx="52" ry="23"/><path d="M8 60h104M60 8v104"/></g>'),
};
const directory=new URL('../pilot/assets/black-friday/',import.meta.url);
const catalogueFile=new URL('../publishing/catalog.json',import.meta.url);
const catalogue=JSON.parse(fs.readFileSync(catalogueFile));
const browser=await chromium.launch();
try{const page=await browser.newPage({deviceScaleFactor:2});for(const [name,art] of Object.entries(drawings)){
 fs.writeFileSync(new URL(name+'.svg',directory),art);
 await page.setContent(`<style>body{margin:0;background:transparent}svg{display:block}</style>${art}`);
 const png=await page.locator('svg').first().screenshot({omitBackground:true});
 fs.writeFileSync(new URL(name+'.png',directory),png);
 catalogue.image_rights[crypto.createHash('sha256').update(png).digest('hex')]={kind:'original',source:'Original WConvert prototype vectors; black-friday-prototype/artwork.mjs and reference/designs.js.txt.',redistribution:true,reviewedBy:'Codex, original artwork provenance, 2026-10-24',access:'free'};
}}finally{await browser.close();}
fs.writeFileSync(catalogueFile,JSON.stringify(catalogue,null,2)+'\n');

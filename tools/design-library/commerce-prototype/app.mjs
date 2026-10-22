import { designs, composition } from './designs.mjs';
const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
const formats = ['All formats', 'Popup', 'Floating bar', 'Slide-in', 'Inline', 'Fullscreen'];
let eventFilter = 'All occasions';
let formatFilter = 'All formats';
const validWidth = value => ['390','320'].includes(value) ? value : 'desktop';
let width = validWidth(params.get('width'));
let thumbObserver;
let success = params.get('screen') === 'ack';
const find = id => designs.find(d => d.id === id) || designs[0];
const url = values => `?${new URLSearchParams(values)}`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function brand() { return `<a class="brand" href="./"><span class="brand-mark">w.</span>wconvert<span class="brand-separator">/</span><span class="brand-label">Design explorations</span></a>`; }
function gallery() {
  document.body.className = 'studio';
  app.innerHTML = `<header class="studio-header">${brand()}<span class="prototype-tag">INTERACTIVE PROTOTYPE</span></header><main class="gallery-main"><div class="collection-intro"><div><p class="overline">COLLECTION NO. 02 · THE SHOPPING WEEKEND</p><h1>The biggest weekend.<br><em>Fifteen ways in.</em></h1></div><div class="intro-aside"><span class="sparkle">✳</span><p>Black Friday & Cyber Monday.<br>15 distinct designs. 5 formats.<br>A little more personality, everywhere.</p></div></div><div class="gallery-toolbar"><div class="occasion-tabs" aria-label="Occasion">${['All occasions','Black Friday','Cyber Monday'].map(e=>`<button data-event="${e}" class="${e===eventFilter?'active':''}" aria-pressed="${e===eventFilter}">${e}</button>`).join('')}</div><div class="format-control"><label for="format">Format</label><select id="format">${formats.map(f=>`<option ${f===formatFilter?'selected':''}>${f}</option>`).join('')}</select><span id="count"></span></div></div><div class="design-grid"></div><footer class="gallery-footer"><span>Made for a good first impression.</span><span>Concepts only · offers are examples · no data is sent</span></footer></main>`;
  populate();
  document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>{eventFilter=b.dataset.event;gallery();});
  document.querySelector('#format').onchange=e=>{formatFilter=e.target.value;populate();};
}
function populate() {
  thumbObserver?.disconnect();
  const list=designs.filter(d=>(eventFilter==='All occasions'||d.event===eventFilter)&&(formatFilter==='All formats'||d.format===formatFilter));
  document.querySelector('#count').textContent=`${list.length} designs`;
  document.querySelector('.design-grid').innerHTML=list.map(d=>`<a class="design-card" href="${url({variant:d.id})}" aria-label="Explore ${d.name}, ${d.format}"><div class="thumbnail theme-${d.theme}"><iframe title="${d.name} preview" src="${url({render:d.id,thumb:'1'})}" tabindex="-1" loading="lazy" inert></iframe><span class="card-open" aria-hidden="true">↗</span></div><div class="card-meta"><span class="design-number">${d.id}</span><div><h2>${d.name}</h2><p>${d.event} <span>·</span> ${d.format}</p></div><span class="card-type">${d.action==='email'?'SIGNUP':'OFFER'}</span></div></a>`).join('');
  document.querySelectorAll('.design-card').forEach(a=>a.onclick=e=>{e.preventDefault();history.pushState({},'',a.href);success=false;viewer();window.scrollTo(0,0);});
  // Every card shares the same grid track width.
  thumbObserver=new ResizeObserver(entries=>entries.forEach(({target,contentRect})=>target.style.setProperty('--thumb-scale',contentRect.width/900)));
  document.querySelectorAll('.thumbnail').forEach(el=>thumbObserver.observe(el));
}
function viewer() {
  thumbObserver?.disconnect();
  const d=find(new URLSearchParams(location.search).get('variant'));
  document.body.className='studio viewer-page';
  app.innerHTML=`<header class="studio-header">${brand()}<a href="./" class="back-gallery">↖ All designs</a></header><div class="viewer-layout"><aside class="design-rail"><p class="overline">THE COLLECTION <span>15</span></p>${designs.map(item=>`<button class="rail-item ${item.id===d.id?'selected':''}" data-variant="${item.id}"><span class="swatch theme-${item.theme}">${item.id}</span><span><b>${item.name}</b><small>${item.format} · ${item.event==='Black Friday'?'BF':'CM'}</small></span>${item.id===d.id?'<span class="rail-dot"></span>':''}</button>`).join('')}</aside><main class="viewer-main"><div class="viewer-title"><div><p class="overline">${d.event.toUpperCase()} / ${d.format.toUpperCase()}</p><h1>${d.name}</h1></div><span class="prototype-tag">${d.action==='email'?'EMAIL SIGNUP':'CLICK-THROUGH OFFER'}</span></div><div class="preview-toolbar"><div class="segmented" aria-label="Preview width">${[['desktop','Desktop'],['390','390 px'],['320','320 px']].map(([v,label])=>`<button data-width="${v}" class="${width===v?'active':''}" aria-pressed="${width===v}">${label}</button>`).join('')}</div><div class="screen-controls">${d.action==='email'?`<div class="segmented"><button data-screen="offer" class="${!success?'active':''}">Signup</button><button data-screen="ack" class="${success?'active':''}">Acknowledgement</button></div>`:''}<button class="reset-button" id="reset">↻ Reset</button></div></div><div class="preview-well"><div class="browser-frame ${width==='desktop'?'wide':'phone'}" style="--device-width:${width==='desktop'?'100%':width+'px'}"><div class="browser-chrome"><span>● ● ●</span><span>studio.example / your-store</span><span>↗</span></div><iframe id="preview" title="Interactive ${d.name} preview" src="${url({render:d.id,...(success?{screen:'ack'}:{})})}"></iframe></div></div><div class="design-notes"><p>${d.note}</p><details><summary>Design & implementation notes</summary><p>${d.mapping}</p><p>HTML concept for review. Re-author approved designs in the WConvert vocabulary; this is not an importable template. ${d.timer?'Clock is frozen sample data, never an evergreen timer. ':''}Actions are simulated; inputs stay in this frame and are never saved.</p></details><span id="preview-status" role="status">${success?'Acknowledgement':'Initial screen'} · ${width==='desktop'?'Responsive desktop':width+' px'} · demo interactions enabled</span></div></main></div><nav class="variant-switcher" aria-label="Switch design"><button data-step="-1" aria-label="Previous design">←</button><span><b>${d.id} / 15</b> ${d.name}</span><button data-step="1" aria-label="Next design">→</button></nav>`;
  document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>select(b.dataset.variant));
  document.querySelectorAll('[data-width]').forEach(b=>b.onclick=()=>{width=b.dataset.width;syncUrl(d.id);viewer();});
  document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>{success=b.dataset.screen==='ack';syncUrl(d.id);viewer();});
  document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>step(Number(b.dataset.step)));
  document.querySelector('#reset').onclick=()=>{success=false;syncUrl(d.id);viewer();};
}
function syncUrl(id) {history.replaceState({},'',url({variant:id,...(width!=='desktop'?{width}:{}),...(success?{screen:'ack'}:{})}));}
function select(id) {success=false;history.pushState({},'',url({variant:id,...(width!=='desktop'?{width}:{})}));viewer();}
function step(delta) {const current=find(new URLSearchParams(location.search).get('variant'));select(designs[(designs.indexOf(current)+delta+designs.length)%designs.length].id);}
const storePage = `<div class="store-page" aria-hidden="true"><div class="store-banner">Thoughtful things for everyday living.</div><div class="store-header"><strong>form & field</strong><span>Objects &nbsp;&nbsp; Living &nbsp;&nbsp; Journal</span><span>Bag (0)</span></div><div class="store-hero"><p>THE EVERYDAY, RECONSIDERED</p><h2>Make room<br>for the good things.</h2><span>Discover the collection ↗</span><div class="store-shape"></div></div><div class="store-products"><div><span>Objects with purpose</span></div><div><span>For the everyday</span></div><div><span>Made to stay</span></div></div></div>`;
function renderCampaign() {
  const d=find(params.get('render'));
  const thumb=params.has('thumb');
  document.body.className=`campaign-page ${thumb?'is-thumbnail':''} format-${d.format.toLowerCase().replaceAll(' ','-')}`;
  app.innerHTML=`${thumb?'':storePage}<div class="campaign-stage"><article class="campaign theme-${d.theme} ${success?'is-ack':''}" aria-label="${d.name}">${d.format!=='Inline'?'<button class="dismiss" data-dismiss type="button" aria-label="Dismiss offer">×</button>':''}${composition(d,success)}</article></div><div class="demo-feedback" role="status" hidden></div>`;
  const notify=message=>{if(parent!==window)parent.postMessage({type:'commerce-demo',id:d.id,message},location.origin);};
  document.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=()=>{document.querySelector('.campaign-stage').hidden=true;feedback('Offer dismissed.',true);notify('Dismissed · use Reset to reopen');});
  const form=document.querySelector('form');
  if(form) form.onsubmit=e=>{e.preventDefault();success=true;renderCampaign();notify('Request received · demo only, no details saved');};
  document.querySelectorAll('[data-offer]').forEach(b=>b.onclick=()=>{feedback('Offer preview opened. This is a sample destination.',true);notify('Offer clicked · sample destination');});
  document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try {await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied';notify(`Copied ${d.code}`);}catch {b.textContent='Select code';feedback(`Sample code: ${d.code}`);}});
  function feedback(message, reopen=false) {const box=document.querySelector('.demo-feedback');box.hidden=false;box.innerHTML=`<span>${esc(message)}</span>${reopen?'<button type="button">Back to design</button>':''}`;box.querySelector('button')?.addEventListener('click',()=>renderCampaign());}
  if(!thumb) window.onkeydown=e=>{if(e.key==='Escape'&&d.format!=='Inline')document.querySelector('[data-dismiss]')?.click();};
}
if(params.has('render')) renderCampaign();
else {
  const route=()=>new URLSearchParams(location.search).has('variant')?viewer():gallery();
  route();
  window.onpopstate=()=>{const p=new URLSearchParams(location.search);width=validWidth(p.get('width'));success=p.get('screen')==='ack';route();};
  window.onkeydown=e=>{if(!new URLSearchParams(location.search).has('variant')||e.target.closest('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}};
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===document.querySelector('#preview')?.contentWindow&&e.data?.type==='commerce-demo'){document.querySelector('#preview-status').textContent=e.data.message;if(e.data.message.startsWith('Request received')){success=true;syncUrl(e.data.id);document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen==='ack'));}}});
}

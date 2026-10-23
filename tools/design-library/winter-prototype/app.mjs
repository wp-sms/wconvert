import { decorate, DECORATION_CSS } from '../../../resources/renderer/src/decorations.ts';
// THROWAWAY DESIGN PROTOTYPE: 40 concepts on one route, ?variant=01…40.
// No WordPress API, subscriptions, campaign writes or storage.
import { designs, composition, esc } from './designs.mjs';
const app=document.querySelector('#app');
const q=()=>new URLSearchParams(location.search);
const find=id=>designs.find(d=>d.id===id)||designs[0];
const categories=['All designs','Gifting','Signup','Last-minute','New Year','Holiday info'];
const formats=['All formats','Popup','Slide-in','Inline','Floating bar','Fullscreen'];
let category='All designs',format='All formats',plan='All plans',search='',onlyClock=false,onlyMotion=false,phoneGallery=false;
let observer;
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused=prefersReduced;
const href=params=>`?${new URLSearchParams(params)}`;
const brand=()=>`<a class="brand" href="./"><b>w.</b><span>wconvert <i>/</i> design explorations</span></a>`;
const badge=d=>`<span class="plan ${d.tier.toLowerCase()}">${d.tier}</span>`;
const tags=d=>`${badge(d)}<span class="chip">${d.format}</span>${d.timer?'<span class="chip">◷ Countdown</span>':''}${d.motion?'<span class="chip">✦ Motion</span>':''}`;
function gallery(){
 document.body.className='studio';observer?.disconnect();
 app.innerHTML=`<header class="studio-header">${brand()}<span class="prototype-label">PROTOTYPE · COLLECTION 03</span></header><main class="gallery-main"><section class="intro"><div><p class="overline">CHRISTMAS & NEW YEAR / 2026—27</p><h1>A season of<br><em>small wonders.</em></h1><p class="intro-copy">${designs.length} invitations to give, gather, and begin again.<br>A new collection of little moments, made for every screen.</p><a class="playful-link" href="?variant=36">New: meet the playful five ↗</a><div class="intro-stats"><span><b>${designs.filter(d=>d.tier==='Pro').length}</b> Pro</span><span><b>${designs.filter(d=>d.tier==='Free').length}</b> Free</span><span><b>${designs.filter(d=>d.timer).length}</b> countdowns</span><span><b>${designs.filter(d=>d.motion).length}</b> with motion</span></div></div><div class="intro-art" aria-hidden="true"><div class="hero-star">✳</div><div class="hero-ribbon"></div><div class="hero-note">A little joy.<br><em>Everywhere.</em><span>THE WINTER COLLECTION</span></div><span class="hero-spark">✦</span></div></section><section class="browse" aria-label="Browse designs"><nav class="category-tabs" aria-label="Theme">${categories.map(c=>`<button data-category="${c}" aria-pressed="${category===c}">${c}</button>`).join('')}</nav><div class="filters"><label class="search"><span>Search designs</span><input id="search" type="search" value="${esc(search)}" placeholder="Find a little inspiration…"></label><label><span>Format</span><select id="format">${formats.map(f=>`<option ${format===f?'selected':''}>${f}</option>`).join('')}</select></label><label><span>Plan</span><select id="plan">${['All plans','Pro','Free'].map(f=>`<option ${plan===f?'selected':''}>${f}</option>`).join('')}</select></label><label class="check-filter"><input id="clock" type="checkbox" ${onlyClock?'checked':''}>Countdown</label><label class="check-filter"><input id="motion" type="checkbox" ${onlyMotion?'checked':''}>Motion</label><button id="gallery-width" class="small-button" aria-pressed="${phoneGallery}">${phoneGallery?'▣ Desktop thumbnails':'▯ Mobile thumbnails'}</button></div><div class="result-line"><p id="result-count" role="status"></p><p>Open a design to compare desktop + mobile ↗</p></div><div class="design-grid"></div></section><section class="collection-note"><p class="overline">HOW THIS BATCH FITS THE LIBRARY</p><h2>One collection.<br><em>Five reasons to visit.</em></h2><p>Christmas & New Year brings all ${designs.length} designs together. Browse gifting, signup, last-minute, New Year, and holiday information. Every design is visible before installation, with Pro clearly marked. The 10 Free designs are intended as individual online downloads.</p><p>Motion uses the existing sparkle and blinking-eyes decorations. Meet the five playful additions, designs 36–40. Artwork stays replaceable; all words, offers, fields and countdowns remain editable in the proposed editor versions.</p></section><footer class="gallery-footer"><span>Made for the moments in between.</span><span>Concepts only · no data is saved or sent</span></footer></main>`;
 populate();
 document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;gallery();});
 document.querySelector('#search').oninput=e=>{search=e.target.value;populate();};
 document.querySelector('#format').onchange=e=>{format=e.target.value;populate();};
 document.querySelector('#plan').onchange=e=>{plan=e.target.value;populate();};
 document.querySelector('#clock').onchange=e=>{onlyClock=e.target.checked;populate();};
 document.querySelector('#motion').onchange=e=>{onlyMotion=e.target.checked;populate();};
 document.querySelector('#gallery-width').onclick=()=>{phoneGallery=!phoneGallery;gallery();};
}
function populate(){
 observer?.disconnect();const list=designs.filter(d=>(category==='All designs'||d.category===category)&&(format==='All formats'||d.format===format)&&(plan==='All plans'||d.tier===plan)&&(!onlyClock||d.timer)&&(!onlyMotion||d.motion)&&`${d.name} ${d.category}`.toLowerCase().includes(search.toLowerCase()));
 document.querySelector('#result-count').textContent=`${list.length} designs · ${list.filter(d=>d.tier==='Pro').length} Pro / ${list.filter(d=>d.tier==='Free').length} Free`;
 document.querySelector('.design-grid').innerHTML=list.map(d=>`<a href="${href({variant:d.id})}" class="design-card" aria-label="Explore ${d.id}: ${d.name}"><div class="thumbnail ${phoneGallery?'phone-thumbnail':''}"><iframe title="${d.name} ${phoneGallery?'mobile':'desktop'} preview" src="${href({render:d.id,thumb:'1',motion:'off',width:phoneGallery?'390':'desktop'})}" loading="lazy" tabindex="-1" inert></iframe><span class="card-open">↗</span></div><div class="card-meta"><span class="design-index">${d.id}</span><div><h2>${d.name}</h2><p>${d.category} · ${d.format}</p></div>${badge(d)}</div><div class="card-features"><span>${d.signup?'EMAIL + ACKNOWLEDGEMENT':'OFFER / INFORMATION'}</span><span>${d.timer?'◷ ':''}${d.motion?'✦ ':''}</span></div></a>`).join('')||'<p class="empty">No designs match these filters.</p>';
 document.querySelectorAll('.design-card').forEach(a=>a.onclick=e=>{e.preventDefault();history.pushState({},'',a.href);viewer();scrollTo(0,0);});
 observer=new ResizeObserver(es=>es.forEach(({target,contentRect})=>{const vw=phoneGallery?390:1000,vh=phoneGallery?900:800;const scale=Math.min(contentRect.width/vw,contentRect.height/vh);target.style.setProperty('--scale',scale);target.style.setProperty('--frame-width',`${vw}px`);target.style.setProperty('--frame-height',`${vh}px`);}));
 document.querySelectorAll('.thumbnail').forEach(el=>observer.observe(el));
}
function viewer(){
 observer?.disconnect();document.body.className='studio viewer-page';const d=find(q().get('variant'));const phone=q().get('phone')==='320'?'320':'390';const ack=q().get('screen')==='ack';
 app.innerHTML=`<header class="studio-header">${brand()}<a class="back" href="./">↖ All ${designs.length} designs</a></header><main class="viewer"><section class="viewer-heading"><div><p class="overline">${d.id} / ${d.category.toUpperCase()}</p><h1>${d.name}</h1><div class="design-tags">${tags(d)}</div></div><div class="viewer-controls">${d.signup?`<fieldset><legend>Screen</legend><button data-screen="signup" aria-pressed="${!ack}">Signup</button><button data-screen="ack" aria-pressed="${ack}">Acknowledgement</button></fieldset>`:''}<fieldset><legend>Phone width</legend>${['390','320'].map(w=>`<button data-phone="${w}" aria-pressed="${phone===w}">${w}px</button>`).join('')}</fieldset><button class="small-button" id="pause" aria-pressed="${paused}">${paused?'▶ Play motion':'Ⅱ Pause motion'}</button>${d.timer?'<button class="small-button" id="expire">Preview expiry</button>':''}</div></section><div class="dual-preview"><section class="desktop-preview"><div class="frame-caption"><span>DESKTOP</span><span>1000 × 800</span></div><div class="preview-frame desktop-frame"><iframe title="${d.name} desktop" src="${href({render:d.id,screen:ack?'ack':'signup',motion:paused?'off':'on'})}"></iframe></div></section><section class="mobile-preview"><div class="frame-caption"><span>MOBILE</span><span>${phone} × 844</span></div><div class="preview-frame phone-frame" data-phone="${phone}"><iframe title="${d.name} mobile" src="${href({render:d.id,width:phone,screen:ack?'ack':'signup',motion:paused?'off':'on'})}"></iframe></div></section></div><section class="design-notes"><div><p class="overline">THE IDEA</p><p>${concept[d.id]||'A considered seasonal layout with live text, a clear action and artwork kept separate from the message.'}</p></div><div><p class="overline">IN THE EDITOR</p><p>Editable headline, body and ${d.signup?'email form + acknowledgement':'link action'}.${d.timer?' Native countdown tied to the campaign’s end date.':''}${d.motion?(d.id==='39'?' Optional blinking eyes and sparkles. Hide the decoration group when changing the character artwork.':' Optional floating / twinkling sparkles; respects reduced motion.'):''} Artwork uses normal image blocks: replace the whole image or remove it. All text stays editable.</p></div><div><p class="overline">PROTOTYPE NOTES</p><p>${d.timer?'The clock uses a fixed example deadline, not a per-visitor timer. ':''}${d.signup?(d.reward?'Try the form to reveal the example code. No address is sent or saved.':'Try the monthly newsletter signup. No coupon is promised and no address is sent or saved.'):'Buttons demonstrate the action; no shop or external service is connected.'} ${d.tier==='Free'?'Proposed Free delivery: individual online download.':'Proposed delivery: Pro library.'}</p></div></section></main><nav class="variant-switcher" aria-label="Design switcher"><button id="prev" aria-label="Previous design">←</button><select id="variant" aria-label="Choose a design">${designs.map(x=>`<option value="${x.id}" ${x.id===d.id?'selected':''}>${x.id} — ${x.name}</option>`).join('')}</select><span>${d.id} / ${designs.length}</span><button id="next" aria-label="Next design">→</button></nav>`;
 const change=(key,value)=>{const p=q();p.set(key,value);history.replaceState({},'',`?${p}`);viewer();};
 document.querySelectorAll('[data-phone]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>change('phone',b.dataset.phone);});
 document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>change('screen',b.dataset.screen));
 document.querySelector('#pause').onclick=()=>{paused=!paused;viewer();};
 document.querySelector('#expire')?.addEventListener('click',()=>document.querySelectorAll('iframe').forEach(f=>f.contentWindow.postMessage({type:'winter-expire'},location.origin)));
 document.querySelector('#variant').onchange=e=>{const p=q();p.set('variant',e.target.value);p.delete('screen');history.pushState({},'',`?${p}`);viewer();};
 document.querySelector('#prev').onclick=()=>cycle(-1);document.querySelector('#next').onclick=()=>cycle(1);
 observer=new ResizeObserver(es=>es.forEach(({target,contentRect})=>{const isPhone=target.classList.contains('phone-frame'),vw=isPhone?Number(phone):1000,vh=isPhone?844:800;const scale=Math.min(1,contentRect.width/vw);target.style.setProperty('--frame-width',`${vw}px`);target.style.setProperty('--frame-height',`${vh}px`);target.style.setProperty('--scale',scale);target.style.height=`${vh*scale}px`;}));
 document.querySelectorAll('.preview-frame').forEach(e=>observer.observe(e));
}
function cycle(step){if(!q().has('variant'))return;const index=designs.indexOf(find(q().get('variant')));const p=q();p.set('variant',designs[(index+step+designs.length)%designs.length].id);p.delete('screen');history.replaceState({},'',`?${p}`);viewer();}
const concept={
'01':'A tailored ribbon-and-paper split: lush red illustration, quiet cream copy. An invitation to gift, not another discount poster.',
'02':'A generous little gift icon above a bold, live 15% offer. Soft pink and bottle green keep an approachable Free design distinctive.',
'03':'An illustrated village forms the lower half of an expansive winter scene. The headline and action stay above the artwork.',
'04':'Hanging ornaments and warm rose colours make a countdown feel festive. Four subtle sparkles move independently of the message.',
'05':'A generous illustrated tree beside a concise gift-guide invitation. A useful, unhurried inline placement.',
'06':'Candlelight above a compact signup, in wine and warm wax tones. Art becomes a short banner on a phone.',
'07':'Three editorial zones: a typographic introduction, geometric gift art, and a simple invitation. A brighter alternative to red-and-green.',
'08':'An orderly little list pairs with an open, spacious form. Typographic hierarchy does the work without a decorative image.',
'09':'A ribbon-inspired bar with a compact countdown and a single gift-wrap offer. The entire row rearranges on mobile.',
'10':'A botanical image pane and a centred gift invitation form a simple two-pane fullscreen layout. The end date is explicit and both panes stay in the mobile reading order.',
'11':'A personal letter with a simple red top border and a serif sign-off. The postage icon is removed; every word stays editable.',
'12':'A winter postcard: illustrated landscape on one side, address-side signup on the other. A clear vertical reading order on phones.',
'13':'A snowglobe illustration and floating stars lead into an intimate dark-blue signup. The globe itself stays still.',
'14':'A replaceable flower image, warm cream and red ink. A monthly gift-ideas signup without a discount or reward screen dependency.',
'15':'An intimate, ink-brown corner card with a clear welcome offer and a fine divider. The email field stays transparent against the ground.',
'16':'A sunrise illustration above a signup deadline. A clear request with warm peach tones, avoiding aggressive urgency.',
'17':'An advent-inspired illustration beside the signup. The decorative tiles are one replaceable image, with no custom grid controls or pretend calendar interaction.',
'18':'An illustrated book cover beside a bookshop invitation. Muted green and brick red create a winter reading-room mood.',
'19':'A text-led bar keeps the delivery deadline compact on phones. The notice refers to dispatch, never an unsupported arrival guarantee.',
'20':'An inset paper card framed in gift red. A narrow ribbon illustration introduces a prominent ordering countdown.',
'21':'A large editable calendar date and a delivery information panel. The order cutoff becomes the primary visual idea.',
'22':'An editable “Digital gift cards” heading introduces a gift-card message. The real end date supplies urgency; the design no longer implies an eleventh-hour deadline.',
'23':'An entirely typographic countdown card with soft blue paper and a live coupon. A Free option for genuine last-minute deadlines.',
'24':'A deliberately practical pickup strip: a clear click-and-collect heading, collection details, compact clock and one action.',
'25':'A large ornament panel meets an oversized Christmas finale headline. Sparkles float at the edge; the clock stays steady.',
'26':'Layered sunrise artwork, softened edges and a gentle invitation to start again. No pressure, productivity promises or huge sale numbers.',
'27':'A dramatic two-column “Hello, tomorrow” title and an uncluttered inline form. The oversized arrow is removed. Pale yellow and plum make it feel optimistic.',
'28':'A midnight botanical garden with a live 2027 label. Dark violet, pale petals and subtle stars frame the New Year offer.',
'29':'A geometric star illustration acts as a celebratory book cover above a compact email signup.',
'30':'The new year is the leading typographic block in this minimal announcement strip. Deadline and action form a distinct trailing group.',
'31':'A replaceable flower image and chunky green typography. An approachable Free signup for January.',
'32':'A warm, quiet bar with a replaceable moon image explains a seasonal closure. Its job is to inform, so there is no countdown or promotional flourish.',
'33':'A steaming mug illustration makes a practical opening-hours message feel welcoming and human.',
'34':'An illustrated parcel and a clean ruled information panel. A useful Free delivery notice with no fake urgency.',
'35':'A compact winter-hours card with aligned date/time rows. The information is the design; the action points to the full timetable.',
'36':'A big-hearted yeti carries a gift beside bold, compact sale typography. Floating snow-like sparkles stay inside the artwork pane; the offer remains still.',
'37':'A gingerbread storefront and smiling cookie turn a wide inline block into a small festive bakery. A title above, artwork in the middle and a clear shop action below create a different reading rhythm.',
'38':'A penguin courier rides a sled full of gifts above a delivery cutoff. Snow-like sparkles drift around the artwork; the deadline describes ordering, never guaranteed arrival.',
'39':'A mischievous cat has already found the present. The dark artwork panel ends with a playful no-peeking strip and the same native blinking-eyes decoration used for Halloween. Image and decoration group can be removed independently.',
'40':'A tiny rabbit-and-cat party meets oversized, bold typography. The celebration lives in a separate image panel with floating stars; the real New Year offer deadline sits in a quiet panel below it.'};
function render(){
 const p=q(),d=find(p.get('render')),ack=p.get('screen')==='ack';document.body.className=`render-page ${p.get('thumb')?'is-thumbnail':''} ${p.get('motion')==='off'||prefersReduced?'motion-off':''}`;
 app.innerHTML=`<main class="scene format-${d.format.toLowerCase().replace(/ /g,'-')}"><div class="site-context" aria-hidden="true"><div class="site-nav"><b>FIELD & FORM</b><span>Shop &nbsp; Stories &nbsp; About</span><span>Bag (0)</span></div><div class="site-hero"><p>SMALL THINGS, WELL CHOSEN</p><h2>Objects for<br>a slower season.</h2></div><div class="site-products"><i></i><i></i><i></i></div></div><article class="campaign t-${d.theme} ${ack?'ack':''}" aria-label="${esc(d.name)}"><button class="close" aria-label="Close example">×</button>${composition(d,ack)}</article><button class="reopen" hidden>↻ Reopen example</button><p class="demo-toast" role="status" hidden></p></main>`;
 const campaign=document.querySelector('.campaign');
 if(Number(d.id)>=36&&!ack){
  const style=document.createElement('style');style.textContent=DECORATION_CSS;campaign.append(style);
  campaign.classList.add('wc-root');campaign.dataset.motion=p.get('motion')==='off'||prefersReduced?'paused':'running';
  for(const panel of campaign.querySelectorAll('[data-play-decor]')){
   const kind=panel.dataset.playDecor;
   const items=kind==='eyes'?[{kind:'eyes',motion:'blink',color:'accent-fg',x:82,y:50,size:62,narrow:{x:82,y:50,size:48}}]:[
    {kind:'sparkle',motion:'float',x:9,y:17,size:28},{kind:'sparkle',motion:'blink',x:88,y:14,size:24},
    {kind:'sparkle',motion:'float',x:91,y:78,size:31},{kind:'sparkle',motion:'blink',x:7,y:73,size:19}];
   decorate(panel,{label:kind==='eyes'?'Peeking eyes':'Festive sparkles',items});
  }
 }
 const toast=message=>{const t=document.querySelector('.demo-toast');t.textContent=message;t.hidden=false;setTimeout(()=>{t.hidden=true;},3500);};
 campaign.querySelector('.close').onclick=()=>{campaign.hidden=true;document.querySelector('.reopen').hidden=false;};
 document.querySelector('.reopen').onclick=()=>{campaign.hidden=false;document.querySelector('.reopen').hidden=true;};
 campaign.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();const p=q();p.set('screen','ack');history.replaceState({},'',`?${p}`);render();});
 campaign.querySelector('[data-back]')?.addEventListener('click',()=>{const p=q();p.delete('screen');history.replaceState({},'',`?${p}`);render();});
 campaign.querySelectorAll('[data-offer]').forEach(b=>b.onclick=()=>toast('Example link · connect your shop or information page in the editor.'));
 campaign.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied';}catch{b.textContent='Select code to copy';}});
 if(d.timer&&!ack){
  const deadline=new Date(d.endsAt).getTime();let expired=false;
  const expire=(initial=false)=>{
   if(expired)return;expired=true;
   campaign.querySelectorAll('[data-unit]').forEach(el=>el.textContent='00');
   if(!d.signup||initial){campaign.hidden=true;const reset=document.querySelector('.reopen');reset.hidden=false;reset.textContent='↻ Reload example';reset.onclick=()=>location.reload();}
   toast(d.signup&&!initial?'Deadline reached · an active signup can still finish.':'Deadline reached · the offer has closed.');
  };
  const tick=(initial=false)=>{
   if(expired||!campaign.isConnected)return;
   const delta=Math.max(0,Math.floor((deadline-Date.now())/1000));
   for(const [unit,value] of Object.entries({days:Math.floor(delta/86400),hours:Math.floor(delta/3600)%24,minutes:Math.floor(delta/60)%60,seconds:delta%60}))campaign.querySelectorAll(`[data-unit="${unit}"]`).forEach(el=>el.textContent=String(value).padStart(2,'0'));
   if(!delta)expire(initial);
  };
  tick(true);
  const interval=setInterval(()=>{if(expired||!campaign.isConnected){clearInterval(interval);return;}tick();},1000);
  const onExpiry=e=>{if(e.origin!==location.origin||e.data?.type!=='winter-expire')return;window.removeEventListener('message',onExpiry);if(!campaign.isConnected)return;clearInterval(interval);expire();};
  window.addEventListener('message',onExpiry);
 }
}
window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowLeft'){cycle(-1);e.preventDefault();}if(e.key==='ArrowRight'){cycle(1);e.preventDefault();}});
window.addEventListener('popstate',()=>q().has('variant')?viewer():gallery());
if(q().has('render'))render();else if(q().has('variant'))viewer();else gallery();

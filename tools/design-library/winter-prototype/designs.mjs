import { creativeArtwork } from './creative-assets.mjs';
import { artwork } from './art-assets.mjs';
const rows = [
["The ribbon room","Gifting","Popup","ribbon","A little ceremony.\nA lovely gift.","Thoughtful things, beautifully wrapped. Explore our Christmas edit.","Shop Christmas gifts"],
["A little gift","Gifting","Popup","gift","Small gift.\nBig feeling.","Take 15% off selected gifts for your favourite people.","Shop gifts with 15% off"],
["Winter windows","Gifting","Fullscreen","village","A whole village\nof good gifts.","Discover thoughtful gifts for the people who make your world.","Explore Christmas gifts"],
["The ornament edit","Gifting","Popup","ornament","Make their season sparkle.\nSave 20%.","The Christmas ornament edit: 20% off until 20 December.","Shop ornaments with 20% off"],
["Paper & pine","Gifting","Inline","pine","Less scrolling.\nMore thoughtful giving.","Our considered Christmas gift guide, all in one place.","Explore the gift guide"],
["The candle club","Gifting","Slide-in","candle","A warmer December.\n15% off candles.","Join our emails for 15% off your first candle order.","Get my 15% code","email"],
["Wrapped in colour","Gifting","Inline","colour","Not another\nbeige Christmas.","Bright little things for the wonderfully colourful people in your life.","Shop colourful gifts"],
["The thoughtful list","Gifting","Inline","list","Good gift ideas.\nA 10% welcome.","Get seasonal gift ideas and a 10% welcome code when you join our emails.","Get gift ideas + 10% off","email"],
["A ribbon reminder","Gifting","Floating bar","ribbonbar","Complimentary Christmas gift wrapping.","Complimentary gift wrapping on eligible orders until 20 December.","Shop eligible gifts"],
["The gift atelier","Gifting","Fullscreen","atelier","Thoughtful\nChristmas gifts.","Considered objects. Beautiful details. Explore our Christmas gift edit before it closes on 20 December.","Explore the Christmas edit"],
["Dear December","Signup","Popup","letter","Winter letters.\n15% off to begin.","Join our December letters for gift ideas and a 15% welcome code.","Get winter letters + 15% off","email"],
["Postcards from winter","Signup","Inline","postcard","Winter postcards.\n10% off your first order.","Join our winter newsletter for small discoveries, seasonal stories and 10% off.","Get winter stories + 10% off","email"],
["The snowglobe society","Signup","Popup","globe","A little winter magic.\nA 15% welcome.","Join our email list for winter launches and a 15% welcome code.","Get my 15% welcome code","email"],
["A small kindness","Signup","Inline","kindness","Thoughtful gift ideas,\nonce a month.","A monthly email with seasonal gift ideas and stories from our makers. A little inspiration, without the daily noise.","Send me monthly gift ideas","email"],
["After-hours at the atelier","Signup","Slide-in","afterhours","First pick.\n15% off your first order.","Join our emails to hear about new winter pieces and reveal 15% off.","Join the list + get 15% off","email"],
["First light access","Signup","Slide-in","firstlight","Winter previews.\nA 15% welcome.","Request winter-preview emails before 1 December and reveal a 15% code.","Get early access + 15% off","email"],
["The advent letter","Signup","Inline","advent","Little discoveries.\nA 10% welcome.","Join our seasonal letters: gift inspiration and a 10% welcome code.","Get gift ideas + 10% off","email"],
["The winter reading room","Signup","Popup","reading","Your next good book.\n10% off to begin.","Join our bookshop emails for winter reading picks and 10% off.","Get reading picks + 10% off","email"],
["The last sleigh","Last-minute","Floating bar","sleigh","Christmas orders close 18 December.","Order by 18 December for our Christmas dispatch window.","See delivery details"],
["Before the bow","Last-minute","Popup","bow","Christmas orders\nclose 18 December.","Our Christmas ordering window closes on 18 December.","Shop before the order cutoff"],
["The dispatch desk","Last-minute","Inline","dispatch","Plan your\nChristmas delivery.","Place your Christmas order before 18 December. Delivery areas and terms apply.","Check delivery options"],
["The digital gift","Last-minute","Slide-in","eleven","Good gifts.\nNo wrapping.","Our digital gift-card offer ends on 24 December. A thoughtful choice, without the wrapping.","Explore digital gift cards"],
["Still time for something","Last-minute","Popup","stilltime","A little more time.\n15% off digital gifts.","Take 15% off selected digital gifts until 24 December.","Shop digital gifts"],
["The pickup window","Last-minute","Floating bar","pickup","Christmas click & collect.","Order by 23 December for our Christmas collection window.","See pickup details"],
["A final little sparkle","Last-minute","Fullscreen","final","One last sparkle.\nUntil 24 December.","Our Christmas edit closes on 24 December. Find something worth giving.","Explore Christmas gifts"],
["A softer beginning","New Year","Popup","soft","A fresh start.\nA 15% welcome.","Join our emails for fresh ideas and 15% off your first order of the new year.","Get January ideas + 15% off","email"],
["Hello, tomorrow","New Year","Inline","tomorrow","Hello, tomorrow.\nHello, 10% off.","New ideas for a new year. Join our emails and reveal a 10% welcome code.","Get new-year ideas + 10% off","email"],
["The midnight garden","New Year","Fullscreen","midnight","Let good things grow.\nStart with 20% off.","Welcome the new year with 20% off selected pieces until 5 January.","Shop the New Year offer"],
["A bright new chapter","New Year","Slide-in","chapter","A new chapter.\nA 15% welcome.","Join our January emails for new arrivals and a 15% welcome code.","Get January arrivals + 15% off","email"],
["The first page","New Year","Floating bar","firstpage","Start the year with 20% off.","Our 20% New Year edit ends on 5 January.","Shop the New Year edit"],
["Fresh start club","New Year","Popup","club","Small steps.\nA 10% welcome.","Join our weekly inspiration emails and reveal 10% off your first order.","Get weekly ideas + 10% off","email"],
["The shop is sleeping","Holiday info","Floating bar","sleeping","Closed 25–26 December.","Dispatch resumes on 27 December.","See holiday hours"],
["See you by the fire","Holiday info","Slide-in","fire","Visit us this\nholiday season.","Planning a visit? Check our opening hours before you make the trip.","See opening hours"],
["Holiday post","Holiday info","Inline","post","Check your\nChristmas delivery.","Christmas delivery has its own timetable. Check dates and delivery areas before ordering.","Read delivery information"],
["Winter hours","Holiday info","Slide-in","hours","Your holiday\nopening hours.","A little change to our opening hours. Find your best time to visit.","See full opening hours"],
["Gift a little warmth", "Gifting", "Popup", "mitten", "Big love.\nLittle gift.", "Take 20% off selected Christmas gifts until 20 December. A little something goes a long way.", "Find their little something"],
["The cocoa break", "Gifting", "Inline", "cocoa", "Out of office.\nInto cocoa.", "Cookies, cocoa and thoughtful little gifts. Give someone a very good reason to take a break.", "Shop festive treats"],
["No last-minute snail mail", "Last-minute", "Slide-in", "snail", "Good gifts.\nWorth planning.", "Place Christmas orders by 18 December. Check dispatch dates and delivery areas before ordering.", "Check delivery dates"],
["Good things unfold", "Signup", "Popup", "fold", "Good things\nunfold.", "Join our emails for thoughtful gift ideas. Your first little surprise: a 15% welcome code.", "Reveal my 15% code", "email"],
["A fresh kind of party", "New Year", "Fullscreen", "pear", "Fresh year.\nGood taste.", "A fresh take on your favourites. Take 20% off selected pieces until 5 January.", "Explore the New Year edit"]
];
const free = new Set([2,5,8,11,14,18,23,27,31,34]);
const clocks = new Set([4,9,10,16,19,20,21,22,23,24,25,28,30,36,38,40]);
const moving = new Set([3,4,10,13,16,25,28,29,36,37,38,39,40]);
export const designs=rows.map((r,i)=>({id:String(i+1).padStart(2,'0'),name:r[0],category:r[1],format:r[2],theme:r[3],headline:r[4],body:r[5],cta:r[6],signup:r[7]==='email',reward:i!==13,tier:free.has(i+1)?'Free':'Pro',timer:clocks.has(i+1),endsAt:(i===35?'2026-12-20':i===37?'2026-12-18':i>=25?'2027-01-05':i===15?'2026-12-01':[18,19,20].includes(i)?'2026-12-18':i===23?'2026-12-23':i>=21?'2026-12-24':'2026-12-20')+'T20:00:00Z',motion:moving.has(i+1),code:(r[1]==='New Year'?'FRESH':'MERRY')+(r[5].match(/(\d+)%/)?.[1]||'15')}));
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eyebrow=t=>`<p class="eyebrow">${t}</p>`;
const headline=d=>`<h1>${esc(d.headline).replace(/\n/g,'<br>')}</h1>`;
const body=d=>`<p class="body-copy">${esc(d.body)}</p>`;
const art=(key,extra='')=>{const a=creativeArtwork[key];return `<div class="object-art ${extra}" data-art="${key}"><img src="${a.src}" alt="${a.alt}" width="1024" height="1024"></div>`;};
const image=(key,extra='',fit='contain')=>{if(['art-banner','globe-art','ack-art'].includes(extra))key+='Banner';const a=artwork[key];return `<div class="artwork ${extra}" data-art="${key}" style="--art-bg:${a.bg}"><img src="${a.src}" alt="${a.alt}" data-fit="${fit}" style="object-fit:${fit}" width="${a.width}" height="${a.height}"></div>`;};
const code=d=>`<div class="coupon"><span>${d.code}</span><button data-copy="${d.code}" type="button" aria-label="Copy ${d.code}">Copy code</button></div>`;
const timerLabels={'04':'ORNAMENT OFFER ENDS IN','09':'GIFT WRAPPING ENDS IN','10':'CHRISTMAS EDIT CLOSES IN','16':'PREVIEW SIGNUP CLOSES IN','19':'CHRISTMAS ORDERS CLOSE IN','20':'CHRISTMAS ORDERS CLOSE IN','21':'CHRISTMAS ORDERS CLOSE IN','22':'DIGITAL GIFT OFFER ENDS IN','23':'DIGITAL GIFT OFFER ENDS IN','24':'PICKUP ORDERS CLOSE IN','25':'CHRISTMAS EDIT CLOSES IN','28':'NEW YEAR OFFER ENDS IN','30':'NEW YEAR OFFER ENDS IN','36':'GIFT OFFER ENDS IN','38':'CHRISTMAS ORDERS CLOSE IN','40':'NEW YEAR OFFER ENDS IN'};
const countdown=d=>d.timer?`<div class="timer-wrap"><p class="timer-label">${timerLabels[d.id]}</p><div class="countdown" role="timer" aria-label="Time remaining"><span><b data-unit="days">08</b><small>days</small></span><i>:</i><span><b data-unit="hours">14</b><small>hours</small></span><i>:</i><span><b data-unit="minutes">32</b><small>mins</small></span><i>:</i><span><b data-unit="seconds">09</b><small>secs</small></span></div></div>`:'';
const action=d=>d.signup?`<form class="signup-form"><label>Email address<input type="email" required autocomplete="email" placeholder="you@example.com"></label><button class="cta" type="submit">${esc(d.cta)}</button><label class="consent"><input type="checkbox" required><span>I agree to receive marketing emails. Unsubscribe anytime.</span></label></form>`:`<button type="button" class="cta" data-offer>${esc(d.cta)}</button>`;
const note=d=>`<p class="fine-print">${d.signup?(d.reward?'Your code appears here after signup.':'One email a month. Unsubscribe anytime.'):d.category==='Holiday info'?'Check the full timetable before you visit or order.':'Selected items. Offer terms apply.'}</p>`;
const copy=(d,eyebrowText,extra='')=>`<div class="copy ${extra}">${eyebrow(eyebrowText)}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;
const sparkles=d=>d.motion&&Number(d.id)<36?`<div class="sparkles" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i><i>✦</i></div>`:'';
export function composition(d,ack=false){
 if(ack&&d.id==='39')return `<div class="unfold-ack-art">${art('fold')}</div><div class="ack-copy">${eyebrow('YOUR LITTLE SURPRISE')}<h1>Thank you.<br>Request received.</h1><p class="body-copy">Here’s your example welcome code.</p>${code(d)}<button class="cta" data-offer>Explore the gift edit</button><p class="fine-print">Prototype only. No email address was saved or sent.</p><button class="text-button" data-back>← Back to signup</button></div>`;
 if(ack)return `${image(({'06':'candles','12':'village','13':'globe','16':'dawn','17':'presents','18':'book','29':'stars'})[d.id]||(d.category==='New Year'?'dawn':'envelope'),'ack-art')}<div class="ack-copy">${eyebrow('A LITTLE THANK YOU')}<h1>Thank you.<br>Request received.</h1><p class="body-copy">${d.reward?'Here’s your example welcome code. Enjoy finding something lovely.':'Thank you for requesting our monthly gift ideas.'}</p>${d.reward?code(d):''}<button class="cta" data-offer>Explore the collection</button><p class="fine-print">Prototype only. No email address was saved or sent.</p><button class="text-button" data-back>← Back to signup</button></div>`;
 let html='';
 switch(d.id){
 case '01':html=`${image('ribbon')}${copy(d,'THE CHRISTMAS GIFT ATELIER')}`;break;
 case '02':html=`<div class="gift-icon">${image('presents')}</div>${eyebrow('A LITTLE SOMETHING, FROM US')}${headline(d)}<div class="discount">15<span>% off</span></div>${body(d)}${code(d)}${action(d)}${note(d)}`;break;
 case '03':html=`<div class="village-sky">${eyebrow('THE WINTER VILLAGE')}${headline(d)}${body(d)}${action(d)}</div>${image('villageWide','panorama','cover')}`;break;
 case '04':html=`${image('baubles')}${copy(d,'THE ORNAMENT EDIT · 20% OFF')}`;break;
 case '05':html=`${image('pine')}${copy(d,'THE GIFT GUIDE / WINTER 2026')}`;break;
 case '06':html=`${image('candles','art-banner')}${copy(d,'THE CANDLE CLUB')}`;break;
 case '07':html=`<div class="colour-title">${eyebrow('FOR THE COLOURFULLY CURIOUS')}${headline(d)}</div>${image('presents')}<div class="colour-action">${body(d)}${action(d)}${note(d)}</div>`;break;
 case '08':html=`<div class="list-intro">${eyebrow('THE THOUGHTFUL LIST')}${headline(d)}<p class="list-line">01 &nbsp; A little inspiration.</p><p class="list-line">02 &nbsp; A considered gift.</p><p class="list-line">03 &nbsp; A happier December.</p></div><div class="list-form">${body(d)}${action(d)}${note(d)}</div>`;break;
 case '09':html=`<div class="bar-copy">${eyebrow('WRAPPED WITH A LITTLE LOVE')}${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '10':html=`${image('botanical')}<div class="atelier-center">${eyebrow('THE GIFT ATELIER')}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;break;
 case '11':html=`<div class="letter-top">${eyebrow('A LETTER, JUST FOR YOU')}</div>${headline(d)}${body(d)}${action(d)}<div class="letter-signature">With a little love,<br><em>The December edit</em></div>`;break;
 case '12':html=`${image('village')}<div class="postcard-copy"><div class="postcard-header">${eyebrow('POSTCARDS FROM WINTER')}</div>${headline(d)}${body(d)}${action(d)}</div>`;break;
 case '13':html=`${image('globe','globe-art')}${copy(d,'THE SNOWGLOBE SOCIETY')}`;break;
 case '14':html=`${image('flower','kindness-mark')}${copy(d,'A SMALL KINDNESS')}`;break;
 case '15':html=`<div class="afterhours-top">${eyebrow('AFTER HOURS AT THE ATELIER')}</div>${headline(d)}${body(d)}<div class="slim-rule"></div>${action(d)}${note(d)}`;break;
 case '16':html=`${image('dawn','art-banner')}${copy(d,'THE WINTER PREVIEW')}`;break;
 case '17':html=`${image('advent','advent-art')}${copy(d,'THE ADVENT LETTER')}`;break;
 case '18':html=`${image('book')}${copy(d,'THE WINTER READING ROOM')}`;break;
 case '19':html=`<div class="bar-copy">${eyebrow('THE CHRISTMAS DISPATCH')}${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '20':html=`<div class="bow-border">${image('ribbon','art-banner')}${copy(d,'A NOTE FROM THE GIFT DESK')}</div>`;break;
 case '21':html=`<div class="dispatch-date"><strong>18</strong><div class="date-context"><span>December</span><span>Christmas order cutoff</span></div></div><div class="dispatch-copy">${eyebrow('FROM THE DISPATCH DESK')}${headline(d)}${body(d)}${countdown(d)}${action(d)}</div>`;break;
 case '22':html=`<div class="digital-label">Digital<br>gift cards</div>${copy(d,'A THOUGHTFUL DIGITAL GIFT')}`;break;
 case '23':html=`${eyebrow('THOUGHTFUL DOESN’T HAVE TO TAKE LONG')}${headline(d)}${body(d)}${countdown(d)}${code(d)}${action(d)}${note(d)}`;break;
 case '24':html=`<div class="bar-copy">${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '25':html=`${image('baubles')}<div class="final-copy">${eyebrow('THE CHRISTMAS FINALE')}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;break;
 case '26':html=`${image('dawn')}${copy(d,'A SOFTER JANUARY')}`;break;
 case '27':html=`<div class="tomorrow-title">${eyebrow('A NEW YEAR. A LITTLE POSSIBILITY.')}${headline(d)}</div><div class="tomorrow-form">${body(d)}${action(d)}</div>`;break;
 case '28':html=`<div class="midnight-illustration">${image('botanical')}<span class="year">2027</span></div><div class="midnight-copy">${eyebrow('THE MIDNIGHT GARDEN')}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;break;
 case '29':html=`${image('stars','art-banner')}${copy(d,'HERE’S TO WHAT COMES NEXT')}`;break;
 case '30':html=`<span class="firstpage-year">2027</span><div class="bar-copy">${eyebrow('THE FIRST PAGE')}${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '31':html=`<div class="club-heading">${eyebrow('THE FRESH START CLUB')}${image('flowerGreen','club-flower')}</div>${headline(d)}${body(d)}${action(d)}<p class="club-foot">A little inspiration. A little momentum.</p>`;break;
 case '32':html=`${image('moon','sleeping-moon')}<div class="bar-copy">${eyebrow('A NOTE FROM OUR LITTLE SHOP')}${headline(d)}${body(d)}</div>${action(d)}`;break;
 case '33':html=`${image('mug','art-banner')}${copy(d,'COME IN FROM THE COLD')}`;break;
 case '34':html=`<div class="post-art">${image('parcel')}</div><div class="post-copy">${eyebrow('HOLIDAY POST')}${headline(d)}${body(d)}<div class="post-rule"></div>${action(d)}</div>`;break;
 case '35':html=`${eyebrow('OUR WINTER HOURS')}${headline(d)}<div class="hours-table"><p><span>24 December</span><b>10 am – 2 pm</b></p><p><span>25–26 December</span><b>Closed</b></p><p><span>27 December</span><b>10 am – 6 pm</b></p></div>${body(d)}${action(d)}`;break;

 case '36':html=`<div class="warmth-heading">${eyebrow('SOMETHING SMALL. A WHOLE LOT OF LOVE.')}<div class="warmth-title">${headline(d)}<p class="offer-badge">20%<span>OFF</span></p></div></div><div class="object-stage warmth-art" data-play-decor="warmth">${art('mitten')}</div><div class="warmth-footer">${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;break;
 case '37':html=`<div class="cocoa-copy">${eyebrow('THE VERY GOOD BREAK CLUB')}${headline(d)}${body(d)}${action(d)}<p class="fine-print">A little treat. A proper pause.</p></div><div class="object-stage cocoa-art" data-play-decor="cocoa">${art('cocoa')}</div>`;break;
 case '38':html=`<div class="dispatch-ticket"><div class="snail-top"><div class="dispatch-stamp">${eyebrow('ORDER BY')}<strong>18</strong><span>DECEMBER</span></div><div class="object-stage snail-art" data-play-decor="snail">${art('snail')}</div></div><div class="snail-copy">${eyebrow('SKIP THE LAST-MINUTE SCRAMBLE')}${headline(d)}${body(d)}${countdown(d)}${action(d)}</div></div>`;break;
 case '39':html=`<div class="fold-heading">${eyebrow('THE GIFT OF A GOOD IDEA')}${headline(d)}</div><div class="fold-content"><div class="object-stage fold-art" data-play-decor="fold">${art('fold')}</div><div class="fold-form">${body(d)}${action(d)}${note(d)}</div></div>`;break;
 case '40':html=`<div class="pear-top">${eyebrow('THE NEW YEAR EDIT / 2027')}<p class="pear-offer">20% OFF SELECTED PIECES</p></div><div class="pear-main"><div class="pear-copy">${headline(d)}${body(d)}</div><div class="object-stage pear-art" data-play-decor="pear">${art('pear')}</div></div><div class="pear-footer">${countdown(d)}${action(d)}<p class="fine-print">Until 5 January. Selected items. Offer terms apply.</p></div>`;break;
 }
 return html+sparkles(d);
}

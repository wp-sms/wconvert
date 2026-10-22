import { art } from './art.mjs';
const rows = [
['The ribbon room','Gifting','Popup','ribbon','A little ceremony.\nA lovely gift.','Thoughtful things, beautifully wrapped. Explore our Christmas edit.','Explore the gift edit'],
['A little gift','Gifting','Popup','gift','Small gift.\nBig feeling.','Take 15% off selected gifts for your favourite people.','Find a little something'],
['Winter windows','Gifting','Fullscreen','village','A whole village\nof good gifts.','Discover thoughtful gifts for the people who make your world.','Step into Christmas'],
['The ornament edit','Gifting','Popup','ornament','Make their\nseason sparkle.','The Christmas ornament edit: 20% off until 20 December.','Explore the ornaments'],
['Paper & pine','Gifting','Inline','pine','Less scrolling.\nMore thoughtful giving.','Our considered Christmas gift guide, all in one place.','Find their gift'],
['The candle club','Gifting','Slide-in','candle','A warmer kind\nof December.','Join our emails for 15% off your first candle order.','Reveal my welcome code','email'],
['Wrapped in colour','Gifting','Inline','colour','Not another\nbeige Christmas.','Bright little things for the wonderfully colourful people in your life.','Shop the colourful edit'],
['The thoughtful list','Gifting','Inline','list','Good gifts start\nwith a good list.','Get seasonal gift ideas and a 10% welcome code when you join our emails.','Join the thoughtful list','email'],
['A ribbon reminder','Gifting','Floating bar','ribbonbar','A little extra, beautifully wrapped.','Complimentary gift wrapping on eligible orders until 20 December.','Explore gifts'],
['The gift atelier','Gifting','Fullscreen','atelier','For someone\nquite extraordinary.','Considered objects. Beautiful details. Gifts worth keeping.','Visit the gift atelier'],
['Dear December','Signup','Popup','letter','A little joy\nin your inbox.','Join our December letters for gift ideas and a 15% welcome code.','Send me the little joys','email'],
['Postcards from winter','Signup','Inline','postcard','Wish you\nwere here.','Join our winter newsletter for small discoveries, seasonal stories and 10% off.','Count me in','email'],
['The snowglobe society','Signup','Popup','globe','Your own little\nwinter world.','Join our email list for winter launches and a 15% welcome code.','Let me into winter','email'],
['A small kindness','Signup','Inline','kindness','Something thoughtful,\nonce a month.','Seasonal inspiration and a 10% thank-you code for joining our emails.','A little kindness, please','email'],
['After-hours at the atelier','Signup','Slide-in','afterhours','First pick.\nQuietly yours.','Join our emails to hear about new winter pieces and reveal 15% off.','Join the private list','email'],
['First light access','Signup','Slide-in','firstlight','Be there for\nthe first light.','Request winter-preview emails before 1 December and reveal a 15% code.','Request early access','email'],
['The advent letter','Signup','Inline','advent','Make room for\nlittle discoveries.','Join our seasonal letters: gift inspiration and a 10% welcome code.','Open a new chapter','email'],
['The winter reading room','Signup','Popup','reading','A good book.\nA slow afternoon.','Join our bookshop emails for winter reading picks and 10% off.','Find my next chapter','email'],
['The last sleigh','Last-minute','Floating bar','sleigh','One last ride before Christmas.','Order by 18 December for our Christmas dispatch window.','See delivery details'],
['Before the bow','Last-minute','Popup','bow','There is still\ntime for thoughtful.','Our Christmas ordering window closes on 18 December.','Find the finishing touch'],
['The dispatch desk','Last-minute','Inline','dispatch','A date for\nyour diary.','Place your Christmas order before 18 December. Delivery areas and terms apply.','Check delivery options'],
['The eleventh-hour gift','Last-minute','Slide-in','eleven','Late?\nLovely, actually.','Our digital gift-card offer ends on 24 December. A thoughtful choice, without the wrapping.','Explore gift cards'],
['Still time for something','Last-minute','Popup','stilltime','A little time.\nA lovely find.','Take 15% off selected digital gifts until 24 December.','Find a digital gift'],
['The pickup window','Last-minute','Floating bar','pickup','Your gifts. Our doorstep.','Order by 23 December for our Christmas collection window.','See pickup details'],
['A final little sparkle','Last-minute','Fullscreen','final','One last\nlittle sparkle.','Our Christmas edit closes on 24 December. Find something worth giving.','Make it a lovely one'],
['A softer beginning','New Year','Popup','soft','A fresh start.\nAt your own pace.','Join our emails for fresh ideas and 15% off your first order of the new year.','Start softly','email'],
['Hello, tomorrow','New Year','Inline','tomorrow','Hello,\ntomorrow.','New ideas for a new year. Join our emails and reveal a 10% welcome code.','Meet what’s next','email'],
['The midnight garden','New Year','Fullscreen','midnight','Let good\nthings grow.','Welcome the new year with 20% off selected pieces until 5 January.','Explore a fresh beginning'],
['A bright new chapter','New Year','Slide-in','chapter','A bright\nnew chapter.','Join our January emails for new arrivals and a 15% welcome code.','Turn the page','email'],
['The first page','New Year','Floating bar','firstpage','Start the year with something good.','Our 20% New Year edit ends on 5 January.','Explore the new edit'],
['Fresh start club','New Year','Popup','club','Small steps.\nGood things.','Join our weekly inspiration emails and reveal 10% off your first order.','Make a fresh start','email'],
['The shop is sleeping','Holiday info','Floating bar','sleeping','A little pause for the holidays.','Our shop is closed 25–26 December. Online orders reopen on 27 December.','See holiday hours'],
['See you by the fire','Holiday info','Slide-in','fire','A warm welcome.\nA winter timetable.','Planning a visit? Check our opening hours before you make the trip.','Plan a winter visit'],
['Holiday post','Holiday info','Inline','post','A small note\nabout your parcel.','Christmas delivery has its own timetable. Check dates and delivery areas before ordering.','Read delivery information'],
['Winter hours','Holiday info','Slide-in','hours','A slower season.\nStill here for you.','A little change to our opening hours. Find your best time to visit.','Plan your visit'],
];
const free = new Set([2,5,8,11,14,18,23,27,31,34]);
const clocks = new Set([4,9,10,16,19,20,21,22,23,24,25,28,30]);
const moving = new Set([3,4,10,13,16,25,28,29]);
export const designs=rows.map((r,i)=>({id:String(i+1).padStart(2,'0'),name:r[0],category:r[1],format:r[2],theme:r[3],headline:r[4],body:r[5],cta:r[6],signup:r[7]==='email',tier:free.has(i+1)?'Free':'Pro',timer:clocks.has(i+1),endsAt:(i>=25?'2027-01-05':i===15?'2026-12-01':[18,19,20].includes(i)?'2026-12-18':i===23?'2026-12-23':i>=21?'2026-12-24':'2026-12-20')+'T20:00:00Z',motion:moving.has(i+1),code:(i>=25?'FRESH':'MERRY')+(r[5].match(/(\d+)%/)?.[1]||'15')}));
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eyebrow=t=>`<p class="eyebrow">${t}</p>`;
const headline=d=>`<h1>${esc(d.headline).replace(/\n/g,'<br>')}</h1>`;
const body=d=>`<p class="body-copy">${esc(d.body)}</p>`;
const image=(key,extra='')=>`<div class="artwork ${extra}" role="img" aria-label="Original winter ${key} illustration">${art[key]}</div>`;
const code=d=>`<div class="coupon"><span>${d.code}</span><button data-copy="${d.code}" type="button" aria-label="Copy ${d.code}">Copy code</button></div>`;
const countdown=d=>d.timer?`<div class="timer-wrap"><p class="timer-label">${d.category==='Last-minute'?'ORDERING WINDOW CLOSES IN':'THIS SEASONAL OFFER ENDS IN'}</p><div class="countdown" role="timer" aria-label="Time remaining"><span><b data-unit="days">08</b><small>days</small></span><i>:</i><span><b data-unit="hours">14</b><small>hours</small></span><i>:</i><span><b data-unit="minutes">32</b><small>mins</small></span><i>:</i><span><b data-unit="seconds">09</b><small>secs</small></span></div></div>`:'';
const action=d=>d.signup?`<form class="signup-form"><label>Email address<input type="email" required autocomplete="email" placeholder="you@example.com"></label><button class="cta" type="submit">${esc(d.cta)} <span aria-hidden="true">↗</span></button><label class="consent"><input type="checkbox" required><span>I agree to receive marketing emails. Unsubscribe anytime.</span></label></form>`:`<button type="button" class="cta" data-offer>${esc(d.cta)} <span aria-hidden="true">↗</span></button>`;
const note=d=>`<p class="fine-print">${d.signup?'Your code appears here after signup.':d.category==='Holiday info'?'Check the full timetable before you visit or order.':'Selected items. Offer terms apply.'}</p>`;
const copy=(d,eyebrowText,extra='')=>`<div class="copy ${extra}">${eyebrow(eyebrowText)}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;
const sparkles=d=>d.motion?`<div class="sparkles" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i><i>✦</i></div>`:'';
export function composition(d,ack=false){
 if(ack)return `<div class="ack-art">${art[({'06':'candles','12':'village','13':'globe','16':'dawn','17':'presents','18':'book','29':'stars'})[d.id]||(d.category==='New Year'?'dawn':'envelope')]}</div><div class="ack-copy">${eyebrow('A LITTLE THANK YOU')}<h1>Thank you.<br>Your request is received.</h1><p class="body-copy">Here’s your example welcome code. Enjoy finding something lovely.</p>${code(d)}<button class="cta" data-offer>Explore the collection <span>↗</span></button><p class="fine-print">Prototype only. No email address was saved or sent.</p><button class="text-button" data-back>← Back to signup</button></div>`;
 let html='';
 switch(d.id){
 case '01':html=`${image('ribbon')}${copy(d,'THE CHRISTMAS GIFT ATELIER')}`;break;
 case '02':html=`<div class="gift-icon">${image('presents')}</div>${eyebrow('A LITTLE SOMETHING, FROM US')}${headline(d)}<div class="discount">15<span>% off</span></div>${body(d)}${code(d)}${action(d)}${note(d)}`;break;
 case '03':html=`<div class="village-sky">${eyebrow('THE WINTER VILLAGE')}${headline(d)}${body(d)}${action(d)}</div>${image('villageWide','panorama')}`;break;
 case '04':html=`${image('baubles')}${copy(d,'THE ORNAMENT EDIT · 20% OFF')}`;break;
 case '05':html=`${image('pine')}${copy(d,'THE GIFT GUIDE / WINTER 2026')}`;break;
 case '06':html=`${image('candles','art-banner')}${copy(d,'THE CANDLE CLUB')}`;break;
 case '07':html=`<div class="colour-title">${eyebrow('FOR THE COLOURFULLY CURIOUS')}${headline(d)}</div>${image('presents')}<div class="colour-action">${body(d)}${action(d)}${note(d)}</div>`;break;
 case '08':html=`<div class="list-intro">${eyebrow('THE THOUGHTFUL LIST')}${headline(d)}<p class="list-line">01 &nbsp; A little inspiration.</p><p class="list-line">02 &nbsp; A considered gift.</p><p class="list-line">03 &nbsp; A happier December.</p></div><div class="list-form">${body(d)}${action(d)}${note(d)}</div>`;break;
 case '09':html=`<div class="ribbon-mark" aria-hidden="true">✦</div><div class="bar-copy">${eyebrow('WRAPPED WITH A LITTLE LOVE')}${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '10':html=`${image('botanical')}<div class="atelier-center">${eyebrow('THE GIFT ATELIER')}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div><div class="atelier-side">${image('candles')}<p>Beautifully considered.<br>Thoughtfully given.</p></div>`;break;
 case '11':html=`<div class="letter-top">${eyebrow('A LETTER, JUST FOR YOU')}<span class="postage" aria-hidden="true">✦</span></div>${headline(d)}${body(d)}${action(d)}<div class="letter-signature">With a little love,<br><em>The December edit</em></div>`;break;
 case '12':html=`${image('village')}<div class="postcard-copy"><div class="postcard-header">${eyebrow('POSTCARDS FROM WINTER')}<span class="postage" aria-hidden="true">✦</span></div>${headline(d)}${body(d)}${action(d)}</div>`;break;
 case '13':html=`${image('globe','globe-art')}${copy(d,'THE SNOWGLOBE SOCIETY')}`;break;
 case '14':html=`<div class="kindness-mark" aria-hidden="true">✳</div>${copy(d,'A SMALL KINDNESS')}`;break;
 case '15':html=`<div class="afterhours-top">${eyebrow('AFTER HOURS AT THE ATELIER')}<span aria-hidden="true">☾</span></div>${headline(d)}${body(d)}<div class="slim-rule"></div>${action(d)}${note(d)}`;break;
 case '16':html=`${image('dawn','art-banner')}${copy(d,'THE WINTER PREVIEW')}`;break;
 case '17':html=`<div class="advent-art"><div class="advent-tile">01</div><div class="advent-tile">✶</div><div class="advent-tile">03</div><div class="advent-tile">04</div><div class="advent-tile">05</div><div class="advent-tile">✦</div></div>${copy(d,'THE ADVENT LETTER')}`;break;
 case '18':html=`${image('book')}${copy(d,'THE WINTER READING ROOM')}`;break;
 case '19':html=`<div class="bar-art">${art.parcel}</div><div class="bar-copy">${eyebrow('THE CHRISTMAS DISPATCH')}${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '20':html=`<div class="bow-border">${image('ribbon','art-banner')}${copy(d,'A NOTE FROM THE GIFT DESK')}</div>`;break;
 case '21':html=`<div class="dispatch-date"><span>DECEMBER</span><strong>18</strong><span>THE CHRISTMAS ORDER DEADLINE</span></div><div class="dispatch-copy">${eyebrow('FROM THE DISPATCH DESK')}${headline(d)}${body(d)}${countdown(d)}${action(d)}</div>`;break;
 case '22':html=`<div class="eleven-number" aria-hidden="true">11<span>th hour</span></div>${copy(d,'A LAST-MINUTE LITTLE MIRACLE')}`;break;
 case '23':html=`${eyebrow('THOUGHTFUL DOESN’T HAVE TO TAKE LONG')}${headline(d)}${body(d)}${countdown(d)}${code(d)}${action(d)}${note(d)}`;break;
 case '24':html=`<div class="pickup-label">CLICK.<br>COLLECT.<br>CELEBRATE.</div><div class="bar-copy">${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '25':html=`${image('baubles')}<div class="final-copy">${eyebrow('THE CHRISTMAS FINALE')}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;break;
 case '26':html=`${image('dawn')}${copy(d,'A SOFTER JANUARY')}`;break;
 case '27':html=`<div class="tomorrow-title">${eyebrow('A NEW YEAR. A LITTLE POSSIBILITY.')}${headline(d)}<span aria-hidden="true">↗</span></div><div class="tomorrow-form">${body(d)}${action(d)}</div>`;break;
 case '28':html=`<div class="midnight-illustration">${image('botanical')}<span class="year">2027</span></div><div class="midnight-copy">${eyebrow('THE MIDNIGHT GARDEN')}${headline(d)}${body(d)}${countdown(d)}${action(d)}${note(d)}</div>`;break;
 case '29':html=`${image('stars','art-banner')}${copy(d,'HERE’S TO WHAT COMES NEXT')}`;break;
 case '30':html=`<span class="firstpage-year">2027</span><div class="bar-copy">${eyebrow('THE FIRST PAGE')}${headline(d)}${body(d)}</div>${countdown(d)}${action(d)}`;break;
 case '31':html=`<div class="club-heading">${eyebrow('THE FRESH START CLUB')}<span aria-hidden="true">✳</span></div>${headline(d)}${body(d)}${action(d)}<p class="club-foot">A little inspiration. A little momentum.</p>`;break;
 case '32':html=`<span class="sleeping-moon" aria-hidden="true">☾</span><div class="bar-copy">${eyebrow('A NOTE FROM OUR LITTLE SHOP')}${headline(d)}${body(d)}</div>${action(d)}`;break;
 case '33':html=`${image('mug','art-banner')}${copy(d,'COME IN FROM THE COLD')}`;break;
 case '34':html=`<div class="post-art">${image('parcel')}</div><div class="post-copy">${eyebrow('HOLIDAY POST')}${headline(d)}${body(d)}<div class="post-rule"></div>${action(d)}</div>`;break;
 case '35':html=`${eyebrow('OUR WINTER HOURS')}${headline(d)}<div class="hours-table"><p><span>24 December</span><b>10 am – 2 pm</b></p><p><span>25–26 December</span><b>Closed</b></p><p><span>27 December</span><b>10 am – 6 pm</b></p></div>${body(d)}${action(d)}`;break;
 }
 return html+sparkles(d);
}

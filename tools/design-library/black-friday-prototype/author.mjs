import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
const here=import.meta.dirname;
const root=path.resolve(here,'../../..');
const out=path.join(root,'tools/design-library');
const art=path.join(out,'pilot/assets/black-friday');
const catalog=JSON.parse(fs.readFileSync(path.join(out,'publishing/catalog.json')));
const words=JSON.parse(fs.readFileSync(path.join(out,'publishing/designs.json')));
const collection=JSON.parse(fs.readFileSync(path.join(out,'pilot/collection.json')));
const mapping=[];
const asset=(name)=>{const file=path.join(art,name.replace(/\.(png|svg)$/,'.webp'));const bytes=fs.readFileSync(file);const hash=crypto.createHash('sha256').update(bytes).digest('hex');catalog.image_rights[hash]={kind:name.startsWith('audit-')?'original':'ai-generated',source:'Original WConvert campaign prototype; see black-friday-prototype/reference/ASSETS.md.',redistribution:true,reviewedBy:'Codex, original asset provenance, 2026-10-24',access:'free'};return 'data:image/webp;base64,'+bytes.toString('base64')};
const code=['designs.js','premium.js','retail-revision.js','composition-revision.js','audit-revision.js','motion-revision.js'].map(f=>fs.readFileSync(path.join(here,'reference',f+'.txt'),'utf8')).join('\n');
const ctx=vm.createContext({});vm.runInContext(code,ctx);const designs=vm.runInContext('D',ctx);
let num=0;const leaf=(type,rest)=>{if(rest.tokens&&!Object.keys(rest.tokens).length)delete rest.tokens;return {type,id:'n'+(++num),...rest};};
const h=(text,tokens={})=>leaf('heading',{role:'headline',text,tokens,narrow:{'heading-size':'2.65rem'}});
const t=(text,role='body',tokens={})=>leaf('text',{role,text,tokens});
const eyebrow=text=>leaf('eyebrow',{role:'eyebrow',text,tokens:{'text-size':'.625rem',tracking:'.12em'}});
const badge=text=>leaf('badge',{role:'badge',text});
const divider=()=>leaf('divider',{});
const image=(name,height='16rem',shape='rect')=>leaf('image',{src:asset(name),alt:({ 'retail-street.png':'Everyday streetwear against a steel wall','retail-desk.png':'Keyboard, mouse and portable speaker','retail-care.png':'Everyday shampoo, skincare and moisturiser','retail-coffee.png':'Espresso machine and coffee cups','retail-trainers.png':'Running trainers and gym essentials','audio.png':'Silver headphones on a blue display','gobbler.png':'Friendly purple character with gifts','machine.png':'Mint green welcome-perk dispenser','perfume.png':'Amber fragrance bottle','cosmic.png':'Friendly delivery robot','snack.png':'Breakfast food illustration','sneaker.png':'Orange and cream trainer','premium-interior.png':'Walnut lounge chair in a warm interior'})[name]||'',fit:name.endsWith('.svg')?'contain':'cover',shape,tokens:{'image-height':height,'image-position':'center',radius:'0'},narrow:{'image-height':parseFloat(height)>16?'16rem':height}});
const stack=(...children)=>({type:'stack',children,tokens:{gap:'.85rem'}});
const panel=(children,tokens={},extra={})=>({type:'panel',children,tokens:{pad:'2rem',gap:'.9rem',...tokens},narrow:{pad:'1.4rem'},...extra});
const row=(...children)=>({type:'row',children,tokens:{gap:'1rem'}});
const split=(start,end,ratio=.5)=>({type:'split',ratio,basis:'16rem',start:[start],end:[end],tokens:{gap:'0'}});
const grid=(children,basis='8rem')=>({type:'grid',basis,children,tokens:{gap:'.65rem'}});
const codeLeaf=text=>leaf('code',{role:'code_value',text,copy:false});
const timer=()=>leaf('countdown',{role:'countdown_units',layout:'boxes',days_label:'Days',hours_label:'Hours',minutes_label:'Minutes',seconds_label:'Seconds'});
const plain=s=>(s||'').replace(/<br\s*\/?\s*>/g,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
const first=s=>s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]||'';
const palette={
'01':['#cbb5ed','#39214a','#39214a','#fff5df'],'02':['#ffdfc5','#59363e','#a13953','#fff5df'],'03':['#ba3430','#fff3d7','#ffe5a3','#7b2926'],'04':['#1239bd','#fff9df','#e2f58f','#162544'],'05':['#fff4d6','#292b2c','#b93235','#fff5df'],'06':['#ddd8f2','#362c56','#362c56','#fff5df'],'07':['#322332','#f3e1bd','#ddc18a','#342335'],'08':['#eee0bc','#244b3e','#244b3e','#fff4d9'],'09':['#f7e9bd','#344435','#344435','#fff4d9'],'10':['#e6c3da','#42324a','#42324a','#fff5df'],'11':['#f2a46b','#2e3831','#2e3831','#f3f5df'],'12':['#201d2c','#e9d8b7','#e9d8b7','#282231'],'13':['#ffd2db','#473045','#473045','#fff5df'],'14':['#f2e8bf','#274c3c','#274c3c','#fff8d9'],'15':['#e7dac2','#334637','#334637','#fff4dc'],'16':['#251b3d','#fff0d8','#ffe0a3','#352446'],'17':['#cdb083','#332d25','#204cbf','#ffffff'],'18':['#edd1ba','#493140','#493140','#fff2df'],'19':['#172c29','#d5ff82','#d5ff82','#172c29'],'20':['#f0c4ac','#583438','#583438','#fff5df'],'21':['#c8efdc','#672d4d','#672d4d','#fff5df'],'22':['#2146c7','#fff2d2','#fff2d2','#2146c7'],'23':['#d8f0e2','#2c5644','#2c5644','#fff6de'],'24':['#ffe993','#5c344b','#5c344b','#fff5d8'],'25':['#cbb5ed','#39214a','#39214a','#fff5df'],'26':['#f5d8a9','#5a3a2a','#5a3a2a','#fff5df'],'27':['#dcf0ce','#344335','#344335','#fff5df'],'28':['#eed1b3','#47345f','#47345f','#fff5df'],'29':['#162d29','#f9edc9','#e8ed89','#24342c'],'30':['#fff0b6','#4a3350','#4a3350','#fff7de']};
const accents={'32':'#c1a8fc','34':'#edb986','36':'#a5baff','37':'#e8bb60','38':'#ffa17a','39':'#9eb7ff','41':'#ffa186','43':'#bfa5ff','45':'#ff9a6a','47':'#b2c8ff','48':'#ff9e79','49':'#e2be8d'};
const imageNames={'01':'gobbler.png','02':'machine.png','04':'audio.png','05':'audit-face.svg','07':'audit-door.svg','08':'audit-camp.svg','11':'sneaker.png','12':'perfume.png','13':'audit-face.svg','14':'audit-flower.svg','16':'cosmic.png','18':'retail-care.png','19':'audit-pixel.svg','20':'perfume.png','23':'audit-bubbles.svg','25':'gobbler.png','26':'snack.png','28':'audit-pixel.svg','30':'audit-face.svg'};
const output=[];
for(const d of designs){
 num=0;const a=d.copySpec||{},headline=a.headline?plain(a.headline):plain(first(d.html));
 const body=({'46':'Request the November 26 preview of selected Black Friday offers.','49':'A favorite corner. A better everyday. A Black Friday price.'})[d.id]||({'02':'A small welcome for your first order. Enter the code below at checkout.','10':'Start with a little saving. Enter the code below on your first order.','19':'Use the code below on selected gaming accessories.','27':'A simple welcome. Enter the code below at checkout.'})[d.id]||a.body||plain(d.html.match(/<p class="(?:copy|r-small)">([\s\S]*?)<\/p>/)?.[1])||d.campaign;
 const cta=({'01':'Get 15% off','02':'Shop with 10% off','03':'Shop with 40% off','04':'Shop audio','05':'Shop the Friday edit','06':'Shop the savings','07':'Request access','08':'Shop outdoor','09':'Shop with 30% off','10':'Use my welcome offer','11':'Shop sneakers','12':'Shop fragrance','13':'Join the preview','14':'Shop the garden edit','15':'Request my pass','16':'Shop essentials','17':'Shop the archive','18':'Shop the gift offer','19':'Shop with my code','20':'Shop fragrance','21':'Shop the sweet edit','22':'Shop Black Friday','23':'Shop the packing perk','24':'Get early access','25':'Get my welcome offer','26':'Shop breakfast','27':'Use my welcome offer','28':'Shop the sale','29':'Shop all departments','30':'Shop the event','31':'Shop the drop','32':'Shop tech deals','33':'Shop Black Friday','34':'Shop coffee','35':'Get early access','36':'Shop care essentials','37':'Use my ticket','38':'Shop the final hours','39':'Shop audio','40':'Shop the layer edit','41':'Shop the gift offer','42':'Shop and save','43':'Choose annual','44':'Get the drop alert','45':'Shop before it ends','46':'Get first dibs','47':'Shop with free delivery','48':'Use my code','49':'Shop the home edit','50':'Shop Black Friday'})[d.id]||a.cta||plain(d.html.match(/<button class="cta"[^>]*><span>([\s\S]*?)<\/span>/)?.[1])||'Shop the offer';
 const terms=a.terms||({'32':'Example item reduced from $120 to $84. Nov 27–30.','35':'Preview opens November 26. Selected offers.','40':'Up to 40% off selected layers. November 27–30.','41':'Gift on orders $75+. One per order, subject to availability.','42':'Highest eligible tier applies. Selected items; discounts do not combine.','43':'New annual plans. First year $120. Renews at $240/year unless cancelled.','44':'Preview opens November 26. Up to 40% off selected items.','46':'Preview opens November 26. Up to 40% off selected items.','47':'Free standard shipping on orders $100+. Nov 27–30.','48':'Extra 10% off selected sale styles. Enter your code at checkout. Nov 27–30.'})[d.id]||'November 27–30. Selected items. Exclusions apply.';
 const signup=!!a.signup||['35','44','46'].includes(d.id);const subtitles=(d.occasion==='Black Friday'?'BLACK FRIDAY / ':'')+d.campaign.replace(/^Black Friday\s*/i,'').toUpperCase();
 const E=()=>eyebrow(subtitles),H=()=>h(headline),B=()=>t(body),F=()=>t(terms.replace(/code below/g,'code shown'),'fine_print',{'text-size':'.875rem'});
 let fieldId,consentId;
 const action=()=>{if(!signup)return leaf('button',{role:'cta_label',label:cta,action:'link',icon:'arrow'});const f=leaf('field',{name:'email',label:'Email address',placeholder:'you@example.com',required:true});fieldId=f.id;const c=leaf('consent',{role:'consent_text',text:'Email me Black Friday offers. I can unsubscribe anytime.',hidden:true});consentId=c.id;return stack(f,c,leaf('button',{role:'cta_label',label:cta,icon:'arrow',action:'submit',submission:'email-preview'}));};
 const content=(extra=[])=>panel([E(),H(),B(),...extra,action(),F()]);
 const pic=(key=imageNames[d.id],height=d.format==='Slide-in'?'14rem':'23rem')=>panel([image(key,height)],{pad:'0',gap:'0'},{narrow:{pad:'0'}});
 const offer=(text,size='4.5rem')=>({...t('%b','body',{'text-size':size,leading:'.95',font:'"Bebas Neue", Impact, sans-serif'}),emphasis:text,narrow:{'text-size':Math.min(parseFloat(size),text.replace(/\n/g,'').length>10?2.8:4.5)+'rem'}});
 const invert={bg:'accent',fg:'accent-fg',muted:'accent-fg'};
 const dec=(kind,motion='none',x=50,y=50,size=130,color='accent')=>({label:'Decorative '+kind,hidden:false,items:[{kind,motion,x,y,size,color}]});
 const ornamental=(kind,motion='none',min='7rem',color='accent')=>panel([],{pad:'0',gap:'0'},{min,decorations:dec(kind,motion,50,50,130,color),narrow:{pad:'0'}});
 const photo=(name,height='18rem',motion)=>{const i=image(name,height);if(motion)i.motion=motion;return i};
 const ribbon=(text)=>panel([eyebrow(text)],{...invert,pad:'.75rem 1.5rem',radius:'0'});
 const barcode=(motion='none')=>ornamental('barcode',motion,'2.5rem','fg');
 const compactAction=()=>{const result=action();if(!signup)return result;return stack(row(result.children[0],result.children[2]),result.children[1]);};
 let c;
 switch(d.id){
 case '01':c=split(pic('gobbler.png','28rem'),content([panel([row(offer('15%','4rem'),t('OFF YOUR\nFIRST ORDER'))],{bg:'input-bg',radius:'1rem',pad:'1rem'})]));break;
 case '02':c=split(content([codeLeaf('WELCOME10')]),stack(photo('machine.png','23rem'),panel([eyebrow('YOUR WELCOME PERK')],{bg:'input-bg',pad:'1rem',align:'center'})));break;
 case '03':c=split(content(),panel([panel([eyebrow('YOUR BLACK FRIDAY CODE'),offer('40%','6rem'),t('OFF SELECTED ITEMS','body',{'text-size':'.875rem'}),codeLeaf('FRIDAY40'),barcode()],{bg:'input-bg',fg:'border',muted:'border',radius:'.15rem',pad:'2rem 1.25rem',align:'center'},{notch:true,notch_position:'sides'})],{pad:'1.75rem 1.25rem',gap:'0'}),.65);break;
 case '04':c=split(content(),panel([photo('audio.png','25rem'),ornamental('equalizer','levels','3rem')],{pad:'0',gap:'0'}));break;
 case '05':c=panel([eyebrow('THE FRIDAY EDIT / NOVEMBER 27–30'),split(panel([eyebrow('YOUR WISHLIST…'),image('audit-face.svg','6rem'),t('YES.')],{bg:'input-bg',pad:'1rem'}),panel([H(),badge('SELECTED FAVOURITES')],{...invert,pad:'1.5rem'})),panel([t('One happy ending.')],{bg:'input-bg',pad:'1rem',align:'center'}),action(),F()],{pad:'1rem',gap:'.75rem',radius:'0',border:'fg'},{edges:'all'});break;
 case '06':c=split(panel([panel([eyebrow('EXAMPLE PRICE / 40% OFF'),t('WAS $100'),offer('$60','6rem'),ornamental('bubbles','none','2rem','fg')],{bg:'input-bg',fg:'border',muted:'border',radius:'1rem',align:'center',pad:'2rem 1rem'})],{pad:'1.75rem'}),content());break;
 case '07':c=split(panel([photo('audit-door.svg','26rem')],{pad:'0',gap:'0'},{decorations:dec('halo','pulse',50,30,160)}),content());break;
 case '08':c=split(panel([photo('audit-camp.svg','25rem'),badge('MORE OUTSIDE')],{pad:'0',gap:'0'}),content());break;
 case '09':c=panel([ornamental('eyes','blink','2.8rem','fg'),E(),H(),row(t('ORIGINAL PRICE'),t('100%')),divider(),row(t('YOUR DISCOUNT'),t('−30%')),divider(),row(t('YOU SAVE'),offer('30%','4rem')),action(),F()],{align:'center',radius:'0',pad:'2.5rem 1.75rem'});break;
 case '10':c=split(panel([ornamental('rings','pulse','9rem'),panel([offer('15%','5rem'),codeLeaf('WELCOME15')],{...invert,align:'center',radius:'6rem 6rem 1rem 1rem'})],{pad:'1.5rem',gap:'.5rem'}),content());break;
 case '11':c=split(pic('sneaker.png','27rem'),content([row(offer('40%','5rem'),t('OFF SELECTED\nSNEAKERS'))]));break;
 case '12':c=stack(split(panel([E(),H(),B()],{pad:'2rem'}),panel([photo('perfume.png','23rem')],{pad:'1.5rem',radius:'10rem 10rem 0 0'})),panel([row(offer('30%','4rem'),t('SELECTED FRAGRANCES'),action()),F()],{pad:'1.5rem'}));break;
 case '13':c=stack(ribbon('THE WISHLIST EDIT / BLACK FRIDAY PREVIEW'),panel([panel([t('The preview opens November 26.')],{bg:'input-bg',pad:'.8rem',radius:'1rem 1rem 1rem 0'}),panel([t('What is the offer?')],{...invert,pad:'.8rem',radius:'1rem 1rem 0 1rem'}),panel([t('Up to 30% off selected favourites.')],{bg:'input-bg',pad:'.8rem',radius:'1rem 1rem 1rem 0'})],{pad:'1rem 1.5rem',gap:'.6rem'},{decorations:dec('sparkle','pulse',94,5,20)}),content());break;
 case '14':c=split(content(),panel([photo('audit-flower.svg','19rem','drift'),badge('GROW MORE')],{pad:'1.75rem'}));break;
 case '15':c=split(panel([eyebrow('THE FRIDAY\nPREVIEW PASS'),leaf('icon',{name:'star'}),panel([t('UP TO'),offer('30% OFF','3.5rem'),t('OPENS NOVEMBER 26')],{bg:'input-bg',fg:'border',muted:'border',radius:'2rem',align:'center',pad:'1.25rem'}),barcode()],{...invert,pad:'2rem',radius:'.8rem'}),content());break;
 case '16':c=split(content(),panel([photo('cosmic.png','27rem')],{pad:'0'},{decorations:dec('sparkle','pulse',82,12,50)}));break;
 case '17':c=stack(ribbon('THE BLACK FRIDAY ARCHIVE / NOVEMBER 27–30'),split(content(),panel([panel([eyebrow('SELECTED ARCHIVE'),offer('UP TO\n60% OFF','4.6rem'),barcode(),t('NOVEMBER 27–30')],{bg:'input-bg',fg:'border',muted:'border',pad:'1.5rem',radius:'.15rem'})],{pad:'1.5rem'})));break;
 case '18':c=split(pic('retail-care.png','25rem'),content([leaf('icon',{name:'gift'})]));break;
 case '19':c=panel([E(),panel([ornamental('pixel','drift','5rem'),H(),B(),codeLeaf('FRIDAY30')],{border:'accent',pad:'1.25rem',radius:'.25rem'},{edges:'all'}),action(),F()],{pad:'1rem',radius:'1rem',border:'accent'},{edges:'all'});break;
 case '20':c=split(panel([photo('perfume.png','8rem'),photo('perfume.png','8rem'),photo('perfume.png','8rem'),eyebrow('THE FRAGRANCE EDIT')],{pad:'.6rem',bg:'input-bg',gap:'.5rem'}),content([offer('30% OFF','4rem')]));break;
 case '21':c=panel([row(offer('25%','4rem'),stack(E(),H()),action()),F()],{pad:'1.5rem 2rem',radius:'3rem'});break;
 case '22':c=panel([row(stack(E(),H()),timer(),action()),F()],{pad:'1.5rem 2rem',radius:'0'});break;
 case '23':c=panel([row(ornamental('bubbles','pulse','4rem'),stack(E(),H()),action()),F()],{pad:'1.5rem 2rem'});break;
 case '24':c=panel([split(stack(E(),H()),stack(compactAction(),F()),.35)],{pad:'2rem 3rem 2rem 2rem',radius:'.5rem'});c.children[0].basis='38rem';c.children[0].tokens.gap='1rem';break;
 case '25':c=stack(ribbon('A LITTLE HELLO'),photo('gobbler.png','15rem'),content());break;
 case '26':c=stack(photo('snack.png','15rem'),content());break;
 case '27':c=split(panel([panel([t('YOUR FIRST ORDER'),offer('10%','5rem'),t('LESS'),codeLeaf('WELCOME10')],{...invert,pad:'2rem',align:'center',radius:'50%'})],{pad:'1.5rem',bg:'input-bg'}),content());break;
 case '28':c=panel([E(),H(),grid([ornamental('pixel','drift','6rem'),ornamental('pixel','drift','6rem'),ornamental('pixel','drift','6rem')],'8rem'),row(offer('30%','4rem'),B(),action()),F()],{pad:'2rem',border:'fg',radius:'.5rem'},{edges:'all'});break;
 case '29':c=panel([row(stack(E(),H()),action()),grid([stack(photo('sneaker.png','13rem'),eyebrow('01 / FOOTWEAR')),stack(photo('retail-desk.png','13rem'),eyebrow('02 / EVERYDAY TECH')),stack(photo('audio.png','13rem'),eyebrow('03 / AUDIO'))]),B(),F()],{pad:'2rem',radius:'.5rem'});break;
 case '30':c=panel([grid([ornamental('balloon','drift','5rem'),ornamental('balloon','drift','5rem')],'5rem'),E(),H(),offer('20% OFF','6rem'),B(),action(),F()],{align:'center',radius:'1.5rem'});break;
 case '31':c=stack(panel([E(),h('BLACK FRIDAY',{'heading-size':'5.8rem'})],{pad:'1.5rem 2rem .5rem'}),split(panel([photo('retail-street.png','23rem','arrive')],{pad:'0'}),panel([eyebrow('THE BIG FIT EVENT'),offer('UP TO\n40% OFF','4.8rem'),t('Selected fleeces, layers and everyday favourites.')],{pad:'2rem'}),.65),panel([action(),F()],{pad:'1.25rem 2rem'}));break;
 case '32':c=stack(panel([E(),H()],{pad:'1.75rem'}),photo('retail-desk.png','15rem'),panel([row(stack(eyebrow('SAMPLE ITEM'),t('WAS $120'),offer('$84','4rem')),badge('30% OFF')),action(),F()],{pad:'1.75rem'}));break;
 case '33':c=panel([E(),eyebrow('UP TO'),offer('50%','10rem'),ribbon('BLACK FRIDAY / SELECTED FAVOURITES'),H(),action(),F()],{align:'center',pad:'2rem',gap:'.75rem'});break;
 case '34':c=panel([E(),H(),photo('retail-coffee.png','17rem'),divider(),row(t('COFFEE ESSENTIALS'),offer('30% OFF','2.5rem')),action(),F()],{align:'center',pad:'1.75rem',border:'accent'},{edges:'all'});break;
 case '35':c=split(panel([eyebrow('BLACK FRIDAY'),offer('26','6rem'),t('NOVEMBER\nONE DAY EARLY'),barcode()],{...invert,align:'center',pad:'2rem 1.5rem'}),panel([badge('UP TO 40% OFF'),H(),B(),action(),F()],{pad:'2rem'},{decorations:dec('halo','pulse',90,7,60)}),.35);break;
 case '36':c=panel([E(),grid(['24% 50%','50% 50%','80% 50%'].map(position=>{const p=photo('retail-care.png','15rem','arrive');p.tokens['image-position']=position;p.narrow['image-height']='9rem';return p}),'4rem'),H(),row(offer('30% OFF','4.5rem'),B()),action(),F()],{pad:'2rem'});break;
 case '37':c=split(panel([E(),H(),offer('35% OFF','5rem'),F()],{pad:'2rem'}),panel([codeLeaf('FRIDAY35'),barcode('pulse'),action()],{bg:'input-bg',fg:'border',muted:'border',pad:'2rem 1.25rem',radius:'0'},{notch:true,notch_position:'sides'}),.65);break;
 case '38':c=split(panel([E(),photo('retail-trainers.png','15rem'),H(),B(),action(),F()],{pad:'1.75rem'}),panel([eyebrow('TIME LEFT'),timer(),t('ENDS NOVEMBER 30')],{bg:'input-bg',pad:'2rem 1rem'}),.65);break;
 case '39':c=panel([E(),grid([H(),{...photo('audio.png','18rem','breathe'),tokens:{radius:'50%','image-height':'auto'},narrow:{'image-height':'auto'}},offer('35%\nOFF','4rem')],'12rem'),row(B(),action()),F()],{pad:'2rem'});break;
 case '40':c=stack(split(pic('retail-street.png','16rem'),panel([E(),H(),offer('UP TO 40% OFF','2rem'),F()],{pad:'1.25rem'}),.35),panel([action()],{pad:'1rem'}));c.children[0].basis='8rem';break;
 case '41':c=panel([E(),H(),split(panel([photo('retail-care.png','15rem'),eyebrow('A TRAVEL-SIZE MOISTURISER')],{pad:'.6rem',border:'fg'},{edges:'all'}),panel([offer('+','6rem'),t('ON US.'),t('With orders\nof $75 or more.')],{pad:'1.5rem'})),action(),F()],{pad:'2rem'});break;
 case '42':c=panel([E(),H(),grid(['15%','20%','25%'].map((pct,i)=>panel([photo(['retail-desk.png','retail-care.png','retail-trainers.png'][i],(7+i*2)+'rem'),eyebrow('SPEND $'+[100,200,300][i]),offer(pct,'4.5rem')],{bg:'input-bg',pad:'.75rem',align:'center'})),'8rem'),row(B(),action()),F()],{pad:'2rem'});break;
 case '43':c=panel([E(),H(),grid(Array.from({length:12},(_,i)=>panel([eyebrow('MO'),offer(String(i+1).padStart(2,'0'),'2.1rem')],{bg:'input-bg',pad:'.6rem',align:'center',gap:'.2rem'})),'5rem'),row(stack(t('WAS $240'),offer('$120','4rem'),eyebrow('YOUR FIRST YEAR')),action()),F()],{pad:'2rem'},{decorations:dec('sparkle','arrive',94,5,30)});break;
 case '44':c=panel([E(),offer('40%','7rem'),eyebrow('UP TO / OFF SELECTED ITEMS'),H(),B(),action(),F()],{pad:'1.75rem'});break;
 case '45':c=stack(panel([row(E(),h('UP TO 40% OFF.',{'heading-size':'2.5rem'}))],{...invert,pad:'1rem 2rem',radius:'0'}),panel([row(timer(),stack(eyebrow('ENDS NOVEMBER 30'),t('23:59 UTC')),action()),F()],{pad:'1.25rem 2rem',radius:'0'}));break;
 case '46':c=split(panel([offer('26','5rem'),eyebrow('NOV / EARLY ACCESS')],{...invert,pad:'1.75rem',align:'center'}),panel([E(),H(),compactAction(),F()],{pad:'1.75rem 3rem 1.75rem 1.75rem'}),.35);c.basis='20rem';break;
 case '47':c=panel([row(panel([E(),barcode(),eyebrow('STANDARD / NOVEMBER 27–30')],{bg:'input-bg',fg:'border',muted:'border',pad:'1rem'}),offer('$0','5rem'),{...h('DELIVERY\nON ORDERS $100+',{'heading-font':'"DM Sans", Arial, sans-serif','heading-size':'1rem','heading-leading':'1.5'}),narrow:{'heading-size':'1rem'}},action()),F()],{pad:'1.5rem'});break;
 case '48':c=stack(photo('retail-trainers.png','14rem'),panel([E(),{...h('EXTRA\n10% OFF',{'heading-size':'5rem'}),narrow:{'heading-size':'4.5rem'}}],{pad:'1.5rem'}),panel([codeLeaf('EXTRA10'),action(),F()],{bg:'input-bg',pad:'1.5rem'},{notch:true}));break;
 case '49':c=grid([pic('premium-interior.png','28rem'),panel([E(),eyebrow('01 / THE WEEKEND EDIT'),H(),B()],{pad:'1.5rem'}),panel([eyebrow('SELECTED HOMEWARE'),offer('30%','6rem'),t('OFF'),action(),F()],{pad:'1.5rem',bg:'input-bg'})],'12rem');break;
 case '50':c=panel([E(),h('BLACK FRIDAY. ALL IN.',{'heading-size':'5rem'}),grid([stack(photo('retail-street.png','20rem','arrive'),eyebrow('01 / WEAR IT')),stack(photo('retail-desk.png','20rem','arrive'),eyebrow('02 / UPGRADE IT')),stack(photo('retail-care.png','20rem','arrive'),eyebrow('03 / RESTOCK IT'))]),row(stack(eyebrow('UP TO'),offer('50%','7rem'),t('OFF SELECTED COLLECTIONS')),action()),F()],{pad:'2rem'});break;
 }
 const p=palette[d.id]||['#101211','#f4f4eb',accents[d.id]||'#d9f86b','#181a12'];
 const tokens={bg:p[0],fg:p[1],muted:p[1],accent:p[2],'accent-fg':p[3],border:p[1],'input-bg':p[0],placeholder:'fg',font:'"DM Sans", Arial, sans-serif','heading-font':'"Bebas Neue", Impact, sans-serif','heading-size':d.format==='Bar'?'2rem':'3.6rem','heading-weight':'400','heading-leading':'.95','text-size':'1rem',leading:'1.5',tracking:'0',pad:'2.75rem 0 0',gap:'0',radius:'.25rem',width:d.format==='Slide-in'?'24rem':d.format==='Bar'?'100%':d.format==='Fullscreen'?'60rem':'45rem',motion:'0ms','close-bg':'#171a1d','close-fg':'#ffffff','close-border':'#ffffff','close-inset':'.5rem','error-fg':'#ffffff','error-bg':'#8f2020'};
 // Extra palette swatches remain top-level, so nested boxes follow editor colour changes.
 Object.assign(tokens,({
 '01':{'input-bg':'#ffbd86'},'02':{'input-bg':'#f9e3b8'},'03':{'input-bg':'#bfe9c1',border:'#194437'},
 '05':{'input-bg':'#f4bd72'},'06':{'input-bg':'#bc454c',border:'#fff0d6'},'13':{'input-bg':'#fff0dd'},
 '15':{'input-bg':'#e7dac2',border:'#334637'},'17':{'input-bg':'#fff5d9',border:'#332d25'},
 '20':{'input-bg':'#f5e4cd'},'27':{'input-bg':'#c0d9b4'},'37':{'input-bg':'#e8bb60',border:'#181a12',accent:'#181a12','accent-fg':'#fff8df'},
 '38':{'input-bg':'#252b27'},'42':{'input-bg':'#29312a'},'43':{'input-bg':'#282330'},'47':{'input-bg':'#f5efe4',border:'#18201e'},'48':{'input-bg':'#2b2822'},'49':{'input-bg':'#262b27'}
 })[d.id]||{});
 if(['07','12','13','15'].includes(d.id))tokens['heading-font']='"Cormorant Garamond", Georgia, serif';
 if(d.format==='Slide-in')tokens['heading-size']='2.7rem';
 const steps=[{id:'offer',name:'Offer',kind:signup?'input':'content',content:c}],submissions=[];
 if(signup){submissions.push({id:'email-preview',required:true,fields:[fieldId],consents:[consentId]});steps.push({id:'received',name:'Request received',kind:'acknowledgement',content:panel([leaf('heading',{role:'success_headline',text:'Request received'}),leaf('text',{role:'success_body',text:'Thanks for requesting the Black Friday preview.'}),leaf('text',{role:'fine_print',text:'You can close this window and continue browsing.'})])});}
 const id='campaign-'+d.name.replace(/^The /,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
 const native={id,name:d.name.replace(/^The /,''),display_type:({'Bar':'floating_bar','Slide-in':'slide_in','Fullscreen':'fullscreen','Inline':'inline','Popup':'popup'})[d.format],tier:['Popup','Inline'].includes(d.format)?'free':'pro',tokens,tree:{v:2,steps,submissions,fonts:[{family:'DM Sans',faces:[{weight:400,italic:false},{weight:700,italic:false}]},{family:'Bebas Neue',faces:[{weight:400,italic:false}]},{family:'Cormorant Garamond',faces:[{weight:400,italic:false}]}]}};
 const directory=native.tier==='free'?'tools/design-library/hosted':'pro/modules/display-types';
 fs.writeFileSync(path.join(root,directory,'templates',id+'.json'),JSON.stringify(native,null,2)+'\n');
 output.push(native);
 const requirements=[signup?'Choose an email destination or Collect only, and review the signup wording.':'Set the shop link and review the offer, eligible items and terms.', 'Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.',...(d.id==='22'||d.id==='38'||d.id==='45'?['Set a real campaign end date for the countdown.']:[]),...(native.display_type==='inline'?['Place the campaign with its block or shortcode.']:[])];
 mapping.push({id:d.id,native_id:id,name:native.name,tier:native.tier,goal:signup?'grow_email_list':'promote_offer',audience:'stores',requirements,idea:d.desc,directory,occasion:d.occasion,screens:steps.map(s=>({id:s.id,name:s.name}))});
 words.designs[id]={description:d.desc,industries:['retail'],occasions:[d.occasion==='Black Friday'?'black-friday':'evergreen'],style:[d.id>='31'?'editorial':'soft'],colour:[d.id>='31'?'dark':'warm']};
 collection.entries=collection.entries.filter(e=>e.id!==id);
 collection.entries.push({id,audience:'stores',family:native.name,visitor_need:body,difference:d.desc,requirements,status:'review',source:'User-approved 50-campaign prototype, revision 7.1, 24 October 2026.',suggested_setup:requirements,measure:signup?'Accepted preview requests.':'Offer link clicks.',batch:'black-friday-and-everyday',comparison:{decision:'new_design',against:['halloween-bats'],reason:d.desc}});
}
collection.batches=collection.batches.filter(b=>b.id!=='black-friday-and-everyday');collection.batches.push({id:'black-friday-and-everyday',name:'Black Friday and everyday offers'});
for(const [file,data] of [['publishing/catalog.json',catalog],['publishing/designs.json',words],['pilot/collection.json',collection]])fs.writeFileSync(path.join(out,file),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/reviews/black-friday-2026-10-24/prototype-map.json'),JSON.stringify(mapping,null,2)+'\n');
fs.writeFileSync(path.join(here,'native-designs.json'),JSON.stringify(output,null,2)+'\n');
console.log('Authored '+output.length+' production designs');

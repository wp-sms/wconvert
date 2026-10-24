/** Explicit native compositions for the fidelity review; preserve existing leaf identities. */
import fs from 'node:fs';
import { refineReceipt } from './receipt.mjs';
import { refineFirstBatch } from './first-batch-fidelity.mjs';
import { refineRetail } from './retail.mjs';
import { refineCore } from './core.mjs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const map=JSON.parse(fs.readFileSync(path.join(root,'docs/reviews/black-friday-2026-10-24/prototype-map.json')));
const appearance=JSON.parse(fs.readFileSync(new URL('./reference/appearance.json',import.meta.url)));
const copy=JSON.parse(fs.readFileSync(new URL('./reference/copy.json',import.meta.url)));
const DM='"DM Sans", Arial, sans-serif',DISPLAY='"Bebas Neue", Impact, sans-serif';
const sizes=[53,66,58,72,68,62,41,58,48,51,67,45,42,49,40,62,55,56,62,60,34,34,34,32,37,43,53,55,60,85,102,36,27,65,44,48,41,35,80,31,47,35,49,39,34,25,76,85,80,92];
const mobile=[45,55,50,65,49,52,33,48,43,45,58,35,35,42,34,54,44,48,51,51,33,38,33,32,35,40,47,43,49,56,49,30,27,58,32,35,31,30,50,25,31,27,34,34,28,29,70,76,62,57];
for(const item of map.filter(item=>!process.env.FIDELITY_IDS||process.env.FIDELITY_IDS.split(',').includes(item.id))){
 const file=path.join(item.directory,'templates',item.native_id+'.json');
 // A frozen input makes refinements reproducible without ever allocating a new id to an old leaf.
 const d=JSON.parse(execFileSync('git',['show',`d7688edf:${file}`],{cwd:root,encoding:'utf8'}));
 const id=Number(item.id), ref=appearance[item.id], words=copy[item.id], all=[];
 const walk=(n,fn)=>{fn(n);if(n.content)walk(n.content,fn);for(const k of ['steps','children','start','end'])for(const c of n[k]||[])walk(c,fn);};
 walk(d.tree,n=>{if(n.id&&n.type)all.push(n)});
 let serial=Math.max(...all.map(n=>Number(n.id.slice(1))));
 const leaf=(type,role,text,tokens={})=>({type,id:'n'+(++serial),role,text,tokens});
 const text=(s,tokens={})=>leaf('text','body',s,tokens);
 const label=(s,tokens={})=>leaf('eyebrow','eyebrow',s,{'text-size':'9px',tracking:'.08em',...tokens});
 const strong=(s,size='64px',color='fg')=>({...text('%b',{font:DM,'text-size':size,leading:'.95',tracking:'-.04em',fg:color}),emphasis:s,narrow:{'text-size':Math.min(parseFloat(size),64)+'px'}});
 const stack=(children,gap='16px')=>({type:'stack',children,tokens:{gap}});
 const panel=(children,tokens={},narrow={})=>({type:'panel',children,tokens:{pad:'28px',gap:'16px',radius:'0',...tokens,...(tokens.fg?{muted:tokens.fg}:{})},narrow:{pad:/^4|^5/.test(tokens.pad||'')?'42px 22px 24px':'24px',...narrow}});
 const split=(a,b,ratio=.5,basis='15rem',gap='0')=>({type:'split',start:[a],end:[b],ratio,basis,narrow_layout:'stack',tokens:{gap}});
 const row=(children,tokens={})=>({type:'row',children,tokens:{gap:'20px',...tokens}});
 const grid=(children,basis='9rem',gap='10px')=>({type:'grid',basis,children,tokens:{gap}});
 const old=(role,index=0)=>all.filter(n=>n.role===role)[index];
 const H=old('headline'), hi=all.indexOf(H), E=all.slice(0,hi).filter(n=>n.role==='eyebrow').at(-1)||old('eyebrow'), B=all.slice(hi+1).find(n=>n.role==='body'&&n.text!=='%b'), A=all.find(n=>n.type==='button'), F=old('fine_print');
 const pics=all.filter(n=>n.type==='image'), codes=all.filter(n=>n.type==='code'), timer=all.find(n=>n.type==='countdown');
 const img=(index,height,position)=>{const p=pics[index];p.tokens={...p.tokens,'image-height':height,radius:'0'};if(position)p.tokens['image-position']=position;p.narrow={'image-height':Math.min(parseFloat(height),240)+'px'};return p;};
 const barcode=()=>({type:'panel',children:[],min:'30px',tokens:{pad:'0',radius:'0'},decorations:{label:'Decorative barcode',hidden:false,items:[{kind:'barcode',x:50,y:50,size:160,color:'fg',motion:'none'}]}});
 const form=()=>stack([all.find(n=>n.type==='field'),all.find(n=>n.type==='consent'),A].filter(Boolean),'12px');
 const action=d.tree.submissions.length?form():A;
 const heading=(size,color)=>{H.tokens={...H.tokens,'heading-size':size};if(color)H.tokens.fg=color;return H;};
 d.tokens={...d.tokens,width:ref.width+'px',pad:'0',gap:'0','text-size':'14px',leading:'1.5','heading-size':sizes[id-1]+'px','heading-leading':'.96','heading-weight':id>=31?'900':d.tokens['heading-weight'],radius:[1,2,6,10,13,21,23,24,25,26,27].includes(id)?'12px':'0',bg:ref.palette['--bg'],fg:ref.palette['--fg'],muted:ref.palette['--fg'],accent:ref.palette['--accent'],'accent-fg':ref.palette['--button-ink']};
 if(words.headline)H.text=words.headline;
 if(id<=30&&words.eyebrow&&id!==5&&id!==19)E.text=words.eyebrow;
 if(words.cta&&!/WELCOME|FRIDAY\d|EXTRA10/.test(words.cta))A.label=words.cta;
 if(id>=31)d.tokens['heading-font']=([31,34,39,49,50].includes(id)?DISPLAY:DM);
 if([31,34,39,49,50].includes(id))d.tokens['heading-weight']='400';
 walk(d.tree,n=>{
  if(n.type==='heading'){n.tokens={...n.tokens,'heading-size':sizes[id-1]+'px'};n.narrow={...n.narrow,'heading-size':mobile[id-1]+'px'};}
  if(n.type==='text'&&n.text==='%b'&&id>=31){n.tokens={...n.tokens,font:DM,fg:'accent',tracking:'-.04em'};}
  if(n.type==='button')n.tokens={...n.tokens,'text-size':'14px',radius:ref.buttonRadius};
  if(n.type==='image')n.narrow={...n.narrow,'image-height':'240px'};
  if(n.role==='fine_print')n.tokens={...n.tokens,'text-size':id>=31?'12px':'13px'};
  if(n.type==='eyebrow')n.tokens={...n.tokens,'text-size':'9px',tracking:'.1em'};
 });
 // Close space belongs inside the first painted pane, never in a blank root strip.
 let c=d.tree.steps[0].content;
 const content=(children=[E,H,B,action,F].filter(Boolean),tokens={})=>panel(children,{pad:'48px 32px 28px',...tokens},{pad:'40px 23px 25px'});
 const stretch=(p)=>({...p,type:'media',children:[stack(p.children,p.tokens.gap)]});
 const art=name=>'data:image/png;base64,'+fs.readFileSync(new URL('../pilot/assets/black-friday/fidelity-'+name+'.png',import.meta.url)).toString('base64');
 const drawing=(name,height)=>({...leaf('image',undefined,undefined),src:art(name),alt:'',fit:'contain',shape:'rect',tokens:{'image-height':height},narrow:{'image-height':height}});
 const crop=(p,height,zoom,position)=>panel([],{pad:height+' 0','bg-image':`url("${p.src}")`,'bg-size':zoom,'image-position':position},{pad:'70px 0','bg-size':'auto 300px'});
 const photo=(p,height='360px')=>panel([img(p,height)],{pad:'0',gap:'0'},{pad:'0'});
 const openTimer=(size=31)=>{timer.density='compact';timer.precision='minutes';timer.days_label='DAYS';timer.hours_label='HRS';timer.minutes_label='MIN';timer.tokens={fg:'accent',border:'bg','input-bg':'bg',radius:'0','countdown-size':size+'px','heading-weight':'900'};timer.narrow={'countdown-size':size+'px'};return timer;};
 switch(id){
 case 1:{c=split(photo(0,'450px'),content());c.start[0].tokens.pad='8px';pics[0].tokens.radius='20px 20px 85px 20px';pics[0].tokens['image-position']='center 20%';break;}
 case 2:c=split(content([E,H,B,action,F]),stack([photo(0,'340px'),panel([codes[0]],{bg:'input-bg',pad:'18px 20px',align:'center'})],'0'));c.narrow_layout='reverse';break;
 case 3:{d.tokens['input-bg']='#c2e9c0';d.tokens.border='#154b3c';const ticket=panel([label('YOUR BLACK FRIDAY CODE'),strong('40%','96px','border'),text('OFF SELECTED ITEMS'),codes[0],barcode()],{bg:'input-bg',fg:'border',muted:'border',pad:'44px 20px 26px',align:'center',gap:'22px'});ticket.notch=true;ticket.notch_position='sides';c=split(content(),panel([ticket],{pad:'20px',gap:'0'}),.58);break;}
 case 4:{const equalizer=structuredClone(c.start[0].children.find(n=>n.decorations)||{type:'panel',min:'40px',children:[],tokens:{pad:'0'},decorations:{label:'Audio bars',hidden:false,items:[{kind:'equalizer',x:50,y:50,size:130,color:'accent',motion:'pulse'}]}});const picture=crop(pics[0],'220px','cover','center');picture.decorations=equalizer.decorations;picture.decorations.items[0].x=65;picture.decorations.items[0].y=88;c=split(content([E,H,B,A,F]),picture,.5);c.narrow_layout='reverse';break;}
 case 5:{const oldPanels=c.children;const comic=oldPanels.find(n=>n.type==='split');d.tokens['input-bg']='#c5e7cc';d.tokens.border='#efb7c7';comic.end[0].tokens={...comic.end[0].tokens,bg:'border',fg:'fg',muted:'fg'};pics[0].src=art('face');pics[0].tokens['image-height']='150px';pics[0].narrow={'image-height':'90px'};comic.start[0].edges='all';comic.start[0].tokens.border='fg';delete comic.end[0].edges;delete comic.end[0].tokens.border;c=panel([label('THE FRIDAY EDIT / BLACK FRIDAY / NOV 27–30'),comic,split(F,A,.5,'12rem','18px')],{pad:'32px 20px 20px',gap:'18px'});break;}
 case 6:{const price=c.start[0].children[0];price.children=price.children.filter(n=>!n.decorations);price.children[1].tokens={'text-size':'28px'};price.tokens.pad='35px 20px';delete price.tokens.border;price.edges='all';price.children[1].text='WAS $100';price.children.push(label('↓',{'text-size':'24px'}));price.children.splice(2,0,price.children.pop());c=split(panel([price],{pad:'25px'}),content());break;}
 case 7:pics[0].src=art('door');c=split(photo(0,'440px'),content(),.4);break;
 case 8:c=split(photo(0,'400px'),content());break;
 case 9:{const texts=all.filter(n=>n.type==='text');c=panel([c.children[0],E,H,row(texts.slice(0,2),{align:'space-between'}),{type:'divider'},row(texts.slice(2,4),{align:'space-between'}),{type:'divider'},row(texts.slice(4,6),{align:'space-between'}),A,barcode(),F],{pad:'45px 32px 32px',gap:'18px'});break;}
 case 10:{d.tokens['input-bg']='#e9867b';d.tokens.border='#be92d3';d.tokens.muted='#e9efbc';const inner=panel([Object.assign(strong('15%','63px'),{tokens:{font:DISPLAY,'text-size':'63px'}}),codes[0]],{bg:'muted',fg:'accent',pad:'68px 10px 30px',radius:'150px 150px 12px 12px',align:'center',gap:'24px'});delete inner.tokens.muted;inner.narrow={pad:'45px 5px 25px'};const arch=panel([panel([inner],{pad:'18px',bg:'border',radius:'170px 170px 12px 12px'})],{pad:'18px',bg:'input-bg',radius:'190px 190px 12px 12px'});arch.narrow={pad:'12px'};arch.children[0].narrow={pad:'12px'};codes[0].tokens={font:'monospace','text-size':'12px',tracking:'0'};c=split(panel([arch],{pad:'22px'}),content(undefined,{muted:'fg'}),.5,'19rem');break;}
 case 11:c=split(photo(0,'420px'),content());break;
 case 12:c=stack([split(content([E,H,B]),panel([img(0,'320px')],{pad:'30px 30px 0',radius:'140px 140px 0 0'})),panel([row([Object.assign(strong('30% OFF','38px'),{tokens:{font:DISPLAY,'text-size':'38px'}}),text('SELECTED FRAGRANCES\nNOVEMBER 27–30'),A],{align:'space-between'})],{pad:'20px 32px 28px'})],'0');break;
 case 13:{const bubbles=c.children[1];c=stack([panel([label('THE WISHLIST EDIT'),text('Black Friday preview')],{pad:'28px 56px 16px 24px',gap:'4px'}),bubbles,content([E,H,B,form(),F],{pad:'25px'})],'0');break;}
 case 14:pics[0].src=art('flowers');c=split(photo(0,'330px'),content());c.narrow_layout='reverse';break;
 case 15:{const passport=c.start[0];passport.tokens={...passport.tokens,bg:'accent',fg:'input-bg',muted:'input-bg',radius:'0',border:'input-bg'};passport.edges='all';walk(passport,n=>{if(n.type==='panel'&&n!==passport)n.tokens={...n.tokens,fg:'accent',muted:'accent'};});passport.children.splice(1,0,drawing('globe','95px'));c=split(panel([passport],{pad:'20px'}),content(),.36);break;}
 case 16:c=split(content(),photo(0,'430px'),.55);c.narrow_layout='reverse';break;
 case 17:c.tokens.gap='0';c.children[0].tokens.pad='16px 56px 16px 24px';c.children[1].start[0]=content();c.children[1].ratio=.7;c.children[1].basis='8rem';c.children[1].narrow_layout='stack';break;
 case 18:c=split(stack([photo(0,'350px'),panel([label('A LITTLE EXTRA / ON ORDERS $75+')],{pad:'20px',bg:'input-bg',align:'center'})],'0'),content());break;
 case 19:{d.tokens['input-bg']='#263e35';d.tokens.border='#bce6b9';c.tokens.pad='44px 20px 20px';c.children[1].tokens={...c.children[1].tokens,bg:'input-bg',fg:'border',muted:'border',pad:'28px',align:'center'};H.tokens.fg='border';break;}
 case 20:{const images=pics.map((p,i)=>crop(p,'62px','160% auto',['50% 45%','50% 12%','50% 90%'][i]));const strip=grid(images,'12rem','8px');strip.narrow_basis='4rem';c=split(panel([strip,label('THE FRAGRANCE EDIT / BLACK FRIDAY')],{pad:'12px',gap:'8px',bg:'input-bg'}),content(),.33,'6rem');break;}
 case 21:c=panel([split(row([panel([strong('25%','45px')],{bg:'accent',fg:'accent-fg',pad:'25px 17px',radius:'50%'}),stack([E,H],'12px')]),A,.72,'19rem','24px')],{pad:'28px 56px 28px 32px',radius:'48px'});break;
 case 22:c=panel([split(stack([E,H],'12px'),row([openTimer(30),A],{align:'space-between'}),.45,'22rem','24px')],{pad:'28px 56px 28px 30px'});break;
 case 23:{const bubbles=drawing('bubbles','65px');const intro=split(bubbles,stack([E,H],'12px'),.3,'0px','18px');delete intro.narrow_layout;c=panel([split(intro,A,.75,'18rem','24px')],{pad:'32px 56px 26px 30px'},{pad:'42px 23px 25px'});break;}
 case 24:c.tokens.pad='40px 60px 32px 30px';c.children[0].basis='23rem';A.label='Get access';break;
 case 25:pics[0].tokens['image-position']='center 15%';d.tokens.radius='12px';pics[0].tokens.radius='100px 100px 12px 12px';c=stack([photo(0,'245px'),content([E,H,B,A,F],{pad:'25px 24px 28px'})],'0');break;
 case 26:c=stack([photo(0,'240px'),content([E,H,B,A,F],{pad:'25px'})],'0');break;
 case 27:c=split(panel([label('WELCOME'),strong('10% OFF','75px'),codes[0],label('YOUR FIRST ORDER')],{pad:'40px 24px',align:'center',gap:'24px',bg:'input-bg'}),content());break;
 case 28:{const offer=all.find(n=>n.emphasis==='30%');c=panel([split(E,H,.5,'12rem'),drawing('pixels','130px'),{type:'divider'},row([offer,B,A],{align:'space-between'}),F],{pad:'38px 30px 26px',gap:'22px',border:'fg'});c.edges='all';break;}
 case 29:c.tokens.pad='48px 40px 30px';for(const p of pics){p.tokens['image-height']='250px';p.narrow={'image-height':'140px'};}walk(c,n=>{if(n.type==='grid')n.basis='7rem';});break;
 case 30:{c=panel([E,H,B,A,F],{pad:'56px 60px 40px',align:'center',gap:'20px','bg-image':`url("${art('balloons')}")`,'bg-size':'100% auto','image-position':'center 28px'},{pad:'115px 24px 30px','bg-size':'auto 135px','image-position':'center 12px'});break;}
 case 31:{pics[0].tokens['image-position']='center 10%';E.text='EVERYDAY / DROP 027 · 27—30 NOVEMBER';H.text='BLACK FRIDAY';const offer=panel([label('THE BIG FIT EVENT'),strong('40%','102px','accent'),label('UP TO / OFF'),strong('GOOD FITS.\nBETTER PRICES.','19px'),text('Selected fleeces, layers\nand everyday favorites.',{'text-size':'12px'})],{pad:'22px 25px',gap:'18px'},{pad:'18px 12px'});offer.children[1].narrow={'text-size':'58px'};A.label='Shop the Black Friday drop';c=stack([panel([E,H],{pad:'22px 48px 15px 25px',gap:'12px'},{pad:'42px 20px 15px'}),split(photo(0,'290px'),offer,.525,'8rem'),A],'0');break;}
 case 32:{d.tokens['input-bg']='#24212d';A.label='Upgrade your desk';const saving=panel([strong('−30%','43px','accent'),label('BLACK FRIDAY PRICE')],{bg:'input-bg',pad:'21px 22px',gap:'12px'});c=stack([panel([E,H],{pad:'23px 48px 19px 28px',gap:'19px'}),img(0,'205px','center 59%'),split(panel([label('ONE SELECTED ITEM'),row([text('WAS $120'),strong('$84','51px')]),F],{pad:'21px 28px',gap:'12px'}),stretch(saving),.74,'0px'),A],'0');break;}
 case 33:{A.label='Find your Friday deal';c=panel([E,label('UP TO'),strong('50%','190px','accent'),panel([label('BLACK FRIDAY / BIGGER SAVINGS')],{bg:'accent',fg:'accent-fg',pad:'12px',align:'center'}),split(stack([H,text('Selected collections.\nFour days. One annual event.',{'text-size':'12px'})]),A,.5,'14rem','22px')],{pad:'38px 30px 26px',gap:'22px'});c.children[2].narrow={'text-size':'110px'};break;}
 case 34:{d.tokens.bg='#191816';A.label='Shop the morning menu';c=panel([E,heading('65px'),panel([img(0,'145px','center 60%')],{pad:'7px',border:'accent'},{pad:'7px'}),row([label('COFFEE ESSENTIALS'),strong('30% OFF','23px','accent')],{align:'space-between'}),text('Your daily ritual.\nAt a once-a-year price.'),A,F],{pad:'40px 27px 23px',gap:'18px',align:'center'});c.children[2].edges='all';break;}
 case 35:{d.tokens['input-bg']='#2a3022';c=split(panel([label('BLACK FRIDAY'),strong('26','92px'),strong('NOV','23px'),label('ONE DAY\nEARLY'),barcode()],{bg:'accent',fg:'accent-fg',muted:'accent-fg',align:'center',pad:'40px 19px',gap:'24px'}),panel([panel([label('UP TO 40% OFF / EARLY ACCESS')],{bg:'input-bg',fg:'accent',pad:'9px 12px'}),H,B,form(),F],{pad:'45px 30px 30px',gap:'20px'}),.24,'0px');c.start[0]=stretch(c.start[0]);break;}
 case 36:{const images=grid(pics.map((p,i)=>crop(p,'107px','310% auto',['4% 45%','55% 50%','97% 80%'][i])),'4rem','9px');A.label='Shop the Friday restock';c=panel([E,images,split(H,stack([strong('30%','102px'),label('OFF SELECTED CARE')],'8px'),.55,'12rem','15px'),text('The everyday essentials you’ll be glad you stocked up on.'),A],{pad:'42px 29px 25px',gap:'22px'});break;}
 case 37:{A.label='Shop with this code';c=split(panel([E,H,strong('35%','124px','input-bg'),F],{pad:'45px 32px 32px',gap:'24px'}),panel([label('YOUR WEEKEND CODE'),codes[0],barcode(),A,text('Enter at checkout.\nSelected items only.',{'text-size':'12px'})],{bg:'input-bg',fg:'border',muted:'border',pad:'50px 26px 32px',gap:'26px'}),.58,'16rem');c.end[0].notch=true;c.end[0].notch_position='sides';break;}
 case 38:{A.label='Shop before the finish';openTimer(38);c=split(panel([E,img(0,'190px','center 67%'),H,text('Up to 40% off selected training gear.'),A],{pad:'35px 25px 25px',gap:'20px'}),panel([label('TIME LEFT'),timer,text('ENDS NOV 30\n23:59 UTC',{'text-size':'12px'})],{bg:'input-bg',pad:'50px 15px 26px',gap:'24px',align:'center'}),.8,'0px');c.end[0]=stretch(c.end[0]);timer.density='stacked';timer.tokens={...timer.tokens,'countdown-size':'38px',border:'input-bg','input-bg':'input-bg'};break;}
 case 39:{const p=img(0,'auto');p.shape='rect';p.tokens.radius='50%';p.narrow={'image-height':'auto'};A.label='Find your sound';c=panel([E,split(H,split(p,stack([strong('35','79px','accent'),label('% OFF')],'8px'),.72,'7rem','18px'),.24,'8rem','18px'),{type:'divider'},split(text('Better sound.\nA better Black Friday price.'),A,.5,'13rem','20px')],{pad:'42px 29px 26px',gap:'26px'});break;}
 case 40:E.text='BLACK FRIDAY';old('body',0).tokens={'text-size':'12px'};delete old('body',0).narrow;c=stack([split(photo(0,'230px'),panel([E,H,old('body',0),F].filter(Boolean),{pad:'45px 22px 22px',gap:'18px'}),.34,'7rem'),A],'0');break;
 case 41:{A.label='Shop the gift event';const gift=panel([crop(pics[0],'95px','200% auto','100% 72%'),label('A TRAVEL-SIZE MOISTURISER')],{pad:'9px',border:'accent',gap:'13px',align:'center'});gift.edges='all';c=panel([E,H,split(gift,stack([strong('+','100px','accent'),strong('ON US.','29px'),text('With orders\nof $75 or more.')],'18px'),.56,'0px','14px'),A,F],{pad:'42px 31px 28px',gap:'24px'});break;}
 case 42:{A.label='Build your Friday basket';const panels=pics.map((p,i)=>panel([Object.assign(grid([Object.assign(img(i,[66,100,135][i]+'px'),{narrow:{'image-height':'80px'}}),stack([label('SPEND $'+[100,200,300][i]),strong([15,20,25][i]+'%','65px',i===2?'accent-fg':'fg')],'8px')],'9rem','10px'),{narrow_basis:'5rem'})],{bg:i===2?'accent':'input-bg',fg:i===2?'accent-fg':'fg',pad:'10px 10px 18px',gap:'16px'}));c=panel([E,H,grid(panels.map((p,i)=>panel([p],{pad:[64,32,0][i]+'px 0 0',gap:'0'},{pad:'0'})),'10rem'),split(F,A,.45,'14rem','20px')],{pad:'42px 30px 27px',gap:'22px'});break;}
 case 43:{const months=Array.from({length:12},(_,i)=>panel([label('MONTH',{'text-size':'8px'}),strong(String(i+1).padStart(2,'0'),'28px')],{bg:i===11?'accent':'input-bg',fg:i===11?'accent-fg':'fg',pad:'11px 13px',gap:'6px'}));A.label='Get the annual offer';c=panel([E,H,Object.assign(grid(months,'6.25rem','7px'),{narrow_basis:'4rem'}),split(stack([row([text('WAS $240'),strong('$120','51px')]),label('YOUR FIRST YEAR')],'9px'),A,.5,'13rem','25px'),F],{pad:'42px 32px 29px',gap:'24px'});break;}
 case 44:E.text='BLACK FRIDAY';c=panel([E,Object.assign(strong('40%','103px','accent'),{narrow:{'text-size':'85px'}}),label('UP TO / OFF'),H,B,form(),F],{pad:'44px 25px 28px',gap:'20px'});break;
 case 45:{E.text='BLACK FRIDAY / NOV 27—30';A.label='Shop the event';H.tokens={'heading-size':'34px','heading-font':DM,'heading-weight':'900',tracking:'-.04em'};const top=row([E,H,label('THE CLOCK IS ON.')],{align:'space-between',gap:'25px'});c=stack([panel([top],{bg:'accent',fg:'accent-fg',muted:'accent-fg',pad:'22px 60px 19px'},{pad:'40px 50px 22px 24px'}),panel([row([row([openTimer(),text('ENDS NOVEMBER 30\n23:59 UTC',{'text-size':'12px'})],{gap:'27px'}),A],{align:'space-between',gap:'27px'})],{pad:'19px 28px'},{pad:'24px'})],'0');break;}
 case 46:{const field=all.find(n=>n.type==='field'),consent=all.find(n=>n.type==='consent');A.label='Request access';c=split(panel([strong('26','67px'),label('NOV / EARLY ACCESS')],{bg:'accent',fg:'accent-fg',pad:'40px 10px 22px',align:'center'}),panel([split(stack([E,H],'11px'),stack([row([field,A]),consent,F],'10px'),.4,'12rem','27px')],{pad:'40px 55px 25px 30px'}),.14,'0px');c.start[0]=stretch(c.start[0]);break;}
 case 47:{E.text='BLACK FRIDAY / DELIVERY';H.text='$0';H.tokens={'heading-size':'76px','heading-font':DM,'heading-weight':'900',fg:'accent'};c=panel([row([panel([E,barcode(),label('27—30 NOV / STANDARD')],{bg:'input-bg',fg:'border',pad:'18px',gap:'12px'}),row([H,text('DELIVERY\nON ORDERS $100+',{'text-size':'11px'})],{gap:'16px'}),A],{align:'space-between',gap:'20px'})],{pad:'30px 55px 24px 20px'},{pad:'45px 24px 24px'});break;}
 case 48:{H.role='offer_amount';A.label='Use my code';H.text='10%';H.tokens={fg:'accent','heading-size':'85px','heading-weight':'900',tracking:'-.05em'};c=stack([photo(0,'180px'),panel([E,row([label('AN EXTRA'),H,label('OFF')],{gap:'12px'})],{pad:'24px 26px',gap:'18px'}),panel([codes[0],A,F],{bg:'input-bg',pad:'23px 26px',gap:'18px'})],'0');c.children[2].notch=true;break;}
 case 49:{E.text='BLACK FRIDAY / HOME';c=split(photo(0,'365px'),split(panel([E,label('01 / THE WEEKEND EDIT'),heading('80px'),B],{pad:'42px 24px 30px',gap:'24px'}),panel([label('SELECTED HOMEWARE'),strong('30%','90px','accent'),label('OFF'),A,F],{bg:'input-bg',pad:'42px 24px 30px',gap:'24px'}),.5,'0px'),.36,'0px');c.end[0].end[0]=stretch(c.end[0].end[0]);break;}
 case 50:{A.label='Enter the Friday sale';H.text='BLACK FRIDAY. ALL IN.';c=panel([E,H,grid(pics.map((p,i)=>stack([Object.assign(img(i,'210px'),{narrow:{'image-height':'150px'}}),label(['01 / WEAR IT','02 / UPGRADE IT','03 / RESTOCK IT'][i])],'12px')),'12rem','12px'),split(row([label('UP TO'),strong('50%','75px','accent'),label('OFF SELECTED\nCOLLECTIONS')]),A,.65,'18rem','24px'),F],{pad:'42px 38px 28px',gap:'26px'});break;}
 }

 // The approved colour emphasis is editable text, never baked into the artwork.
 const em=words.emphasis, emColour=ref.palette['--em'];
 if(em && emColour && emColour!==d.tokens.fg && H.text.includes(em)){
  let colour='accent';
  if(emColour!==d.tokens.accent){colour=id===6?'input-bg':'border';d.tokens[colour]=emColour;}
  const ending={...structuredClone(H),id:'n'+(++serial),text:em.trim(),tokens:{...H.tokens,fg:colour}};
  H.text=H.text.slice(0,H.text.indexOf(em)).trim();
  const replacement=id===50?row([H,ending],{gap:'15px'}):stack([H,ending],'0');
  const replace=n=>{for(const k of ['children','start','end'])if(n[k])n[k]=n[k].map(x=>x===H?replacement:(replace(x),x));};
  replace(c);
 }
 if(id===3)walk(c,n=>{if(n.emphasis==='40%')n.tokens.font=DISPLAY;});
 if(id===12)pics[0].tokens.radius='140px 140px 0 0';
 if(id===27){d.tokens['input-bg']='#deefca';d.tokens.border='#344435';c.start[0].tokens={...c.start[0].tokens,radius:'20px',fg:'border',muted:'border'};walk(c.start[0],n=>{if(n.emphasis)n.tokens.font=DISPLAY;});c.start[0]=panel([c.start[0]],{pad:'25px'});}
 // A responsive card keeps its own small labels and image strips at phone widths.
 if(id===42)walk(c,n=>{if(n.emphasis&&n.emphasis.includes('%'))n.narrow={'text-size':'43px'};});
 if(id===43)walk(c,n=>{if(n.type==='panel'&&n.children?.some(x=>x.text==='MONTH'))n.narrow={pad:'8px'};});

 if([7,12,13,15].includes(id)&&words.emphasis){
  const ending={...structuredClone(H),id:'n'+(++serial),text:words.emphasis,tokens:{...H.tokens,'heading-style':'italic'}};
  H.text=words.headline.replace(words.emphasis,'').trim();
  const replace=n=>{for(const k of ['children','start','end'])if(n[k])n[k]=n[k].map(x=>x===H?stack([H,ending],'0'):(replace(x),x));};replace(c);
  d.tree.fonts.find(f=>f.family==='Cormorant Garamond').faces.push({weight:400,italic:true});
 }
 if([31,39,40,41].includes(id))walk(c,n=>{if(n.type==='split')delete n.narrow_layout;});
 if(id===31)pics[0].narrow={'image-height':'240px','image-position':'center 12%'};
 if(id===32){delete c.children[2].narrow_layout;c.children[2].basis='16rem';}
 if(id===35){const values=c.start[0].children[0].children;values.pop();c.start[0].children=[Object.assign(grid(values,'10rem','12px'),{narrow_basis:'3.5rem'})];c.start[0].narrow={pad:'56px 22px 20px'};values[1].narrow={'text-size':'40px'};}
 if(id===37){A.tokens={...A.tokens,accent:'border','accent-fg':'input-bg'};}
 if(id===38)c.end[0].narrow.pad='24px 15px';
 if(id===40){F.text='Selected layers. November 27–30.';old('body',0).tokens.fg='accent';}
 if(id===44){c.children[1]=row([c.children[1],label('UP TO / OFF')],{gap:'12px'});c.children.splice(2,1);}
 if(id===45){c.children[1].children=[split(split(timer,text('ENDS NOVEMBER 30\n23:59 UTC',{'text-size':'14px'}),.5,'0px','27px'),A,.7,'0px','30px')];c.children[0].narrow.pad='30px 50px 24px';c.children[0].children[0].narrow={gap:'16px'};c.children[1].children[0].narrow={gap:'22px'};A.narrow={width:'100%'};}
 if(id===46){E.text='BLACK FRIDAY / FIRST DIBS';c.start[0].children=[row(c.start[0].children[0].children,{gap:'10px',align:'center'})];c.start[0].narrow.pad='56px 22px 22px';c.start[0].tokens.pad='56px 10px 22px';c.start[0].children[0].children[0].narrow={'text-size':'50px'};walk(c.end[0],n=>{if(n.type==='row'&&n.children.some(x=>x.type==='field'))n.type='stack';});}
 if(id===48){E.text='BLACK FRIDAY / ONE MORE REASON';c.children[1].children.shift();c.children.splice(1,0,panel([E],{bg:'accent',fg:'accent-fg',pad:'12px 24px'},{pad:'12px 24px'}));}
 if(id===47)c.children=[split(c.children[0].children[0],split(c.children[0].children[1],A,.48,'0px','20px'),.25,'0px','28px')];
 if(id===49){A.label='Shop home';B.text='A favourite corner.\nA better everyday.\nA Black Friday price.';pics[0].narrow={'image-height':'200px'};}
 if(id===50){pics[0].tokens['image-position']='center 10%';pics[0].narrow['image-position']='center 20%';}
 // Split large percentage figures into editable number and small percent mark.
 if(id>=31){const replace=n=>{for(const k of ['children','start','end'])if(n[k])n[k]=n[k].map(x=>{
  if(x.type==='text'&&/^\d+%$/.test(x.emphasis||'')&&parseFloat(x.tokens?.['text-size'])>=75){const size=parseFloat(x.tokens['text-size']);x.emphasis=x.emphasis.slice(0,-1);const mark=strong('%',Math.round(size*.38)+'px',x.tokens.fg||'fg');return row([x,mark],{gap:'2px'});}
  replace(x);return x;
 });};replace(c);}

 if(id===19){H.tokens.fg='border';const ending={...structuredClone(H),id:'n'+(++serial),text:'30% LESS.',tokens:{...H.tokens,fg:'accent'}};H.text='MORE PLAY.';const parent=c.children[1];parent.children.splice(parent.children.indexOf(H),1,stack([H,ending],'0'));}
 if(id===6){const price=c.start[0].children[0];price.tokens={...price.tokens,fg:'border',muted:'border'};}
 if(id===10){c.end[0].tokens.muted='fg';}
 if(id!==45&&id!==40&&id!==47){
  // Reserve close clearance within the first painted surface, including RTL.
  const protect=n=>{if(['panel','media'].includes(n.type)&&n.children?.some(x=>x===E||x.type==='row'&&x.children?.includes(E))){
   const reserve=value=>{const [t,r=t,b=t,l=r]=value.split(' ');return [Math.max(56,parseFloat(t))+'px',r,b,l].join(' ');};
   n.tokens.pad=reserve(n.tokens.pad||'24px');n.narrow={...n.narrow,pad:reserve(n.narrow?.pad||n.tokens.pad)};
  }};walk(c,protect);
 }
 if(id===40){c.children[0].end[0].tokens.pad='60px 22px 22px';c.children[0].end[0].narrow={pad:'60px 16px 20px'};old('body',0).tokens['text-size']='14px';}
 walk(c,n=>{if(n.type==='text'&&n.text!=='%b'&&parseFloat(n.tokens?.['text-size'])<14)n.tokens['text-size']='14px';});
 if([17,35].includes(id))walk(c,n=>{for(const deco of n.decorations?.items||[])if(deco.kind==='barcode')deco.size=100;});
 for(const screen of d.tree.steps.slice(1))if(screen.content.tokens){screen.content.tokens.pad='60px 30px 30px';screen.content.narrow={...screen.content.narrow,pad:'60px 24px 24px'};}

 if([21,22,23,24].includes(id)){const pad=c.tokens.pad.split(' ');c.tokens.pad=pad[0]+' 60px '+(pad[2]||pad[0]);c.narrow={...c.narrow,pad:'56px 24px 25px'};}
 if(id===5){c.tokens.pad='56px 20px 20px';c.narrow={pad:'56px 20px 20px'};}
 if(id===17){c.children[0].tokens.pad='16px 60px';c.children[0].narrow={pad:'16px 60px'};}
 if(id===38)c.end[0].tokens.pad='60px 15px 26px';
 if(id===47)walk(c,n=>{for(const deco of n.decorations?.items||[])if(deco.kind==='barcode')deco.size=120;});
 walk(d.tree,n=>{if(n.type==='field')n.tokens={...n.tokens,'text-size':'16px'};});

 if(id===17){const offer=all.find(n=>n.emphasis?.includes('60%'));offer.emphasis='60%';offer.tokens['text-size']='78px';offer.narrow={'text-size':'64px'};}
 if(id===21){d.tokens['input-bg']='#edb5cb';const circle=c.children[0].start[0].children[0];circle.tokens={...circle.tokens,bg:'input-bg',fg:'accent',muted:'accent',radius:'50%',pad:'24px 18px'};circle.children[0].tokens.font=DISPLAY;}
 if(id===22)timer.tokens.fg='fg';
 if(id===25){c.children[0].tokens.pad='8px';c.children[0].narrow.pad='8px';pics[0].tokens.radius='100px 100px 12px 12px';}
 if(id===13){c.children[0].tokens.pad='56px 24px 16px';c.children[0].narrow={pad:'56px 24px 16px'};}
 if(id===24)walk(c,n=>{if(n.type==='row'&&n.children.some(x=>x.type==='field')){const [field,button]=n.children;button.tokens={...button.tokens,'text-size':'16px'};Object.assign(n,split(field,button,.52,'0px','14px'));delete n.children;}});
 if(id===35){c.start[0].tokens.pad='56px 19px 25px';c.start[0].narrow.pad='56px 22px 20px';}
 if(id===35){const month=c.start[0].children[0].children[2];month.type='eyebrow';month.role='eyebrow';month.text='NOV';delete month.emphasis;}
 if(id===19){delete c.tokens.border;delete c.edges;delete c.children[1].tokens.border;c.children[1].children[0].decorations.items[0].color='fg';}
 if([13,30,35].includes(id))A.label=({13:'Request preview',30:'Shop birthday offer',35:'Get early access'})[id];
 // A self-reference is inheritance, not the literal CSS colour named “fg”.
 walk(d.tree,n=>{for(const bag of [n.tokens,n.narrow])if(bag)for(const key of Object.keys(bag))if(bag[key]===key)delete bag[key];});
 walk(c,n=>{for(const bag of [n.tokens,n.narrow])if(bag)for(const key of Object.keys(bag))if(bag[key]===key)delete bag[key];});
 d.tree.steps[0].content=c;
 if(id===9)refineReceipt(d);
 refineFirstBatch(d,id);
 if(id>=31)refineRetail(d,id);
 if(id>=16&&id<=30)refineCore(d,id);
 // These layouts arrange without painting; explicit zero avoids an inherited gutter at panel seams.
 const seen=new Set();walk(d.tree,n=>{if(n.tokens&&!Object.keys(n.tokens).length)delete n.tokens;if(n.type&&!['stack','row','grid','split','panel','media'].includes(n.type)&&!n.id)n.id='n'+(++serial);if(n.id&&n.type){if(seen.has(n.id))throw Error(item.native_id+': duplicate '+n.id);seen.add(n.id);}});
 fs.writeFileSync(path.join(root,file),JSON.stringify(d,null,2)+'\n');
}
console.log('Refined selected native compositions.');

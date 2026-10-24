/** Corrections found by comparing the actual WordPress output with the approved retail set. */
export function refineRetail(design, id) {
 const c=design.tree.steps[0].content, all=[];
 const walk=n=>{all.push(n);for(const k of ['children','start','end'])for(const child of n[k]||[])walk(child);};walk(c);
 const by=id=>all.find(n=>n.id===id), panel=(children,tokens={})=>({type:'panel',children,tokens:{pad:'0',gap:'0',radius:'0',...tokens}});
 const setPad=(node,wide,narrow=wide)=>{node.tokens={...node.tokens,pad:wide};node.narrow={...node.narrow,pad:narrow};};
 const intro=(node,wide='28px 28px 26px',narrow='28px 24px 24px')=>{
  setPad(node,wide,narrow);
  const first=node.children?.[0];
  if(first?.type==='eyebrow')node.children[0]=panel([first],{pad:'0 32px 0 0'});
 };
 // Compact ribbons keep their authored padding on a narrow container. The
 // previous generic 24px override inflated every 9–12px label into a large box.
 for(const n of all)if(n.type==='panel'&&n.narrow?.pad==='24px'&&parseFloat(n.tokens?.pad||'99')<=16)n.narrow.pad=n.tokens.pad;
 const fillPhoto=node=>{node.type='media';node.children[0].tokens['image-height']='100%';};
 const stretchPanel=node=>{if(node.type==='media')return;node.type='media';node.children=[{type:'stack',children:node.children,tokens:{gap:node.tokens.gap||'18px'}}];};
 const barcode=node=>{delete node.decorations;node.min='23px';node.tokens={...node.tokens,pad:'0','bg-image':'repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 5px,currentColor 5px 6px,transparent 6px 9px,currentColor 9px 13px,transparent 13px 15px)'};node.narrow={pad:'0'};};
 if([33,34,36,39,41,42,43,44,50].includes(id))intro(c);
 if([31,32].includes(id))intro(c.children[0],'23px 28px 19px','24px 22px 20px');
 if(id===31){c.children[1].end[0].tokens.pad='22px 25px';c.children[1].end[0].narrow={pad:'18px 12px'};}
 if(id===32){const discount=c.children[2].end[0];discount.children[0].type='row';discount.children[0].tokens={gap:'10px',align:'space-between'};discount.narrow={pad:'12px 24px'};by('n10').narrow={'text-size':'32px'};c.children[2].start[0].narrow={pad:'18px 24px'};}
 if(id===33){by('n9').tokens['text-size']='245px';by('n9').tokens.leading='.78';by('n9').narrow={'text-size':'150px'};const bottom=c.children[4];delete bottom.narrow_layout;bottom.basis='14rem';c.children[2].tokens.align='center';by('n13').tokens.fg='fg';by('n13').narrow={'text-size':'64px'};if(c.children[2].children[1].type!=='stack'){const next=Math.max(...all.map(n=>Number(n.id?.slice(1))||0))+1;c.children[2].children[1]={type:'stack',children:[by('n13'),{type:'eyebrow',id:'n'+next,role:'eyebrow',text:'OFF',tokens:{'text-size':'14px'}}],tokens:{gap:'0'}};}}
 if(id===34){if(by('n6')?.tokens)by('n6').tokens.align='start';for(const n of all)if(n.type==='text'&&n.text?.includes('daily ritual'))n.tokens={...n.tokens,align:'start'};}
 if(id===35){setPad(c.start[0],'70px 19px 35px','22px 48px 22px 20px');setPad(c.end[0],'35px 28px 28px','24px');const date=c.start[0];date.decorations={label:'Pass barcode',hidden:false,items:[{kind:'barcode',x:50,y:80,size:110,color:'fg',motion:'none',narrow:{x:50,y:98,size:12}}]};date.children[0].narrow_basis='3.5rem';}
 if(id===36){const offer=c.children[2].end[0];offer.type='row';offer.tokens={gap:'10px',align:'flex-end'};}
 if(id===37){intro(c.start[0],'36px 32px 28px','32px 24px');stretchPanel(c.end[0]);const ticket=c.end[0];setPad(ticket,'50px 26px 30px','28px 24px');delete ticket.notch;delete ticket.notch_position;for(const n of all)if(n.decorations?.items?.some(i=>i.kind==='barcode'))barcode(n);for(const n of all)if(n.emphasis==='35')n.narrow={'text-size':'88px'};}
 if(id===38){intro(c.start[0],'35px 25px 25px','28px 24px');setPad(c.end[0],'60px 15px 26px','20px 15px');c.end[0].children[0].narrow={gap:'12px'};}
 if(id===39){const hero=c.children[1];if(hero.start[0].type!=='split'){const heading=hero.start[0],picture=hero.end[0];hero.start=[{type:'split',start:[heading],end:picture.start,ratio:.15,basis:'5rem',tokens:{gap:'18px'}}];hero.end=picture.end;}hero.ratio=.98;hero.basis='11rem';hero.start[0].ratio=.30;hero.end[0].type='row';hero.end[0].tokens={gap:'10px'};}
 if(id===40){fillPhoto(c.children[0].start[0]);intro(c.children[0].end[0],'38px 22px 24px','32px 16px 20px');for(const n of all)if(n.type==='heading')n.tokens['heading-size']='28px';}
 if(id===41){for(const n of all)if(n.emphasis==='+')n.narrow={'text-size':'100px'};}
 if(id===43){const months=c.children.find(n=>n.type==='grid');months.basis='7em';months.tokens['text-size']='clamp(10px, 1.8cqw, 14px)';for(const n of all)if(n.type==='heading')n.tokens['heading-size']='clamp(34px, 6.3cqw, 49px)';for(const n of all)if(n.type==='panel'&&n.children?.some(x=>x.text==='MONTH')){n.tokens.bg='input-bg';delete n.tokens.fg;delete n.tokens.muted;n.edges='all';n.tokens.border='accent';}}
 if(id===44){for(const n of all)if(n.emphasis==='40')n.narrow={'text-size':'103px'};}
 if(id===46){setPad(c.start[0],'22px 10px','22px 48px 22px 24px');setPad(c.end[0],'24px 55px 24px 30px','24px');const fields=c.end[0].children[0].end[0].children[0];fields.tokens.gap='10px';}
 if(id===47){c.children[0].start[0].tokens.bg='input-bg';c.children[0].end[0].tokens={...c.children[0].end[0].tokens,'input-bg':'bg'};for(const n of all)if(n.decorations?.items?.some(i=>i.kind==='barcode'))barcode(n);}
 if(id===48){by('n6').text='Extra 10% off selected sale styles. Enter your code at checkout. Nov 27–30.';setPad(c.children[1],'12px 24px');setPad(c.children[2],'24px 26px');setPad(c.children.at(-1),'23px 26px');const pic=c.children[0].children[0];pic.tokens['image-position']='center 70%';pic.narrow['image-position']='center 70%';by('n7').text='AN\nEXTRA';by('n3').tokens['heading-size']='90px';by('n3').narrow={'heading-size':'85px'};const coupon=c.children.at(-1);delete coupon.notch;const existing=coupon.children.find(n=>n.type==='divider');if(existing){coupon.children=coupon.children.filter(n=>n!==existing);c.children.splice(c.children.length-1,0,existing);}else if(!c.children.some(n=>n.type==='divider')){const next=Math.max(...all.map(n=>Number(n.id?.slice(1))||0))+1;c.children.splice(c.children.length-1,0,{type:'divider',id:'n'+next,pattern:'dashed',tokens:{border:'accent'}});}setPad(coupon,'23px 26px');}
 if(id===49){fillPhoto(c.start[0]);c.start[0].children[0].tokens['image-height']='clamp(200px, 48cqw, 376px)';setPad(c.end[0].start[0],'32px 24px','25px 22px');setPad(c.end[0].end[0],'32px 24px','23px 22px');c.end[0].start[0].narrow.gap='18px';c.end[0].end[0].children[0].narrow={gap:'18px'};for(const n of all)if(n.type==='heading'){n.tokens['heading-size']='clamp(52px, 9.5cqw, 76px)';n.narrow={'heading-size':'52px'};}}
 if(id===50){design.display_type='popup';c.children[1].narrow={gap:'0'};for(const n of all)if(n.type==='heading')n.tokens['heading-size']='85px';}
 for(const n of all){if(n.type==='text'&&n.emphasis&&n.tokens?.font?.includes('DM Sans'))n.tokens['text-weight']='950';if([37,48].includes(id)&&n.type==='code'){n.appearance='plain';n.tokens={...n.tokens,align:'start'};}}
 return design;
}

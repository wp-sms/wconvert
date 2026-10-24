import fs from 'node:fs';
/** Correct the reviewed 16–30 compositions using native editable layouts. */
export function refineCore(d,id){
 let c=d.tree.steps[0].content;
 const nodes=[];const walk=n=>{nodes.push(n);for(const k of ['children','start','end'])for(const x of n[k]||[])walk(x);};walk(c);
 let serial=Math.max(...nodes.map(n=>Number(n.id?.slice(1))||0));
 const text=(s,tokens={})=>({type:'text',id:'n'+(++serial),role:'body',text:s,tokens});
 const panel=(children,tokens={},narrow={})=>({type:'panel',children,tokens:{pad:'0',gap:'0',radius:'0',...tokens},...(Object.keys(narrow).length?{narrow}:{})});
 const row=children=>({type:'row',children,tokens:{gap:'12px'}});
 const split=(a,b,ratio=.5)=>({type:'split',start:[a],end:[b],ratio,basis:'0px',narrow_layout:'stack',tokens:{gap:'0'}});
 const button=nodes.find(n=>n.type==='button');
 const wrapButton=parent=>{if(parent.children)parent.children=parent.children.map(n=>n===button?row([n]):n);};
 const barcode=p=>{delete p.decorations;p.min='30px';p.tokens={pad:'0',radius:'0','bg-image':'repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 5px,currentColor 5px 6px,transparent 6px 9px,currentColor 9px 13px,transparent 13px 15px)'};p.narrow={pad:'0'};};
 // Compact panels keep compact spacing; the earlier helper gave every phone panel 24px padding.
 for(const n of nodes)if(['panel','media'].includes(n.type)&&n.narrow?.pad==='24px'&&parseFloat(n.tokens?.pad)<24)n.narrow.pad=n.tokens.pad;
 if(id===16){
  // Narrow nodes replay inherited expressions: keep the gradient pigment in
  // the root palette, and scope readable muted text only inside the copy.
  d.tokens.muted=d.tokens.bg;
  const image=nodes.find(n=>n.type==='image');const copy=c.start[0];copy.tokens.pad='48px 32px 38px';copy.tokens.bg='transparent';copy.tokens.muted='fg';copy.narrow.pad='36px 24px 30px';
  const blank=panel([],{bg:'transparent'});copy.min='0px';blank.min='0px';
  // A picture occupies one bindable slot. Keep the gradient on a nested native
  // surface so catalogue transfer materializes the image instead of embedding data.
  const overlay=panel([split(copy,blank,.56)],{bg:'transparent','bg-image':'linear-gradient(90deg,var(--wc-muted) 50%,transparent 80%)','bg-size':'100% 100%'},{'bg-image':'linear-gradient(180deg,transparent 65%,var(--wc-muted))','bg-size':'100% 300px','image-position':'center top',pad:'240px 0 0'});
  overlay.min='470px';
  c=panel([overlay],{'bg-image':`url("${image.src}")`,'bg-size':'61% 100%','image-position':'right center'},{'bg-size':'100% 300px','image-position':'center top'});
  c.min='470px';
  c.decorations={label:'Delivery star',hidden:false,items:[{kind:'sparkle',x:58,y:14,size:35,color:'accent',motion:'pulse'}]};
 }
 if(id===17){
  d.tokens.border='#c99e68';c.children[0].children[0].text='BLACK FRIDAY / THE ARCHIVE EVENT';
  const body=c.children[1],copy=body.start[0],ticket=body.end[0].children[0];
  body.ratio=.65;body.basis='0px';copy.tokens.pad='32px';copy.narrow.pad='28px 24px';wrapButton(copy);
  ticket.tokens={...ticket.tokens,fg:'fg',muted:'fg',pad:'20px 14px',gap:'18px',border:'fg',radius:'0'};
  ticket.edges='all';ticket.narrow={pad:'20px 14px'};
  ticket.children.splice(2,0,text('UP TO / OFF',{'text-size':'10px',align:'center'}));
  ticket.children.forEach(n=>{if(n.decorations)barcode(n);if(n.text==='NOVEMBER 27–30')n.tokens={font:'monospace','text-size':'9px',align:'center'};});
  const frame=panel([ticket],{pad:'4px',bg:'input-bg',border:'input-bg'});frame.edges='all';body.end[0]=panel([frame],{pad:'24px 20px 24px 0'},{pad:'0 24px 28px'});
  c=panel(c.children,{'bg-image':'repeating-linear-gradient(90deg,transparent 0 2px,var(--wc-border) 2px 3px)',gap:'0'});
 }
 if(id===18){
  c.ratio=.42;c.basis='0px';const left=c.start[0],image=nodes.find(n=>n.type==='image');
  left.children[0]=image;image.tokens['image-height']='350px';image.narrow={'image-height':'240px'};
  c.end[0].tokens.pad='48px 30px 28px';c.end[0].narrow.pad='30px 24px';
  // Native media stretches the painted image side to the copy pane, with no exterior bands.
  left.type='media';left.tokens={pad:'0',gap:'0',bg:'input-bg'};
  left.children[1].tokens.pad='16px 12px';left.children[1].narrow={pad:'16px 12px'};
 }
 if(id===19){
  const screenGround=d.tokens['input-bg'];
  d.tokens.muted=screenGround;d.tokens['input-bg']='#fff6d7';d.tokens.placeholder='fg';
  c.tokens={...c.tokens,pad:'25px 21px 21px',radius:'15px',gap:'18px'};c.narrow={pad:'45px 21px 21px'};delete c.tokens.border;delete c.edges;
  const header=c.children[0];header.type='text';header.role='body';header.text='BLACK FRIDAY';header.tokens={font:'"Bebas Neue", Impact, sans-serif','text-size':'20px'};
  const screen=c.children[1];screen.tokens={...screen.tokens,pad:'28px 20px',radius:'14px',fg:'border'};screen.edges='all';delete screen.tokens.bg;delete screen.tokens.border;delete screen.tokens.muted;
  // Keep muted as the screen pigment through narrow descendants, which replay
  // inherited aliases. Text uses foreground; the form scopes its own muted ink.
  c.children[1]=panel([screen],{bg:'muted',radius:'14px'});
  c.children=c.children.map(node=>node.type==='button'?{type:'stack',children:[node],tokens:{muted:'fg',placeholder:'fg',gap:'18px'}}:node);
  screen.children[0].decorations.items[0].color='fg';
  const offerCopy=nodes.find(n=>n.role==='body'&&n.text?.includes('code'));if(offerCopy)offerCopy.text='Black Friday savings on selected gaming accessories.';
  d.tokens.radius='20px';d.tokens.shadow='inset 0 0 0 5px var(--wc-fg)';
  delete nodes.find(n=>n.role==='fine_print').tokens.fg;nodes.find(n=>n.role==='fine_print').tokens.muted='fg';

 }
 if(id===20){
  const strip=c.start[0];strip.tokens.pad='8px';strip.tokens.gap='8px';strip.narrow={pad:'8px'};
  for(const n of nodes)if(n.tokens?.['bg-image']){n.tokens.pad='53px 0';n.narrow={pad:'65px 0','bg-size':'auto 300px'};}
  c.start[0]=panel([strip],{pad:'24px 10px 24px 24px'},{pad:'24px 24px 0'});c.ratio=.38;c.basis='0px';c.end[0].tokens.pad='44px 30px 28px';c.end[0].narrow.pad='28px 24px';
 }
 if(id===21){
  const layout=c.children[0];layout.basis='0px';layout.ratio=.64;layout.start[0].tokens.align='space-between';layout.start[0].tokens.gap='30px';
  const circle=layout.start[0].children[0];circle.tokens.pad='18px 12px';circle.narrow={pad:'18px 12px'};
  const badgeRow=layout.start[0];layout.start[0]={type:'split',start:[circle],end:badgeRow.children.slice(1),ratio:.3,basis:'0px',tokens:{gap:'20px'}};
  circle.children[0].tokens['text-size']='clamp(32px, 4.8cqw, 45px)';c.tokens.pad='20px 60px 20px 40px';
 }
 if(id===22){
  const layout=c.children[0];layout.basis='0px';layout.ratio=.4;
  c.tokens.pad='22px 60px 22px 30px';
  // The reference's original decorative checker artwork remains replaceable in the editor.
  const art='data:image/png;base64,'+fs.readFileSync(new URL('../pilot/assets/black-friday/fidelity-checker.png',import.meta.url)).toString('base64');
  c.tokens['bg-image']=`url("${art}")`;c.tokens['bg-size']='24px 100%';c.tokens['image-position']='left center';c.tokens.pad='22px 60px 22px 40px';

 }
 if(id===23){
  c.children[0].basis='0px';c.children[0].ratio=.65;c.children[0].start[0].ratio=.36;
  const artwork=nodes.find(n=>n.type==='image');artwork.tokens['image-height']='85px';artwork.narrow={'image-height':'65px'};
  c.tokens.pad='20px 60px 20px 30px';
 }
 if(id===24){c.children[0].basis='0px';c.children[0].ratio=.35;c.children[0].narrow_layout='stack';c.tokens.pad='32px 60px 28px 30px';}
 if(id===25){d.tokens.radius='12px';c.children[0].tokens.radius='130px 130px 12px 12px';c.children[1].tokens.pad='25px 24px 28px';c.children[1].narrow={pad:'25px 24px 28px'};}
 if(id===26){c.children[1].tokens.pad='25px';c.children[1].narrow={pad:'25px'};}
 if(id===27){nodes.find(n=>n.type==='code').appearance='plain';nodes.find(n=>n.role==='body'&&n.text?.includes('checkout')).text='Save 10% on your first order of selected items.';c.ratio=.4;c.basis='0px';c.start[0].tokens.pad='24px';c.start[0].narrow={pad:'24px 24px 0'};c.end[0].tokens.pad='40px 28px 28px 0';c.end[0].narrow={pad:'28px 24px'};}
 if(id===28){c.tokens.pad='26px 28px 20px';c.tokens.radius='5px';c.tokens.gap='18px';c.narrow={pad:'44px 24px 24px'};c.children[0].basis='0px';c.children[0].ratio=.5;}
 if(id===29||id===30){d.display_type='popup';}
 if(id===29){d.tokens['input-bg']='#fff4de';d.tokens.border='#263d36';c.tokens.pad='30px 32px 28px';c.narrow={pad:'44px 24px 24px'};}
 if(id===30){c.children=c.children.map(n=>n===button?{type:'row',children:[n],tokens:{align:'center',gap:'0'}}:n);c.tokens.pad='48px 60px 40px';c.narrow={pad:'115px 24px 30px','bg-size':'auto 135px','image-position':'center 12px'};}
 // Keep a later email conversion together within the action column of a mixed row.
 if(id===22||id===28){
  const groupAction=n=>{if(n.type==='row'&&n.children?.includes(button))n.children=n.children.map(x=>x===button?{type:'stack',children:[x],tokens:{gap:'12px'}}:x);for(const key of ['children','start','end'])for(const x of n[key]||[])groupAction(x);};
  groupAction(c);
 }
 d.tree.steps[0].content=c;
}

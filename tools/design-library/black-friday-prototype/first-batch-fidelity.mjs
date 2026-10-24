import fs from 'node:fs';
/** Follow-up from actual WordPress/prototype comparisons, not inferred from overflow tests. */
export function refineFirstBatch(design, id) {
  if(id>15||id===9)return;
  const root=design.tree.steps[0].content, leaves=[];
  const walk=(node,fn)=>{fn(node);for(const key of ['children','start','end'])for(const child of node[key]||[])walk(child,fn);};
  walk(root,node=>{if(node.id)leaves.push(node);});
  let serial=0;for(const screen of design.tree.steps)walk(screen.content,n=>{serial=Math.max(serial,Number(n.id?.slice(1))||0);});
  const leaf=(type,text,tokens={})=>({type,id:'n'+(++serial),role:type==='eyebrow'?'eyebrow':'body',text,tokens});
  const text=(value,tokens={})=>leaf('text',value,tokens);
  const label=(value,tokens={})=>leaf('eyebrow',value,{'text-size':'9px',tracking:'.08em',...tokens});
  const stack=(children,gap='16px')=>({type:'stack',children,tokens:{gap}});
  const row=(children,align='start',gap='16px')=>({type:'row',children,tokens:{align,gap}});
  const panel=(children,tokens={},narrow={})=>({type:'panel',min:'0px',children,tokens:{pad:'16px',gap:'16px',radius:'0',...tokens},narrow});
  const display='"Bebas Neue", Impact, sans-serif', serif='"Times New Roman", Times, serif';
  const headings=leaves.filter(n=>n.type==='heading'),images=leaves.filter(n=>n.type==='image');
  // The prototype's unquoted `Serif` @font-face was invalid CSS: the approved
  // browser output was Times, not the Cormorant file that happened to sit beside it.
  if([7,12,13,15].includes(id)){
    design.tokens['heading-font']=serif;design.tokens['heading-weight']='400';
    design.tree.fonts=design.tree.fonts.filter(font=>font.family!=='Cormorant Garamond');
    for(const heading of headings){delete heading.tokens?.['heading-font'];delete heading.tokens?.['heading-weight'];}
  }
  if([2,3,10].includes(id)){
    const body=leaves.find(n=>n.role==='body'&&n.text&&n.text!=='%b'&&n.text.length>45);
    if(body)body.text=({2:'Enjoy 10% off selected items on your first order.',3:'Save 40% on selected favorites during the Black Friday event.',10:'Enjoy 15% off selected everyday favorites on your first order.'})[id];
  }
  if(id===4){root.end[0].narrow={pad:'120px 0','bg-size':'cover','image-position':'center'};root.start[0].narrow={pad:'24px 23px 25px'};}
  if(id===5){
    const comic=root.children[1],left=comic.start[0],right=comic.end[0];
    left.tokens={...left.tokens,pad:'20px',gap:'20px',align:'center'};left.narrow={pad:'10px 6px',gap:'12px'};delete left.edges;
    const yes=left.children.find(n=>n.text==='YES.');yes.tokens={font:display,'text-size':'36px',leading:'1'};yes.narrow={'text-size':'24px'};
    images[0].tokens['image-height']='165px';images[0].narrow={'image-height':'110px'};
    const badge=right.children.find(n=>n.type==='badge');badge.type='text';badge.role='body';badge.text='SELECTED FAVORITES.\nONE HAPPY ENDING.';badge.tokens={font:display,'text-size':'23px',leading:'1',align:'center'};
    right.tokens={...right.tokens,pad:'18px',gap:'24px'};right.narrow={pad:'12px',gap:'12px'};for(const heading of headings)heading.narrow={'heading-size':'34px'};badge.narrow={'text-size':'16px'};
    right.children=[...right.children.filter(n=>n!==badge),row([panel([panel([badge],{bg:'accent-fg',pad:'13px 20px',radius:'50%'})],{bg:'fg',pad:'1px',radius:'50%'})],'end')];
    const frame=content=>panel([content],{bg:'fg',pad:'2px',gap:'0'});
    comic.start=[frame(left)];comic.end=[frame(right)];comic.ratio=.33;comic.basis='0px';comic.tokens.gap='14px';delete comic.narrow_layout;
    // Media supplies equal pane heights; words remain ordinary editable leaves.
    for(const content of [left,right]){content.type='media';content.min='300px';}
    root.children[0]=row([text('THE FRIDAY EDIT',{font:display,'text-size':'20px'}),label('BLACK FRIDAY / NOV 27–30')],'space-between');
    root.tokens={...root.tokens,pad:'24px',gap:'18px'};root.narrow={pad:'48px 18px 20px'};delete root.edges;delete root.tokens.border;root.children[0]=panel([root.children[0]],{pad:'0 40px 0 0',gap:'0'});
  }
  if(id===6){
    const price=root.start[0].children[0];
    price.tokens={...price.tokens,pad:'26px 18px 38px',gap:'17px',radius:'12px'};price.narrow={pad:'20px 18px',gap:'6px'};delete price.min;price.edges='all';
    price.children[1].tokens={...price.children[1].tokens,font:display,'text-size':'40px'};
    price.children[1].narrow={'text-size':'28px'};price.children.find(n=>n.emphasis).narrow={'text-size':'52px'};root.end[0].narrow={pad:'24px',gap:'12px'};for(const heading of headings)heading.narrow={'heading-size':'44px'};price.children.push(label('● ● ●',{'text-size':'14px',tracking:'.12em'}));
    root.start[0].children=[panel([price],{bg:'input-bg',pad:'7px',radius:'18px',gap:'0'})];root.start[0].tokens.pad='25px';
  }
  if(id===7){
    const image=images[0];root.ratio=.35;root.basis='0px';
    // A native media panel uses the same replaceable door picture behind live VIP copy.
    const door={type:'media',children:[row([panel([text('V\nI\nP',{font:serif,'text-size':'24px',leading:'1.5',align:'center',tracking:'.1em'})],{bg:'accent-fg',fg:'accent',pad:'0 7px',gap:'0',radius:'20px'})],'center','0')],tokens:{pad:'120px 32px 130px',gap:'0','bg-image':`url("${image.src}")`,'bg-size':'contain','image-position':'center',fg:'accent'},narrow:{pad:'30px 32px 50px','bg-size':'contain'}};
    root.start[0]=panel([door,label('EARLY ACCESS\nNOVEMBER 26',{align:'center','text-size':'8px'})],{pad:'28px 15px',gap:'10px'},{pad:'24px 40px',gap:'10px'});
    root.end[0].tokens.pad='48px 30px 28px';root.end[0].narrow.pad='24px';
  }
  if(id===8){images[0].fit='cover';root.end[0].narrow={pad:'24px',gap:'16px'};
    root.start[0].children.push(row([panel([text('MORE\nOUTSIDE.',{font:display,'text-size':'20px',leading:'1'})],{bg:'accent',fg:'accent-fg',pad:'10px 18px',radius:'24px 24px 0 0'})]));
    root.start[0].tokens.gap='0';images[0].tokens['image-height']='330px';
  }
  if(id===11){design.tokens['input-bg']=design.tokens.bg;root.end[0].narrow={pad:'24px',gap:'16px'};images[0].narrow={'image-height':'210px'};
    root.start[0].children.push(panel([label('BLACK FRIDAY / SELECTED SNEAKERS',{font:'monospace','text-size':'8px'})],{bg:'accent',fg:'input-bg',muted:'input-bg',pad:'10px 16px',gap:'0'}));
    images[0].tokens['image-height']='380px';root.start[0].tokens.gap='0';
  }
  if(id===12){design.tokens.border='#835a54';
    const photo=root.children[0].end[0],image=images[0];
    photo.tokens={...photo.tokens,pad:'26px 26px 0',radius:'0'};
    photo.children=[panel([image],{bg:'border',pad:'5px',radius:'150px 150px 0 0',gap:'0'})];image.tokens['image-height']='300px';image.narrow={'image-height':'190px'};photo.narrow={pad:'0 24px'};photo.children[0].narrow={pad:'4px'};
    root.children[1].children.unshift({type:'divider'});root.children[1].tokens.gap='18px';
  }
  if(id===13){
    const header=root.children[0],bubbles=root.children[1],content=root.children[2];design.tokens.border='#cfb0e7';for(const field of leaves.filter(n=>n.type==='field'))field.tokens={...field.tokens,border:'accent'};
    header.children=[row([panel([],{pad:'0',bg:'bg'},{}) ,stack(header.children,'4px')])];
    header.children[0].children[0]={type:'image',id:'n'+(++serial),src:'data:image/png;base64,'+fs.readFileSync(new URL('../pilot/assets/black-friday/fidelity-face.png',import.meta.url)).toString('base64'),alt:'',fit:'contain',shape:'rect',tokens:{'image-height':'28px'},narrow:{'image-height':'28px'}};
    // A sized decoration panel gets a native small column, avoiding fixed positioning.
    header.children[0]={type:'split',start:[header.children[0].children[0]],end:[header.children[0].children[1]],ratio:.08,basis:'0px',tokens:{gap:'12px'}};
    header.tokens={...header.tokens,pad:'24px 55px 18px 24px'};header.narrow={pad:'48px 24px 18px'};
    delete bubbles.decorations;bubbles.tokens={pad:'18px 24px',gap:'12px'};bubbles.narrow={pad:'16px 20px',gap:'12px'};
    bubbles.children=bubbles.children.map((bubble,index)=>{bubble.tokens={...bubble.tokens,pad:'10px 14px',gap:'0',...(index===1?{bg:'border',muted:'fg'}:{})};if(index===1)delete bubble.tokens.fg;bubble.narrow={pad:'10px 12px'};bubble.children[0].tokens={'text-size':'12px'};return row([bubble],index===1?'end':'start','0');});
    content.tokens={...content.tokens,pad:'15px 24px 24px',gap:'12px'};content.narrow={pad:'15px 20px 22px',gap:'12px'};
    root.children.splice(1,0,{type:'divider'});design.tokens.radius='16px';
  }
  if(id===14){
    images[0].tokens['image-height']='300px';root.ratio=.39;root.basis='0px';root.end[0].tokens.pad='42px 28px 28px 0';root.end[0].narrow.pad='40px 24px 24px';
  }
  if(id===15){
    const passport=root.start[0].children[0];root.basis='0px';
    passport.tokens={...passport.tokens,pad:'26px 16px 16px',gap:'22px',align:'center'};passport.narrow={pad:'16px',gap:'12px'};passport.children.find(n=>n.type==='image').narrow={'image-height':'55px'};
    passport.children=passport.children.filter(n=>n.type!=='icon');
    passport.children[0].type='text';passport.children[0].role='body';passport.children[0].tokens={...passport.children[0].tokens,font:display,'text-size':'21px',leading:'1.1',tracking:'.06em'};
    const badge=passport.children.find(n=>n.type==='panel'&&n.children?.length);
    badge.tokens={bg:'accent',fg:'input-bg',muted:'input-bg',border:'input-bg',pad:'16px 10px',gap:'6px',radius:'50%',align:'center'};badge.narrow={pad:'12px',gap:'4px'};badge.edges='all';
    for(const node of badge.children){node.tokens={...node.tokens,'text-size':node.emphasis?'29px':'9px',...(node.emphasis?{font:display}:{})};if(node.narrow)node.narrow={'text-size':node.emphasis?'29px':'9px'};}
    const barcode=passport.children.at(-1);barcode.tokens={...barcode.tokens,fg:'input-bg',muted:'input-bg'};barcode.min='22px';
    root.start[0].children=[panel([passport],{bg:'accent',pad:'4px',gap:'0',border:'input-bg'})];root.start[0].children[0].edges='all';
    root.start[0].tokens.pad='20px';root.end[0].tokens.pad='48px 30px 28px 16px';root.end[0].narrow.pad='24px';
  }
  // Artwork retains its palette token; only the form's own surface changes
  // input ground. This keeps brand recoloring and capture conversion aligned.
  if([3,10].includes(id))root[id===3?'start':'end'][0].tokens['input-bg']='bg';
  if(id===6){const copy=root.end[0];copy.children=copy.children.map(node=>node.type==='button'?{type:'stack',children:[node],tokens:{'input-bg':'bg',gap:copy.tokens.gap||'16px'}}:node);}
  for(const screen of design.tree.steps)walk(screen.content,node=>{
    for(const bag of ['tokens','narrow'])if(node[bag]&&!Object.keys(node[bag]).length)delete node[bag];
    if(node.type&&!['panel','media','stack','row','grid','split'].includes(node.type)&&!node.id)node.id='n'+(++serial);
  });
}

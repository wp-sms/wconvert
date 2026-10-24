/** Receipt fidelity: original silhouette and ornaments, with every word still editable. */
import fs from 'node:fs';
export function refineReceipt(design) {
 const byId = new Map();
 const walk = n => { if(n.id) byId.set(n.id,n); for(const key of ['children','start','end']) for(const child of n[key]||[]) walk(child); };
 walk(design.tree.steps[0].content);
 const item = id => byId.get(id);
 const panel = (children,pad='0') => ({type:'panel',children,tokens:{pad,gap:'0',radius:'0'}});
 const row = children => ({type:'row',children,tokens:{align:'space-between',gap:'12px'}});
 const mono = 'monospace';
 design.tokens.bg='transparent'; design.tokens['input-bg']='#fff6d8'; design.tokens.border='fg'; design.tokens.shadow='none';
 const art=name=>'data:image/png;base64,'+fs.readFileSync(new URL('../pilot/assets/black-friday/fidelity-receipt-'+name+'.png',import.meta.url)).toString('base64');
 const eyes={type:'image',id:'n15',src:art('eyes'),alt:'',fit:'contain',shape:'rect',motion:'breathe',tokens:{'image-height':'48px',radius:'0'}};
 item('n1').tokens={'text-size':'8px',tracking:'1.5px',leading:'1.6'};
 item('n2').tokens={'heading-size':'48px','heading-weight':'400','heading-leading':'.91',tracking:'-.5px'};
 item('n2').narrow={'heading-size':'47px'};
 for(const id of ['n3','n4','n6','n7','n9']) item(id).tokens={font:mono,'text-size':'13px',leading:'1.2'};
 for(const id of ['n4','n7']) {item(id).emphasis=item(id).emphasis||item(id).text;item(id).text='%b';}
 item('n10').text='30%'; delete item('n10').emphasis; item('n10').tokens={font:'"Bebas Neue", Impact, sans-serif','text-size':'55px',leading:'1.2'};delete item('n10').narrow;
 item('n11').tokens={...item('n11').tokens,'text-size':'14px',leading:'1.35'};
 item('n12').tokens={'text-size':'14px',leading:'1.5',align:'center'};
 const rules=['n13','n14'].map(id=>({...item(id),type:'divider',id,pattern:'dashed'}));
 const ledger=panel([row([item('n3'),item('n4')]),row([item('n6'),item('n7')])],'17px 0');ledger.tokens.gap='13px';
 const barcode=panel([]);barcode.min='23px';barcode.tokens['bg-image']='repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 5px,currentColor 5px 6px,transparent 6px 9px,currentColor 9px 13px,transparent 13px 15px)';
 const content=panel([panel([eyes],'0 0 22px'),item('n1'),panel([item('n2')],'16px 0 18px'),rules[0],ledger,rules[1],panel([row([item('n9'),item('n10')])],'17px 0'),{type:'row',children:[item('n11')],tokens:{gap:'0'}},panel([barcode],'20px 20px 0'),panel([item('n12')],'13px 0 0')],'45px 28px 22px');
 content.tokens.bg='input-bg';content.narrow={pad:'45px 24px 17px'};
 const edge={type:'image',id:'n16',src:art('edge'),alt:'',fit:'cover',shape:'rect',tokens:{'image-height':'18px',radius:'0'}};
 design.tree.steps[0].content={type:'stack',children:[content,edge],tokens:{gap:'0'}};
 return design;
}

// THROWAWAY: three setup layouts on the existing editor prototype route.
// Question: can a merchant pair a main product with useful extras and place them easily?
// Catalog, placement, cart, publication and reports are in-memory simulations.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Coffee, Brush, Package, ShoppingBag, SlidersHorizontal, Monitor, Smartphone, FlaskConical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import '@/index.css';
import './prototype.css';

const variants = { A: 'Guided setup', B: 'Familiar editor', C: 'Summary first' };
const catalog = [
  { id: 'filter', name: 'Reusable coffee filter', price: 15, Icon: Coffee, shade: 'sand', detail: 'Fits the Everyday brewer' },
  { id: 'brush', name: 'Cleaning brush', price: 8, Icon: Brush, shade: 'pink', detail: 'Care for your coffee equipment' },
  { id: 'jar', name: 'Coffee storage jar', price: 12, Icon: Package, shade: 'sage', detail: 'Keep your beans fresh' },
  { id: 'grinder', name: 'Burr coffee grinder', price: 65, Icon: Coffee, shade: 'sand', detail: 'Choose your finish', variable: true },
];
const mainProducts = [
  { id: 'brewer', name: 'Everyday brewer', price: 120, detail: 'A better morning, one cup at a time.', extras: ['filter', 'brush', 'jar'] },
  { id: 'espresso', name: 'Everyday espresso machine', price: 180, detail: 'Your daily espresso ritual.', extras: ['brush', 'jar', 'grinder'] },
];
const placements = { product: 'Product page', cart: 'Basket page' };
const scenarios = { empty: 'Empty basket', normal: 'Main product in basket', already: 'Brush already in basket', unrelated: 'Different product / unrelated basket', missing: 'No saved product pairings', soldout: 'All suggestions unavailable' };
const initial = { main: 'brewer', source: 'selected', selected: ['filter', 'brush', 'jar'], action: 'add', exclude: true, headline: 'Useful extras for your daily ritual', placement: 'product' };
const getMain = d => mainProducts.find(p => p.id === d.main);
const getCandidates = (d, scenario) => d.source === 'cross' ? (scenario === 'missing' ? [] : getMain(d).extras) : d.selected;

function Field({ title, children, hint }) { return <label className="rp-field"><span>{title}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Choice({ active, onClick, title, description }) { return <button className={`rp-choice ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}><span className="rp-radio">{active && <span/>}</span><span><strong>{title}</strong><small>{description}</small></span></button>; }

function Settings({ d, patch, scenario, section = 'all' }) {
  const main = getMain(d);
  return <div className="rp-settings">
    {(section === 'all' || section === 'main') && <><h3>1. Choose the main product</h3><Field title="Recommend extras for"><select value={d.main} onChange={e => { const next = mainProducts.find(p => p.id === e.target.value); patch({ main: next.id, selected: next.extras }); }}>{mainProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><p className="rp-hint">Sample catalog · changing the main product loads its example pairing.</p></>}
    {(section === 'all' || section === 'products') && <><h3>2. Choose useful extras</h3>
      {d.source === 'selected' ? <fieldset className="rp-products"><legend>Your picks for {main.name}</legend>{catalog.map(p => <label key={p.id}><input type="checkbox" checked={d.selected.includes(p.id)} onChange={() => patch({ selected: d.selected.includes(p.id) ? d.selected.filter(id => id !== p.id) : [...d.selected, p.id] })}/><p.Icon size={19}/><span>{p.name}{p.variable && <small>Requires options</small>}</span><b>${p.price}</b></label>)}</fieldset> : <div className="rp-note"><strong>{scenario === 'missing' ? 'No pairing in this sample visit' : 'Using saved WooCommerce pairings'}</strong><p>{scenario === 'missing' ? 'Choose extras manually, or configure cross-sells in WooCommerce.' : main.extras.map(id => catalog.find(p => p.id === id).name).join(', ') + '.'}</p></div>}
      <p className="rp-hint">Pick extras you know work with this product. Up to three available suggestions appear.</p>
      <details className="rp-advanced"><summary>More options</summary><h3>Product source</h3><Choice active={d.source === 'selected'} onClick={() => patch({ source: 'selected' })} title="Products I choose" description="Control the extras for this recommendation."/><Choice active={d.source === 'cross'} onClick={() => patch({ source: 'cross' })} title="My WooCommerce cross-sells" description="Reuse product pairings already saved in your store."/><h3>Shopper action</h3><Choice active={d.action === 'add'} onClick={() => patch({ action: 'add' })} title="Add to cart" description="Add a supported product without leaving the page."/><Choice active={d.action === 'view'} onClick={() => patch({ action: 'view' })} title="View product" description="Open the product page to learn more."/><p className="rp-hint">Products requiring options open their product page. {d.action === 'add' ? 'Only confirmed additions count as the campaign result.' : 'The first product-link click counts as the campaign result.'}</p><Field title="Heading"><input value={d.headline} onChange={e => patch({ headline: e.target.value })}/></Field><label className="rp-check"><input type="checkbox" checked={d.exclude} onChange={e => patch({ exclude: e.target.checked })}/>Hide products already in the basket</label></details>
    </>}
    {(section === 'all' || section === 'placement') && <><h3>3. Choose the placement</h3><Choice active={d.placement === 'product'} onClick={() => patch({ placement: 'product' })} title="Product page" description="Show extras while shoppers consider the main product."/><Choice active={d.placement === 'cart'} onClick={() => patch({ placement: 'cart' })} title="Basket page" description="Show extras when the main product is in the basket."/><p className="rp-hint">{d.placement === 'product' ? 'Appears after the product summary, including when the basket is empty.' : 'Appears beside the basket contents. An empty or unrelated basket gets no offer.'}</p><div className="rp-note"><strong>Placement preview</strong><p>The real store location must be checked before publishing. Checkout and order confirmation are excluded.</p></div></>}
  </div>;
}

function StorePreview({ d, scenario, added, mainAdded, onMainAdd, status, onAction, mobile, setMobile }) {
  const main = getMain(d);
  const unrelated = scenario === 'unrelated';
  const hasMain = !unrelated && (scenario !== 'empty' || mainAdded);
  const basket = [...(scenario === 'already' ? ['brush'] : []), ...added];
  const candidates = getCandidates(d, scenario);
  const eligible = candidates.map(id => catalog.find(p => p.id === id)).filter(p => !d.exclude || !basket.includes(p.id));
  let products = eligible.slice(0, 3);
  let reason = '';
  if (unrelated) reason = d.placement === 'product' ? 'This is a different product page.' : 'The main product is not in this basket.';
  else if (d.placement === 'cart' && !hasMain) reason = 'This campaign needs the main product in the basket.';
  else if (scenario === 'soldout') reason = 'The suggestions are unavailable.';
  else if (!candidates.length) reason = d.source === 'cross' ? 'No pairings saved. Configure WooCommerce cross-sells or choose extras manually.' : 'Choose at least one extra product.';
  else if (d.action === 'add' && !products.some(p => !p.variable)) reason = eligible.length ? 'These extras require options. Choose a directly addable product or use View product.' : 'All suitable extras are already in the basket.';
  else if (!products.length) reason = 'All suitable extras are already in the basket.';
  if (reason) products = [];
  const total = (unrelated ? 12 : hasMain ? main.price : 0) + basket.reduce((sum, id) => sum + catalog.find(p => p.id === id).price, 0);
  const viewing = unrelated ? 'Ceramic mug' : main.name;
  return <section className="rp-stage"><div className="rp-stagebar"><span>{placements[d.placement]} preview · simulated</span><div><button aria-label="Desktop preview" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={17}/></button><button aria-label="Phone preview" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={17}/></button></div></div>
    <div className={`rp-store ${mobile ? 'phone' : ''}`}><header><span>everyday<span className="rp-store-dot">.</span></span><span className="rp-cart-total"><ShoppingBag size={16}/>Basket · ${total.toFixed(2)}</span></header>
      {d.placement === 'product' ? <div className="rp-product-hero"><div className="rp-main-art"><Coffee size={76} strokeWidth={1}/></div><div><small>COFFEE, MADE SIMPLE</small><h2>{viewing}</h2><p>{unrelated ? 'A cup for your daily ritual.' : main.detail}</p><strong>${(unrelated ? 12 : main.price).toFixed(2)}</strong><button className="rp-shopbutton" disabled={unrelated || hasMain || status.kind === 'pending' || status.kind === 'unknown'} onClick={onMainAdd}>{unrelated || hasMain ? 'In your basket' : 'Add main product to basket'}</button></div></div> : <div className="rp-basket"><small>YOUR BASKET</small><div><h2>A better morning.</h2><b>${total.toFixed(2)}</b></div><p>{unrelated ? 'Ceramic mug' : hasMain ? `${main.name}${basket.length ? ` + ${basket.length} ${basket.length === 1 ? 'extra' : 'extras'}` : ''}` : basket.length ? `${basket.length} ${basket.length === 1 ? 'extra' : 'extras'} in your basket` : 'Your basket is empty.'}</p></div>}
      {products.length > 0 && <div className="rp-offer"><small>CHOSEN TO GO TOGETHER</small><h2>{d.headline}</h2><p>Selected extras for your {main.name}.</p><div className="rp-cardgrid">{products.map(p => <article key={p.id}><div className={`rp-art ${p.shade}`}><p.Icon size={46} strokeWidth={1}/></div><h3>{p.name}</h3><p>{p.detail}</p><strong>${p.price.toFixed(2)}</strong><button className="rp-shopbutton" disabled={status.kind === 'pending' || status.kind === 'unknown'} onClick={() => onAction(p)}>{status.id === p.id && status.kind === 'pending' ? 'Adding…' : p.variable ? 'Choose options' : d.action === 'add' ? 'Add to cart' : 'View product'}</button></article>)}</div></div>}
      <div className={`rp-status ${status.kind}`} role="status" aria-live="polite" tabIndex={-1}>{status.message}</div><footer>Thoughtfully made. Enjoyed every day.</footer></div>
    <div className="rp-preview-reason" role="status"><strong>{products.length ? 'Why this appears' : 'No recommendation shown'}</strong><p>{products.length ? `${d.placement === 'product' ? 'Viewing' : 'Basket contains'} ${main.name}. ${products.length} eligible ${products.length === 1 ? 'extra' : 'extras'}${d.exclude ? '; items already in the basket are hidden' : ''}.` : reason}</p><small>Preview explanation · shoppers do not see this note.</small></div>
  </section>;
}

function VariantA({ settings, preview }) {
  const [step, setStep] = useState(0);
  return <div className="rp-guided"><aside><small>RECOMMEND AN ACCESSORY</small><h2>Three small decisions.</h2><p>Main product. Useful extras. Where to show them.</p>{['Main product', 'Useful extras', 'Placement'].map((label, i) => <button key={label} className={step === i ? 'current' : ''} onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button>)}<div className="rp-guide-edit">{settings(['main', 'products', 'placement'][step])}</div><Button onClick={() => setStep((step + 1) % 3)}>{step === 2 ? 'Back to main product' : 'Continue'}<ArrowRight size={15}/></Button></aside>{preview}</div>;
}
function VariantB({ settings, preview, tab }) { return <div className="rp-workspace">{preview}<aside className="rp-inspector"><div className="rp-panel-title"><SlidersHorizontal size={17}/><h2>{tab === 'rules' ? 'Display rules' : 'Recommend useful extras'}</h2></div>{settings(tab === 'rules' ? 'placement' : 'all')}</aside></div>; }
function VariantC({ settings, preview, d }) {
  const [section, setSection] = useState('main');
  return <div className="rp-summary"><section><small>CAMPAIGN SUMMARY</small><h2>A useful extra. An easy next step.</h2><p>{d.placement === 'product' ? 'When someone views' : 'When a basket contains'} {getMain(d).name}, show available extras.</p><div className="rp-summary-rows">{[['main', 'For', getMain(d).name], ['products', 'Recommend', d.source === 'cross' ? 'Saved WooCommerce pairings' : `${d.selected.length} selected extras`], ['placement', 'Show on', placements[d.placement]]].map(([key, label, value]) => <React.Fragment key={key}><button aria-expanded={section === key} onClick={() => setSection(section === key ? '' : key)}><span>{label}</span><strong>{value}</strong><ChevronRight size={17}/></button>{section === key && <div className="rp-summary-editor">{settings(key)}</div>}</React.Fragment>)}</div></section>{preview}</div>;
}

export function App() {
  useEffect(() => { document.title = 'Product recommendations · WConvert prototype'; }, []);
  const [variant, setVariant] = useState(() => { const v = new URLSearchParams(location.search).get('variant'); return variants[v] ? v : 'B'; });
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState('design');
  const [scenario, setScenario] = useState('empty');
  const [response, setResponse] = useState('success');
  const [added, setAdded] = useState([]);
  const [mainAdded, setMainAdded] = useState(false);
  const [status, setStatus] = useState({ kind: 'idle', message: '' });
  const [converted, setConverted] = useState(false);
  const [events, setEvents] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const timer = useRef(null);
  const pending = useRef(false);
  const reset = () => { clearTimeout(timer.current); pending.current = false; setAdded([]); setMainAdded(false); setStatus({ kind: 'idle', message: '' }); setConverted(false); setEvents(0); };
  const patch = update => { reset(); setD(current => ({ ...current, ...update })); };
  const switchVariant = next => { setVariant(next); const url = new URL(location.href); url.searchParams.set('variant', next); history.replaceState(null, '', url); };
  useEffect(() => {
    const change = e => {
      if (e.target.closest('input,textarea,select,[contenteditable], [role="dialog"]') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault(); const keys = Object.keys(variants); switchVariant(keys[(keys.indexOf(variant) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]);
    };
    window.addEventListener('keydown', change); return () => window.removeEventListener('keydown', change);
  }, [variant]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function onAction(p) {
    if (pending.current || status.kind === 'unknown') return;
    if (p.variable || d.action === 'view') { setStatus({ kind: 'link', message: `${p.variable ? 'Choose options' : 'Product page'} would open for ${p.name}. No real navigation occurs in this prototype.` }); if (d.action === 'view') { setConverted(true); setEvents(n => n + 1); } return; }
    pending.current = true; setStatus({ kind: 'pending', id: p.id, message: 'Waiting for the store to confirm…' });
    timer.current = setTimeout(() => {
      pending.current = false;
      if (response === 'failure') { setStatus({ kind: 'error', id: p.id, message: 'This item became unavailable. Nothing was added. Try another suggestion.' }); return; }
      if (response === 'unknown') { setStatus({ kind: 'unknown', id: p.id, message: 'We couldn’t confirm the update. Check your basket before trying again. Reset the sample to continue.' }); return; }
      setAdded(items => [...items, p.id]); setConverted(true); setEvents(n => n + 1); setStatus({ kind: 'success', id: p.id, message: `${p.name} added to your basket.` });
      requestAnimationFrame(() => document.querySelector('.rp-status')?.focus());
    }, 900);
  }
  const onMainAdd = () => { if (pending.current || status.kind === 'unknown') return; setMainAdded(true); setStatus({ kind: 'success', message: `${getMain(d).name} added. This main-product action does not count as a recommendation result.` }); };
  const settings = section => <Settings d={d} patch={patch} scenario={scenario} section={section}/>;
  const preview = <StorePreview {...{ d, scenario, added, mainAdded, onMainAdd, status, onAction, mobile, setMobile }}/>;
  const configuredIds = d.source === 'cross' ? getMain(d).extras : d.selected;
  const ready = configuredIds.length > 0 && (d.action === 'view' || configuredIds.some(id => !catalog.find(p => p.id === id).variable));
  return <main className="rp-app">
    <div className="rp-prototype-note"><FlaskConical size={14}/><span>Interactive prototype · Sample products and basket · Nothing is saved or published</span></div>
    <header className="rp-header"><div className="rp-logo">W</div><div><small>WConvert / Campaigns</small><h1>Coffee essentials <span>Draft</span></h1></div><div className="rp-header-actions"><Button variant="outline" onClick={() => setModal('test')}><FlaskConical size={16}/>Test a sample visit</Button><Button onClick={() => setModal('review')}>Review setup<ChevronRight size={16}/></Button></div></header>
    <nav className="rp-tabs" aria-label="Campaign editor"><button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>Design</button><button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>Display rules</button><button className="rp-results-link" onClick={() => setModal('results')}>View sample results<ArrowRight size={14}/></button></nav>
    {variant === 'A' ? <VariantA {...{ settings, preview }}/> : variant === 'C' ? <VariantC {...{ settings, preview, d }}/> : <VariantB {...{ settings, preview, tab }}/>}
    {variant !== 'B' && tab === 'rules' && <section className="rp-extra-rules">{settings('placement')}</section>}
    <section className="rp-lab"><div><FlaskConical size={18}/><strong>Try the experience</strong><span>Prototype controls</span></div><div className="rp-lab-fields"><Field title="Sample visit"><select value={scenario} onChange={e => { reset(); setScenario(e.target.value); }}>{Object.entries(scenarios).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field title="Store response"><select value={response} onChange={e => { reset(); setResponse(e.target.value); }}><option value="success">Successful addition</option><option value="failure">Store rejects addition</option><option value="unknown">Response lost</option></select></Field><Button variant="outline" onClick={reset}><RotateCcw size={15}/>Reset sample</Button></div><p className="rp-evidence">Campaign results: <b>{converted ? 1 : 0}</b> · {d.action === 'add' ? 'Confirmed extra additions' : 'Product clicks'}: <b>{events}</b> · Purchases: <b>not measured in this simulation</b></p><details><summary>Inspect current prototype state</summary><pre>{JSON.stringify({ variant, draft: d, scenario, response, mainProductAdded: mainAdded, basketAdditions: added, status, headlineConversions: converted ? 1 : 0, activityEvents: events }, null, 2)}</pre></details></section>
    {notice && <p className="rp-notice" role="status">{notice}</p>}
    {import.meta.env.DEV && <aside className="rp-switcher" aria-label="Prototype layouts"><button aria-label="Previous layout" onClick={() => switchVariant(Object.keys(variants)[(Object.keys(variants).indexOf(variant) + 2) % 3])}><ArrowLeft size={17}/></button>{Object.entries(variants).map(([key, name]) => <button key={key} aria-pressed={variant === key} onClick={() => switchVariant(key)}><b>{key}</b><span>{name}{key === 'B' ? ' · recommended' : ''}</span></button>)}<button aria-label="Next layout" onClick={() => switchVariant(Object.keys(variants)[(Object.keys(variants).indexOf(variant) + 1) % 3])}><ArrowRight size={17}/></button></aside>}
    <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null); }}><DialogContent className="rp-dialog"><DialogTitle>{modal === 'review' ? 'Review your recommendation' : modal === 'results' ? 'Results from this sample' : 'Test a sample visit'}</DialogTitle><DialogDescription>{modal === 'review' ? 'A review of the simulated draft. This does not publish a campaign.' : modal === 'results' ? 'These counts describe only your interactions with the prototype.' : 'Try a product page, basket or failure state. No real WooCommerce cart is changed.'}</DialogDescription>
      {modal === 'review' ? <><div className="rp-review-line"><Check size={18}/><span>{d.placement === 'product' ? 'When shoppers view' : 'When the basket contains'} {getMain(d).name}</span></div><p>{d.source === 'cross' ? 'Use its saved WooCommerce pairings' : `${d.selected.length} extras selected`} · {placements[d.placement]}</p><div className="rp-review-line"><Check size={18}/><span>{d.action === 'add' ? 'Count the first confirmed extra addition per appearance' : 'Count the first product-link click per appearance'}</span></div><p>{ready ? 'Product setup is ready for a real placement check.' : 'Choose a suitable extra product before continuing.'}</p><div className="rp-note">Next in the real app: verify the {d.placement === 'product' ? 'supported product-page location or campaign block' : 'campaign block on the basket page'}. This prototype has not installed anything.</div><Button disabled={!ready} onClick={() => { setModal(null); setNotice('Prototype review completed. No campaign was saved or published.'); }}>Finish prototype review</Button></> : modal === 'results' ? <><div className="rp-metric"><strong>{converted ? 1 : 0}</strong><span>{d.action === 'add' ? 'Appearance with a confirmed extra addition' : 'Appearance with a product click'}</span></div><p>{events} {d.action === 'add' ? 'successful extra additions' : 'product clicks'} in this sample. Adding another extra does not count another campaign result. Adding the main product counts neither.</p><div className="rp-note"><strong>Orders and attributed sales</strong><p>Not measured here. The real optional report links paid orders to eligible interactions; additions are not purchases or proof of extra revenue.</p></div></> : <><Field title="Visit scenario"><select value={scenario} onChange={e => { reset(); setScenario(e.target.value); }}>{Object.entries(scenarios).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field title="Addition response"><select value={response} onChange={e => { reset(); setResponse(e.target.value); }}><option value="success">Successful addition</option><option value="failure">Store rejects addition</option><option value="unknown">Response lost</option></select></Field><p className="rp-hint">An empty basket still gets extras on the matching product page. Try “No saved product pairings” with the WooCommerce source under More options. Schedule and other audience conditions are assumed to match.</p><Button onClick={() => { setModal(null); document.querySelector('.rp-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Try this sample</Button></>}
    </DialogContent></Dialog>
  </main>;
}

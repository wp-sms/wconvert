// THROWAWAY: selected layout B, refined for screen navigation and condition editing.
// Uses real screen cards, renderer previews, dialog, buttons and admin styling.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Eye, FilePlus2, Leaf, ListPlus, Monitor, Plus, RotateCcw, Smartphone, Trash2, Undo2, Workflow, X, Coffee, GitBranch, Code2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JourneyScreenCard } from '@/builder/JourneyScreenCard';
import { Preview } from '@/builder/Preview';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import '@/index.css';
import '@/builder/editor.css';
import './prototype.css';
import seeds from './scenarios.json';
import { clone, questions, activeAnswers, visibleScreens, resultFor, conditionLabel, issues, dependentScreens, moveScreen, toPreviewTemplate } from './model';

const readParam = (key, allowed, fallback) => allowed.includes(new URLSearchParams(location.search).get(key)) ? new URLSearchParams(location.search).get(key) : fallback;
const completion = s => s.kind==='capture' ? (s.optional?'Optional signup':'Save request or signup') : s.kind==='acknowledgement'?'Journey complete':s.kind==='result'?'Show matching result':'Continue only';

function Field({label,children,hint}) { return <label className="qp-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>; }
function RuleEditor({value,onChange,available,label="Show this screen"}) {
  const add=()=>{const q=available[0];if(q)onChange({match:value?.match??'all',clauses:[...(value?.clauses??[]),{question:q.id,operator:q.type==='multi'?'includes_any':'is',values:[q.options[0]?.value].filter(Boolean)}]});};
  return <div className="qp-rules">
    <Field label={label}><select value={value?'when':'always'} onChange={e=>{if(e.target.value==='always')onChange(undefined);else add();}}><option value="always">Always</option><option value="when" disabled={!available.length}>When answers match</option></select></Field>
    {!available.length&&!value&&<p className="qp-hint">Add a choice question on an earlier screen to use a condition.</p>}
    {value&&<>
      {value.clauses.length>1&&<Field label="Match"><select value={value.match} onChange={e=>onChange({...value,match:e.target.value})}><option value="all">All conditions</option><option value="any">Any condition</option></select></Field>}
      {value.clauses.map((c,i)=>{const q=available.find(q=>q.id===c.question);const update=patch=>onChange({...value,clauses:value.clauses.map((row,n)=>n===i?{...row,...patch}:row)});return <div className="qp-rule-row" key={i}>
        <Field label="Question"><select aria-label={`Condition ${i+1} question`} value={c.question} onChange={e=>{const next=available.find(q=>q.id===e.target.value);update({question:next.id,operator:next.type==='multi'?'includes_any':'is',values:[next.options[0]?.value].filter(Boolean)});}}>{!q&&<option value={c.question}>Missing earlier question</option>}{available.map(q=><option key={q.id} value={q.id}>{q.screenName}</option>)}</select></Field>
        <Field label="Answer"><select aria-label={`Condition ${i+1} operator`} value={c.operator} onChange={e=>update({operator:e.target.value})}>{q?.type==='multi'?<><option value="includes_any">includes</option><option value="includes_none">does not include</option></>:<><option value="is">is</option><option value="is_not">is not</option></>}</select></Field>
        <Field label="Choice"><select aria-label={`Condition ${i+1} choice`} value={c.values[0]??''} onChange={e=>update({values:[e.target.value]})}><option value="" disabled>Choose an answer</option>{q?.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
        <Button size="icon-sm" variant="ghost" aria-label={`Remove condition ${i+1}`} onClick={()=>onChange({...value,clauses:value.clauses.filter((_,n)=>n!==i)})}><X/></Button>
      </div>;})}
      <Button size="sm" variant="ghost" disabled={!available.length||value.clauses.length>=5} onClick={add}><Plus/>Add condition</Button>
      <p className="qp-hint">An unanswered question does not match, including “is not.”</p>
    </>}
  </div>;
}

function ResultEditor({screen,scenario,onChange}) {
  const [selected,setSelected]=useState(screen.results[0].id);
  const result=screen.results.find(r=>r.id===selected)??screen.results[0];
  const update=patch=>onChange({...screen,results:screen.results.map(r=>r.id===result.id?{...r,...patch}:r)});
  return <div className="qp-results-editor">
    <div className="qp-result-list" aria-label="Result variants">{screen.results.map((r,i)=><button key={r.id} className="qp-result-option" aria-pressed={r.id===result.id} onClick={()=>setSelected(r.id)}><span>{r.condition?i+1:<Check size={14}/>}</span><span><strong>{r.name}</strong><small>{r.condition?conditionLabel(r.condition,scenario):'Fallback · always available'}</small></span></button>)}</div>
    <div className="qp-result-content">{result.condition&&<div className="qp-action-group"><Button size="sm" variant="outline" disabled={screen.results.indexOf(result)===0} onClick={()=>{const ordered=[...screen.results];const i=ordered.indexOf(result);[ordered[i-1],ordered[i]]=[ordered[i],ordered[i-1]];onChange({...screen,results:ordered});}}>Move result up</Button><Button size="sm" variant="outline" disabled={screen.results.indexOf(result)>=screen.results.length-2} onClick={()=>{const ordered=[...screen.results];const i=ordered.indexOf(result);[ordered[i+1],ordered[i]]=[ordered[i],ordered[i+1]];onChange({...screen,results:ordered});}}>Move result down</Button></div>}<p className="qp-hint">First matching result is shown. Everyone else gets the fallback.</p>
      <Field label="Result heading"><Input value={result.title} onChange={e=>update({title:e.target.value})}/></Field>
      <Field label="Result description"><textarea rows={2} value={result.body} onChange={e=>update({body:e.target.value})}/></Field>
      {result.condition&&<RuleEditor label="Show this result" value={result.condition} onChange={condition=>update({condition:condition??{match:'all',clauses:[]}})} available={questions(scenario).filter(q=>q.type!=='text')}/>}
      {scenario.products&&<fieldset className="qp-products-picker"><legend>WooCommerce products <span className="qp-tag">Example catalog</span></legend>{scenario.products.map(p=><label key={p.id}><input type="checkbox" checked={result.product_ids?.includes(p.id)??false} onChange={e=>update({product_ids:e.target.checked?[...(result.product_ids??[]),p.id]:(result.product_ids??[]).filter(id=>id!==p.id)})}/><span>{p.name}<small>{p.currency}{p.price} · In stock</small></span></label>)}</fieldset>}
    </div>
  </div>;
}

function QuestionEditor({screen,scenario,onChange,notify}) {
  const q=screen.question;
  const update=patch=>onChange({...screen,question:{...q,...patch}});
  const used=dependentScreens(scenario,q.id);
  return <div className="qp-question-editor">
    <Field label="Question"><textarea rows={2} value={q.label} onChange={e=>update({label:e.target.value})}/></Field>
    <Field label="Answer type"><select value={q.type} onChange={e=>{if(used.length){notify(`This question is used by ${used.join(', ')}. Remove those conditions before changing its answer type.`);return;}update({type:e.target.value});}}><option value="single">Choose one</option><option value="multi">Choose several</option><option value="text">Short answer</option></select></Field>
    <label className="qp-check"><input type="checkbox" checked={q.required} onChange={e=>update({required:e.target.checked})}/>Required answer</label>
    {q.type!=='text'&&<fieldset><legend>Answer choices</legend>{q.options.map((o,i)=><div className="qp-choice-edit" key={o.value}><Input aria-label={`Choice ${i+1} label`} value={o.label} onChange={e=>update({options:q.options.map((v,n)=>n===i?{...v,label:e.target.value}:v)})}/><Button size="icon-sm" variant="ghost" aria-label={`Remove choice ${i+1}`} onClick={()=>{const referenced=scenario.screens.some(s=>[s.condition,...(s.results??[]).map(r=>r.condition)].some(c=>c?.clauses.some(c=>c.question===q.id&&c.values.includes(o.value))));if(referenced){notify('This choice is used by a screen or result. Update that condition before removing it.');return;}update({options:q.options.filter((_,n)=>n!==i)});}}><X/></Button></div>)}<Button variant="outline" size="sm" onClick={()=>update({options:[...q.options,{value:`choice_${Date.now()}`,label:'New choice'}]})}><Plus/>Add choice</Button></fieldset>}
    <Field label="Help text"><Input value={q.help??''} onChange={e=>update({help:e.target.value})}/></Field>
    {used.length>0&&<div className="qp-explanation"><GitBranch size={15}/><p>Used by {used.join(' and ')}. Renaming keeps these connections.</p></div>}
  </div>;
}

function ScreenDetails({scenario,selected,editScreen,onDesign,onDelete,onDuplicate,onMove,onAccessChange,setSelected}) {
  const screen=scenario.screens[selected];
  const earlier=questions({...scenario,screens:scenario.screens.slice(0,selected)}).filter(q=>q.type!=='text');
  const conditional=screen.kind==='question'||screen.kind==='content';
  const usedBy=screen.question?scenario.screens.filter(s=>s.condition?.clauses.some(c=>c.question===screen.question.id)||(s.results??[]).some(r=>r.condition?.clauses.some(c=>c.question===screen.question.id))):[];
  return <section className="qp-editor-pane" aria-label="Selected screen settings">
    <header className="qp-selected-header"><div className="wconvert-journey-dialog__selected"><span>{selected+1}</span><div><h3>{screen.name}</h3><small>{screen.kind==='question'?'Question':screen.kind==='capture'?'Contact details':screen.kind==='result'?'Results':screen.kind==='content'?'Offer':'Acknowledgement'} · Screen {selected+1} of {scenario.screens.length}</small></div></div></header>
    <div className="wconvert-journey-dialog__details qp-details" key={screen.id}>
    {usedBy.length>0&&<div className="qp-dependencies"><span><GitBranch size={14}/>Used by</span>{usedBy.map(s=><button key={s.id} onClick={()=>setSelected(scenario.screens.indexOf(s))}>{s.name}<ArrowRight size={12}/></button>)}</div>}
    <div className="wconvert-journey-dialog__fields"><Field label="Screen name"><Input value={screen.name} onChange={e=>editScreen({...screen,name:e.target.value})}/></Field><div className="qp-field"><span>When this screen is completed</span><div className="qp-completion"><Check size={15}/>{completion(screen)}</div></div></div>
    {conditional&&<div className="qp-condition-section"><RuleEditor value={screen.condition} onChange={condition=>editScreen({...screen,condition})} available={earlier}/>{screen.condition&&<div className="qp-explanation"><GitBranch size={15}/><p>{conditionLabel(screen.condition,scenario)}. Otherwise continue to the next relevant screen.</p></div>}</div>}
    {screen.kind==='result'&&scenario.products&&<div className="qp-condition-section"><Field label="Result access" hint="This changes the screen order and campaign goal together."><select value={scenario.capture} onChange={e=>onAccessChange(e.target.value)}><option value="optional">Show results first · signup is optional</option><option value="required">Require email before showing results</option></select></Field><p className="qp-hint">{scenario.capture==='required'?'Primary conversion: accepted contact details. Explain this gate before the quiz starts.':'Primary conversion: quiz completed. An optional signup adds a lead, not a second conversion.'}</p></div>}
    {screen.kind==='result'&&<ResultEditor key={screen.id} screen={screen} scenario={scenario} onChange={editScreen}/>}
    {screen.kind!=='result'&&<div className="wconvert-journey-dialog__behavior"><strong>{completion(screen)}</strong><p>{screen.kind==='question'?'Answers stay on this page until an explicit submission. Continue does not save a lead.':screen.kind==='content'?'Shows an offer or explanation, then continues without saving a lead.':screen.kind==='acknowledgement'?'Confirms an accepted submission. This screen stays last.':screen.optional?'Visitors can skip this signup. Their result or earlier signup remains available.':'Saves the request or signup here, with the relevant answers.'}</p></div>}
    </div>
    <footer className="qp-screen-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">Screen actions<ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem disabled={!conditional||scenario.screens.length>=7} onSelect={onDuplicate}><Copy/>Duplicate screen</DropdownMenuItem><DropdownMenuItem disabled={selected===0||screen.kind==='acknowledgement'} onSelect={()=>onMove(selected,selected-1)}><ArrowLeft/>Move screen earlier</DropdownMenuItem><DropdownMenuItem disabled={selected===scenario.screens.length-1||screen.kind==='acknowledgement'} onSelect={()=>onMove(selected,selected+1)}><ArrowRight/>Move screen later</DropdownMenuItem><DropdownMenuItem disabled={!conditional} onSelect={onDelete}><Trash2/>Delete screen</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button size="sm" onClick={onDesign}>Edit design<ArrowRight/></Button></footer>
  </section>;
}

function ScreenCards({scenario,selected,setSelected,onMove}) {
  const template=toPreviewTemplate(scenario);
  const rail=useRef(null);
  useEffect(()=>{rail.current?.querySelector('[data-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[selected,scenario.screens.length]);
  return <ol ref={rail} className="wconvert-journey-dialog__screens" aria-label="Screens in visitor order">{scenario.screens.map((screen,index)=><JourneyScreenCard key={screen.id} template={template} index={index} selected={index===selected} scope={scenario.id} label={screen.condition?conditionLabel(screen.condition,scenario):completion(screen)} onSelect={()=>setSelected(index)} onMove={(from,to)=>onMove(scenario.screens.findIndex(s=>s.id===from),scenario.screens.findIndex(s=>s.id===to))}/>)}</ol>;
}
function ScreenManager(props) {
  return <div className="qp-side-layout">
    <div className="qp-mobile-screen-picker"><Field label="Screen"><select value={props.selected} onChange={e=>props.setSelected(Number(e.target.value))}>{props.scenario.screens.map((s,i)=><option key={s.id} value={i}>{i+1}. {s.name}{s.condition?' · Conditional':''}</option>)}</select></Field></div>
    <aside className="qp-screen-rail" aria-label="Journey screens"><div className="qp-rail-heading"><strong>Screens</strong><span>{props.scenario.screens.length} / 7</span><p>In visitor order · some may be skipped</p></div><ScreenCards {...props}/></aside><ScreenDetails {...props}/>
  </div>;
}

function JourneyRunner({scenario,onEditCondition}) {
  const [answers,setAnswers]=useState({});const[currentId,setCurrentId]=useState(scenario.screens[0].id);
  const[accepted,setAccepted]=useState([]);const[lead,setLead]=useState(null);const[completed,setCompleted]=useState(false);const[clicked,setClicked]=useState(false);const[error,setError]=useState('');const[productState,setProductState]=useState('ready');const[mobile,setMobile]=useState(false);
  const[email,setEmail]=useState('');const[phone,setPhone]=useState('');const[consent,setConsent]=useState(false);
  const heading=useRef(null);
  const active=activeAnswers(scenario,answers);const visible=visibleScreens(scenario,active);const screen=scenario.screens.find(s=>s.id===currentId)??visible[0];const index=visible.findIndex(s=>s.id===screen.id);
  const result=resultFor(screen,active);const resultScreen=scenario.screens.find(s=>s.kind==='result');const previousLead=lead!==null;
  const change=(id,value)=>{if(lead)return;setAnswers(activeAnswers(scenario,{...answers,[id]:value}));setError('');};
  function show(id){setCurrentId(id);setError('');if(scenario.screens.find(s=>s.id===id)?.kind==='result')setCompleted(true);}
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[currentId]);
  const next=()=>{
    if(screen.question){const v=active[screen.question.id];if(screen.question.required&&(v===undefined||v===''||Array.isArray(v)&&!v.length)){setError('Choose an answer to continue.');return;}}
    const target=visible[index+1];if(target)show(target.id);
  };
  const back=()=>{if(visible[index-1])show(visible[index-1].id);};
  const submit=e=>{e.preventDefault();if(accepted.includes(screen.id)){next();return;}if(!consent&&scenario.id!=='garden'&&!screen.accessGate){setError(screen.optional?'Choose to receive updates, or skip this optional step.':'Please agree to receive updates to sign up.');return;}setLead({...lead,answers:clone(active),marketingConsent:{...lead?.marketingConsent,[screen.channel]:consent},...(screen.channel==='sms'?{phone:phone.trim()}:{email:email.trim()})});setAccepted([...accepted,screen.id]);setConsent(false);next();};
  const reset=()=>{setAnswers({});setCurrentId(scenario.screens[0].id);setAccepted([]);setLead(null);setCompleted(false);setClicked(false);setError('');setEmail('');setPhone('');setConsent(false);};
  const products=productState==='ready'?(scenario.products??[]).filter(p=>result?.product_ids?.includes(p.id)):[];
  const summary={answers:active,visible:visible.map(s=>s.name),skipped:scenario.screens.filter(s=>!visible.includes(s)).map(s=>s.name),lead,quizCompleted:completed,resultClicked:clicked,productSimulation:scenario.products?productState:undefined};
  return <div className="qp-runner">
    <div className="qp-preview-controls"><div className="qp-action-group"><Button size="sm" variant={mobile?'ghost':'secondary'} onClick={()=>setMobile(false)}><Monitor/>Desktop</Button><Button size="sm" variant={mobile?'secondary':'ghost'} onClick={()=>setMobile(true)}><Smartphone/>Phone</Button></div><Button variant="ghost" size="sm" onClick={reset}><RotateCcw/>Restart preview</Button></div>
    <div className="qp-runner-grid"><div className="qp-visitor-stage"><div className={`qp-visitor ${mobile?'qp-visitor-mobile':''}`} style={{'--qp-brand':scenario.accent}}><span className="qp-brand">{scenario.business}</span><p className="qp-stage-name">{screen.kind==='result'?'Your result':screen.kind==='capture'?(screen.optional?'Optional signup':'Your details'):screen.kind==='acknowledgement'?'Complete':'Your needs'}</p>
      <h2 tabIndex={-1} ref={heading}>{screen.question?.label??result?.title??screen.heading}</h2>
      {index===0&&scenario.capture==='required'&&resultScreen&&<p className="qp-gate-notice">At the end, enter your email to see your match. Marketing updates are optional.</p>}{screen.question?.help&&<p>{screen.question.help}</p>}{screen.body&&screen.kind!=='result'&&<p>{screen.body}</p>}
      {screen.question&&<fieldset className="qp-visitor-answers" disabled={previousLead}><legend className="qp-sr">{screen.question.label}</legend>{screen.question.type==='text'?<textarea aria-label={screen.question.label} value={active[screen.question.id]??''} onChange={e=>change(screen.question.id,e.target.value)}/>:screen.question.options.map(o=><label key={o.value}><input type={screen.question.type==='multi'?'checkbox':'radio'} name={screen.question.id} value={o.value} checked={screen.question.type==='multi'?(active[screen.question.id]??[]).includes(o.value):active[screen.question.id]===o.value} onChange={e=>{if(screen.question.type==='multi'){const values=active[screen.question.id]??[];change(screen.question.id,e.target.checked?[...values,o.value]:values.filter(v=>v!==o.value));}else change(screen.question.id,o.value);}}/><span>{o.label}</span></label>)}</fieldset>}
      {previousLead&&screen.question&&<p className="qp-hint">These answers were submitted. You can review them here.</p>}
      {screen.kind==='result'&&<><p>{result?.body}</p>{scenario.products?<div className="qp-live-products">{products.length?products.map(p=><div className="qp-product" key={p.id}><div className="qp-product-art"><Coffee size={38}/><span>SUNDAY</span></div><div><strong>{p.name}</strong><small>{p.detail}</small><span>{p.currency}{p.price}</span><button type="button" onClick={()=>setClicked(true)}>View product <ArrowRight size={14}/></button></div></div>):<div className="qp-product-fallback"><Coffee size={24}/><strong>{(productState==='empty'||productState==='ready')?'These coffees are currently unavailable':'We could not load products right now'}</strong><p>Your result is still here. Explore our collection for more options.</p><button type="button" onClick={()=>setClicked(true)}>Explore all coffee <ArrowRight size={14}/></button><button type="button" onClick={()=>setProductState('ready')}>Try again</button></div>}</div>:<button className="qp-visitor-primary" onClick={()=>setClicked(true)}>{result?.link_label??'Explore your match'} <ArrowRight size={16}/></button>}
        {scenario.capture==='optional'&&!lead&&<div className="qp-optional-offer"><span>Your match is ready. Updates are optional.</span><button onClick={()=>show(scenario.screens.find(s=>s.kind==='capture').id)}>Get coffee news by email <ArrowRight size={14}/></button></div>}
        {clicked&&<p className="qp-hint" role="status">Preview: result click recorded locally. No store page opened.</p>}
      </>}
      {screen.kind==='capture'&&<form onSubmit={submit}><label className="qp-contact-label">{screen.channel==='sms'?'Phone number':'Email address'}<input type={screen.channel==='sms'?'tel':'email'} required readOnly={accepted.includes(screen.id)} value={screen.channel==='sms'?phone:email} onChange={e=>screen.channel==='sms'?setPhone(e.target.value):setEmail(e.target.value)} placeholder={screen.channel==='sms'?'+1 202 555 0100':'you@example.com'}/></label>{scenario.id!=='garden'&&!accepted.includes(screen.id)&&<label className="qp-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Send me {screen.channel==='sms'?'text':'email'} updates and offers. I can opt out later.</label>}<button className="qp-visitor-primary" type="submit">{accepted.includes(screen.id)?'Continue':screen.button}<ArrowRight size={16}/></button></form>}
      {error&&<p className="qp-error" role="alert">{error}</p>}
      <div className="qp-visitor-nav">{index>0&&<button onClick={back}><ArrowLeft size={14}/>Back</button>}{(screen.question||screen.kind==='content')&&<button className="qp-visitor-primary" onClick={next}>{visible[index+1]?.kind==='result'?'See my result':'Continue'}<ArrowRight size={16}/></button>}{screen.optional&&<button onClick={()=>resultScreen?show(resultScreen.id):show(scenario.screens.at(-1).id)}>No thanks</button>}{screen.kind==='acknowledgement'&&resultScreen&&<button onClick={()=>show(resultScreen.id)}>Back to my result<ArrowRight size={14}/></button>}</div>
    </div></div>
    <aside className="qp-trace"><h3>Path preview</h3><p className="qp-hint">What this visitor sees with these answers.</p><ol>{scenario.screens.map((s,i)=>{const shown=visible.includes(s);return <li key={s.id} data-active={s.id===screen.id} data-skipped={!shown}><span>{i+1}</span><div><strong>{s.name}</strong><small>{!shown?`Skipped · ${conditionLabel(s.condition,scenario)}`:s.id===screen.id?'Here now':completion(s)}</small>{s.condition&&<button className="qp-edit-condition" onClick={()=>onEditCondition(i)}>Edit condition<ArrowRight size={12}/></button>}</div></li>;})}</ol><div className="qp-trace-facts"><p><strong>{scenario.capture==='required'?(lead?1:0):(completed?1:0)}</strong> primary conversions · {scenario.capture==='required'?'accepted capture':'quiz completion'}</p><p><strong>{lead?'1':'0'}</strong> leads saved in this preview</p>{resultScreen&&<p><strong>{completed?'1':'0'}</strong> {scenario.capture==='required'?'results reached':'quiz completions'}</p>}<p>{lead?'Relevant answers are attached to the submitted lead.':'Answers exist only in this preview. Nothing has been submitted.'}</p></div>
      {scenario.products&&<Field label="Simulate product availability"><select value={productState} onChange={e=>setProductState(e.target.value)}><option value="ready">Products available</option><option value="empty">Selected products out of stock</option><option value="error">Product API unavailable</option><option value="missing">WooCommerce deactivated</option></select></Field>}
      <details className="qp-debug"><summary><Code2 size={14}/>Inspect prototype state</summary><pre>{JSON.stringify(summary,null,2)}</pre></details>
    </aside></div>
  </div>;
}

export function App() {
  const dialogTitle=useRef(null);
  const[scenarioId,setScenarioId]=useState(()=>readParam('scenario',seeds.map(s=>s.id),'garden'));
  const[drafts,setDrafts]=useState(()=>Object.fromEntries(seeds.map(s=>[s.id,clone(s)])));
  const[selectedId,setSelectedId]=useState(()=>{const seed=seeds.find(s=>s.id===readParam('scenario',seeds.map(s=>s.id),'garden'));return seed.screens[seed.id==='newsletter'?0:1].id;});const[open,setOpen]=useState(true);const[testing,setTesting]=useState(false);const[history,setHistory]=useState([]);const[notice,setNotice]=useState('');const[showState,setShowState]=useState(false);
  const scenario=drafts[scenarioId];const selectedIndex=Math.max(0,scenario.screens.findIndex(s=>s.id===selectedId));const screen=scenario.screens[selectedIndex];const problems=issues(scenario);
  const selectScreen=index=>setSelectedId(scenario.screens[index].id);
  const change=next=>{setHistory(h=>[...h.slice(-29),clone(scenario)]);setDrafts(d=>({...d,[scenarioId]:next}));setNotice('Draft updated in memory. Undo is available.');};
  const editScreen=next=>change({...scenario,screens:scenario.screens.map((s,i)=>i===selectedIndex?next:s)});
  function historyReplace(url){window.history.replaceState({},'',url);}
  const switchScenario=id=>{setScenarioId(id);setSelectedId(drafts[id].screens[id==='newsletter'?0:Math.min(1,drafts[id].screens.length-1)].id);setHistory([]);setTesting(false);setNotice('');const url=new URL(location.href);url.searchParams.set('scenario',id);historyReplace(url);};
  useEffect(()=>{document.title='Manage screens · WConvert prototype';const url=new URL(location.href);url.searchParams.set('variant','B');window.history.replaceState({},'',url);},[]);
  const move=(from,to)=>{const next=moveScreen(scenario,from,to);if(!next){setNotice('Keep questions before the screens that use their answers, capture after questions, and acknowledgement last.');return;}change(next);setSelectedId(next.screens[to].id);};
  const add=kind=>{const id=`new_${Date.now()}`;const boundary=scenario.screens.findIndex(s=>['result','capture','acknowledgement'].includes(s.kind));const insertion=Math.min(selectedIndex+1,boundary<0?scenario.screens.length:boundary);const next=clone(scenario);next.screens.splice(insertion,0,kind==='question'?{id,name:'New question',kind:'question',question:{id,type:'single',label:'What would you like?',required:false,options:[{value:'first',label:'First option'},{value:'second',label:'Second option'}]}}:{id,name:'New offer',kind:'content',heading:'Something for you',body:'Tell visitors what comes next.'});change(next);setSelectedId(next.screens[insertion].id);};
  const remove=()=>{const used=screen.question?dependentScreens(scenario,screen.question.id):[];if(used.length){setNotice(`Cannot delete yet: ${used.join(', ')} uses this question. Edit those conditions first. Nothing was removed.`);return;}change({...scenario,screens:scenario.screens.filter((_,i)=>i!==selectedIndex)});setSelectedId(scenario.screens[Math.max(0,selectedIndex-1)]?.id);};
  const duplicate=()=>{const next=clone(scenario);const copy=clone(screen);copy.id=`screen_${Date.now()}`;copy.name+=' copy';if(copy.question)copy.question.id=`question_${Date.now()}`;next.screens.splice(selectedIndex+1,0,copy);change(next);setSelectedId(copy.id);};
  const undo=()=>{const previous=history.at(-1);if(!previous)return;setDrafts(d=>({...d,[scenarioId]:previous}));setHistory(h=>h.slice(0,-1));if(!previous.screens.some(s=>s.id===selectedId))setSelectedId(previous.screens[Math.min(selectedIndex,previous.screens.length-1)].id);setNotice('Undid the last draft change.');};
  const accessChange=mode=>{const next=clone(scenario);const result=next.screens.find(s=>s.kind==='result');const original=seeds.find(s=>s.id===scenario.id);const email=clone(original.screens.find(s=>s.kind==='capture'));next.screens=next.screens.filter(s=>!['capture','result','acknowledgement'].includes(s.kind));next.capture=mode;if(mode==='required'){next.screens.push({...email,name:'Email before results',optional:false,accessGate:true,heading:'Enter your email to see your match',body:'Enter your email to see your result. Updates are a separate, optional choice.',button:'See my coffee match'},result);next.description='Email is required before results; marketing signup is optional.';}else{next.screens.push(result,email,clone(original.screens.at(-1)));next.description=original.description;}change(next);setSelectedId(result.id);setNotice('Updated result access, screen order, and primary conversion together. Undo is available.');};
  const shared={scenario,onAccessChange:accessChange,selected:selectedIndex,setSelected:selectScreen,editScreen,onDesign:()=>setOpen(false),onDelete:remove,onDuplicate:duplicate,onMove:move,notify:setNotice};
  return <div id="wconvert-admin" className="qp-app">
    <div className="qp-shell-top"><span className="qp-wordmark"><Leaf size={22}/>WConvert</span><span className="qp-breadcrumb">Campaigns / {scenario.name}</span><span className="qp-tag">Prototype · nothing is published</span></div>
    <main className="qp-workspace"><div className="qp-workspace-top"><div><p>{scenario.purpose}</p><h1>{scenario.name}</h1></div><Button onClick={()=>{setTesting(false);setOpen(true);}}><Workflow/>Manage screens</Button></div>
      <div className="qp-canvas-toolbar"><span>Design</span><div><Monitor size={16}/>Desktop <span>100%</span></div><Button size="sm" variant="outline" onClick={()=>{setTesting(true);setOpen(true);}}><Eye/>Test journey</Button></div>
      <div className="qp-canvas-layout"><aside className="qp-canvas-inspector"><h2>{screen.question?'Question':screen.kind==='result'?'Results':'Screen content'}</h2><p className="qp-hint">{screen.name}</p>{screen.question?<QuestionEditor screen={screen} scenario={scenario} onChange={editScreen} notify={setNotice}/>:<><Field label="Heading"><Input value={screen.heading??screen.name} onChange={e=>editScreen({...screen,heading:e.target.value})}/></Field><Field label="Body"><textarea rows={4} value={screen.body??''} onChange={e=>editScreen({...screen,body:e.target.value})}/></Field></>}<Button variant="outline" onClick={()=>setOpen(true)}><ArrowLeft/>Back to Manage screens</Button></aside><div className="qp-canvas"><Preview template={toPreviewTemplate(scenario)} step={selectedIndex}/><p className="qp-hint">The existing template renderer draws this preview.</p></div></div>
      {!open&&notice&&<p role="status" className="qp-canvas-notice">{notice}</p>}
    </main>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent onOpenAutoFocus={e=>{e.preventDefault();dialogTitle.current?.focus();}} showCloseButton={false} className={`wconvert-journey-dialog qp-dialog qp-variant-B${testing?' qp-testing':''}`}>
      <div className="qp-demo-context"><label>Example <select aria-label="Example journey" value={scenarioId} onChange={e=>switchScenario(e.target.value)}>{seeds.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><span>{scenario.description}</span><span className="qp-tag">B · Selected layout</span>{!testing&&<button className="qp-inspect" aria-expanded={showState} onClick={()=>setShowState(!showState)}><Code2 size={13}/>Prototype data</button>}</div>
      <div className="wconvert-journey-dialog__header"><div><DialogTitle ref={dialogTitle} tabIndex={-1}>{testing?'Test journey':'Manage screens'}</DialogTitle><DialogDescription>{testing?'Try different answers. No real leads, messages, or product requests are sent.':'Visitors see relevant screens in order. Select a screen to make changes.'}</DialogDescription></div><div className="wconvert-journey-dialog__header-actions">{testing?<Button size="sm" variant="outline" onClick={()=>setTesting(false)}><ArrowLeft/>Manage screens</Button>:<><Button variant="outline" size="sm" disabled={!!problems.length} onClick={()=>setTesting(true)}><Eye/>Test journey</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={scenario.screens.length>=7}><Plus/>Add screen<ChevronDown/></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>add('question')}><ListPlus/>Add question screen</DropdownMenuItem><DropdownMenuItem onSelect={()=>add('content')}><FilePlus2/>Add offer screen</DropdownMenuItem></DropdownMenuContent></DropdownMenu></>}<Button size="icon-sm" variant="ghost" aria-label="Close screen manager" onClick={()=>setOpen(false)}><X/></Button></div></div>
      {problems.length>0&&!testing&&<div className="qp-problems" role="alert">{problems.map(p=><p key={p}>{p}</p>)}</div>}
      {testing?<JourneyRunner key={scenarioId} scenario={scenario} onEditCondition={index=>{selectScreen(index);setTesting(false);setNotice("Editing this screen’s condition. Start Test journey again to check the updated path.");}}/>:<ScreenManager {...shared}/>}
      {!testing&&<div className="wconvert-journey-dialog__footer"><p role="status">{notice||'Changes are part of this in-memory draft.'}</p><div className="qp-action-group"><Button variant="ghost" size="sm" disabled={!history.length} onClick={undo}><Undo2/>Undo</Button><Button variant="outline" onClick={()=>setOpen(false)}>Done</Button></div></div>}
      {showState&&!testing&&<pre className="qp-debug-data">{JSON.stringify({layout:'B',selected:screen.id,scenario},null,2)}</pre>}
    </DialogContent></Dialog>
  </div>;
}

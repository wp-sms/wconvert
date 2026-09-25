// THROWAWAY: two researched directions for authoring a visitor journey.
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Workflow, ArrowLeft, ArrowRight, Plus, Undo2, Redo2, X, GitBranch, Play, Settings2, LayoutTemplate, Globe, Send, Check, ChevronRight, Trash2, Eye, MoveUp, MoveDown, CircleHelp, Search, PanelRightClose, Flag } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import '@/index.css';
import '@xyflow/react/dist/style.css';
import './prototype.css';
import './refinement.css';
import './clarity.css';
import './experience.css';
import './workbench.css';
import './campaign-workflow.css';
import './task-clarity.css';
import './map-experience.css';
import { SampleExplorer } from './MapExperience';
import { AnswerRemoval, ImpactSummary } from './EditingTools';
import { answerReferences, changeImpact, describeEdit } from './editing';
import './editing.css';
import { StepsView } from './StepsView';
import { CaptureSettings, PublishReview, SetupSummary, campaignChecks, signature } from './CampaignWorkflow';
const CurrentBaseline = lazy(() => import('./CurrentBaseline'));
import { PreviewAndTest, RendererScreen } from './PreviewAndTest';
import { ShowCondition, ResultsEditor, ScreenActions } from './ScreenTools';
import { ArrivalSummary, RouteRules } from './JourneyExperience';
import { seed, clone, variants, edgeLabel, questionFor, validConnection, graphIssues, nextEdge, destinations, questionsUpstream, edgeCondition, ruleText, sampleJourney, reviewJourney, referencesTo } from './model';
import { resultFor } from '../journey-prototype/model';
import { JourneyGraph } from './Graph';

const scenarioNames = { stress: 'Large journey · 20 screens', signup: 'Simple email signup', interests: 'Multiple interests', blank: 'Start from scratch', garden: 'Garden consultation', coffee: 'Find your coffee', newsletter: 'Email + optional SMS' };
const kindLabel = s => s.kind === 'capture' ? (s.optional ? 'Optional signup' : 'Collect details') : s.kind === 'question' ? 'Question' : s.kind === 'result' ? 'Results' : s.kind === 'acknowledgement' ? 'Ending' : 'Message';
function Field({ label, children, hint }) { return <label className="fp-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function MiniScreen({ screen }) {
  return <div className={`fp-mini fp-mini-${screen.kind}`}><span className="fp-mini-brand">fern & form</span><strong>{screen.question?.label ?? screen.heading ?? screen.name}</strong>{screen.question ? <div className="fp-mini-choices">{screen.question.options?.slice(0, 3).map(o => <span key={o.value}>○ {o.label}</span>)}</div> : screen.kind === 'capture' ? <><span className="fp-mini-input">{screen.channel === 'sms' ? 'Phone number' : 'Email address'}</span><b>{screen.button ?? 'Continue'}</b></> : <p>{screen.body ?? 'Something selected just for you.'}</p>}</div>;
}
const readParam = (key, values, fallback) => values.includes(new URLSearchParams(location.search).get(key)) ? new URLSearchParams(location.search).get(key) : fallback;

export function App() { return new URLSearchParams(location.search).get('compare') === 'current' ? <Suspense fallback={<p>Loading the current screen manager…</p>}><CurrentBaseline/></Suspense> : <FlowApp/>; }

function FlowApp() {
  const [variant, setVariant] = useState(() => readParam('variant', Object.keys(variants), 'B'));
  const [view, setView] = useState(() => readParam('view', ['steps','map'], 'map'));
  const [guideHidden,setGuideHidden] = useState(false);
  const changeView = value => { setView(value); setSearching(false); const url=new URL(location.href);url.searchParams.set('view',value);history.replaceState(null,'',url); };
  const [scenario, setScenario] = useState(() => readParam('scenario', Object.keys(scenarioNames), 'garden'));
  const [d, setD] = useState(() => seed(scenario));
  const [past, setPast] = useState([]);
  const [future,setFuture] = useState([]);
  const lastEdit = useRef(null);
  const inspectorRef = useRef(null);
  const historyRef = useRef(null);
  const [pendingChange,setPendingChange] = useState(null);
  const [selected, setSelected] = useState({ kind: 'overview', id: null });
  const [editingScreenId, setEditingScreenId] = useState(d.entry);
  const [tab, setTab] = useState('journey');
  const [manager, setManager] = useState(true);
  const [testing, setTesting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [savedDraft, setSavedDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [testRuns, setTestRuns] = useState([]);
  const [testCase, setTestCase] = useState(null);
  const [stateOpen, setStateOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [layout, setLayout] = useState({});
  const [visited, setVisited] = useState([]);
  const [visitedEdges, setVisitedEdges] = useState([]);
  const [saved, setSaved] = useState(false);
  const [previews, setPreviews] = useState(false);
  const [picker, setPicker] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const clearSample = () => { setVisited([]); setVisitedEdges([]); setSelected({ kind: 'overview', id: null }); };
  const patch = (updater, meta={}) => {
    const next=updater(d); if(JSON.stringify(next)===JSON.stringify(d))return;
    const active=document.activeElement;
    const typing=active?.matches('textarea,input:not([type]),input[type="text"],input[type="number"]');
    const coalesce=!meta.label && typing && lastEdit.current?.element===active && Date.now()-lastEdit.current.at<1200;
    const label=meta.label??describeEdit(d,next);
    if(!coalesce)setPast(p=>[...p.slice(-29),{draft:clone(d),selection:selected,label}]);
    lastEdit.current=typing&&!meta.label?{element:active,at:Date.now()}:null;
    setFuture([]);setD(next);setSaved(false);setVisited([]);setVisitedEdges([]);setNotice(`${label}. Undo available.`);
  };
  const restore = direction => {
    const stack=direction==='undo'?past:future, entry=stack.at(-1);if(!entry)return;
    const snapshot={draft:clone(d),selection:selected,label:entry.label};
    if(direction==='undo'){setPast(p=>p.slice(0,-1));setFuture(f=>[...f,snapshot]);}else{setFuture(f=>f.slice(0,-1));setPast(p=>[...p,snapshot]);}
    setD(clone(entry.draft));lastEdit.current=null;setVisited([]);setVisitedEdges([]);
    setSaved(Boolean(savedDraft&&signature(savedDraft)===signature(entry.draft)));
    const candidate=entry.selection;
    const valid=candidate.kind==='screen'?entry.draft.screens.some(s=>s.id===candidate.id):candidate.kind==='edge'?entry.draft.edges.some(e=>e.id===candidate.id):candidate.kind!=='sample';
    setSelected(valid?candidate:{kind:'overview',id:null});if(valid&&candidate.kind==='screen')setEditingScreenId(candidate.id);
    setNotice(`${direction==='undo'?'Undid':'Redid'}: ${entry.label}.`);
    requestAnimationFrame(()=>{if(document.activeElement===document.body||document.activeElement?.disabled)(inspectorRef.current??historyRef.current)?.focus();});
  };
  const reviewChange = (updater,label,after) => {
    const next=updater(d),impact=changeImpact(d,next);
    if(impact.disconnected.length||impact.errors.length||impact.removed.some(s=>s.kind==='capture'))setPendingChange({next,impact,label,after});
    else{patch(()=>next,{label});after?.();}
  };
  useEffect(()=>{
    const clear=()=>{lastEdit.current=null;};document.addEventListener('focusout',clear);
    return()=>document.removeEventListener('focusout',clear);
  },[]);
  useEffect(()=>{
    const key=e=>{if(e.target.closest('input,textarea,select,[contenteditable],[role="dialog"]'))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(e.shiftKey?'redo':'undo');}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[d,past,future,selected,savedDraft]);
  const select = (kind, id, section) => { setSelected({ kind, id, section }); if (kind === 'screen') setEditingScreenId(id); if (kind !== 'overview') setTab('journey'); };
  useEffect(()=>{if(selected.section)inspectorRef.current?.focus();},[selected.kind,selected.id,selected.section]);
  const jump = id => { select('screen', id); setFocus({ id, at: Date.now() }); setSearching(false); setQuery(''); };
  const changeVariant = value => { setVariant(value); setManager(true); const url = new URL(location.href); url.searchParams.set('variant', value); history.replaceState(null, '', url); };
  const changeScenario = value => { setScenario(value); const next = seed(value); setD(next); setSavedDraft(null); setPublished(null); setTestRuns([]); setTestCase(null); setEditingScreenId(next.entry); setPast([]); setFuture([]); lastEdit.current=null; setPendingChange(null); setSelected({ kind: 'overview', id: null }); setLayout({}); setVisited([]); setSaved(false); setNotice(''); const url = new URL(location.href); url.searchParams.set('scenario', value); history.replaceState(null, '', url); };
  useEffect(() => { document.title = 'Journey builder · WConvert prototype'; const url = new URL(location.href); if (!Object.keys(variants).includes(url.searchParams.get('variant'))) { url.searchParams.set('variant', 'B'); history.replaceState(null, '', url); } }, []);
  useEffect(() => {
    const onKey = e => { if (e.target.closest('input,textarea,select,[contenteditable],.react-flow,[role="dialog"]') || e.altKey || e.ctrlKey || e.metaKey) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); changeVariant(variant === 'A' ? 'B' : 'A'); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [variant]);
  const issues = campaignChecks(d);
  const saveDraft = () => { lastEdit.current=null; setSavedDraft(clone(d)); setSaved(true); setNotice('Draft snapshot saved in this session. Reload resets the prototype.'); };
  const startTest = value => { setTestCase(value ?? null); setPublishOpen(false); setTesting(true); };
  const screen = d.screens.find(s => s.id === (selected.kind === 'screen' ? selected.id : editingScreenId)) ?? d.screens[0];
  const updateScreen = changed => patch(old => ({ ...old, screens: old.screens.map(s => s.id === changed.id ? changed : s) }));
  const edge = d.edges.find(e => e.id === selected.id);
  const panelOpen = selected.kind !== 'overview';
  const connect = ({ source, target, sourceHandle }) => {
    if (!validConnection(d, source, target)) { setNotice('That connection would create a loop or leave an ending screen. Choose a later screen.'); return; }
    const existing = d.edges.find(e => e.id === sourceHandle);
    if (existing) { reviewChange(old => ({ ...old, edges: old.edges.map(e => e.id === existing.id ? { ...e, target } : e) }), 'Reconnect path', ()=>select('edge',existing.id)); return; }
    if (d.edges.some(e => e.source === source && e.target === target && !e.skip)) { select('edge', d.edges.find(e => e.source === source && e.target === target && !e.skip).id); return; }
    const value = d.edges.some(e => e.source === source && !e.skip) ? '__choose__' : null;
    const next = { id: `path-${Date.now()}`, source, target, value };
    patch(old => ({ ...old, edges: [...old.edges.filter(e => !(e.source === source && e.value === null)), next, ...old.edges.filter(e => e.source === source && e.value === null)] }));
    select('edge', next.id); setNotice('Path connected. Choose the answer that follows it.');
  };
  const finishAdd = ({ kind, name, mode, existing, answer, question }) => {
    const onEdge = d.edges.find(e => e.id === picker.edge);
    const source = onEdge?.source ?? picker.source ?? d.entry;
    const outgoing = d.edges.filter(e => e.source === source && !e.skip);
    const replacement = onEdge ?? (['insert','conditional'].includes(mode) ? outgoing.find(e => e.value === null) : null);
    if (existing) { if (replacement) { setPicker(null); reviewChange(old => ({ ...old, edges: old.edges.map(e => e.id === replacement.id ? { ...e, target: existing } : e) }), 'Reconnect path', ()=>select('edge', replacement.id)); } else { const id = `path-${Date.now()}`; patch(old => ({ ...old, edges: [...old.edges, { id, source, target: existing, value: outgoing.length ? answer : null, question }] })); select('edge', id); } setPicker(null); return; }
    const id = `screen-${Date.now()}`;
    const created = { id, kind, name, ...(kind === 'question' ? { question: { id, label: name, type: 'single', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] } } : { heading: name, body: kind === 'acknowledgement' ? 'Thanks for your time.' : 'Add your message here.' }), ...(kind === 'capture' ? { channel: 'email', button: 'Send my details' } : {}) };
    if (mode === 'conditional') created.showWhen = {match:'all',clauses:[{question,operator:'includes_any',values:[answer]}]};
    const inbound = replacement ? { ...replacement, target: id } : { id: `path-${id}`, source, target: id, value: outgoing.length ? answer : null, question };
    const join = replacement?.target ?? outgoing.find(e => e.value === null)?.target;
    const next = kind !== 'acknowledgement' && join ? [{ id: `${id}-next`, source: id, target: join, value: null }] : [];
    patch(old => ({ ...old, screens: [...old.screens, created], edges: replacement ? [...old.edges.map(e => e.id === replacement.id ? inbound : e), ...next] : [...old.edges.filter(e => !(e.source === source && e.value === null)), inbound, ...old.edges.filter(e => e.source === source && e.value === null), ...next] }));
    setPicker(null); select('screen', id); setFocus({ id, at: Date.now() });
    setNotice(mode === 'conditional' ? 'Conditional follow-up added. Every matching follow-up can appear; other answers continue to the following screen.' : replacement ? 'Screen inserted on this path. The original condition and following screen are preserved.' : 'Answer path added. Edit its screen or select the condition to change it.');
  };
  const inspector = panelOpen && <aside key={`${selected.kind}-${selected.id}-${selected.section??''}`} ref={inspectorRef} tabIndex={-1} className="fp-inspector" aria-label="Selection settings"><div className="fp-inspector-heading"><span>{selected.kind === 'edge' ? 'EDIT PATH' : selected.kind === 'display' ? 'WHEN IT APPEARS' : selected.kind === 'destinations' ? 'AFTER SUBMISSION' : selected.kind === 'sample' ? 'SAMPLE VISITOR' : selected.kind === 'review' ? 'JOURNEY CHECK' : 'EDIT SCREEN'}</span><button aria-label="Close settings panel" onClick={() => select('overview', null)}><X size={17}/></button></div>
    {selected.kind === 'sample' ? <SampleExplorer key={scenario} d={d} trace={(screens,edges)=>{setVisited(screens);setVisitedEdges(edges);}} select={select}/> : selected.kind === 'edge' && edge ? <EdgeInspector d={d} edge={edge} patch={patch} reviewChange={reviewChange} select={select} add={() => setPicker({ edge: edge.id })}/> : selected.kind === 'display' ? <DisplayInspector d={d} patch={patch} full={() => setTab('display')}/> : selected.kind === 'destinations' ? <DestinationInspector d={d} patch={patch}/> : selected.kind === 'review' ? <ReviewInspector issues={issues} jump={jump} select={select} test={() => startTest()}/> : <ScreenInspector reveal={selected.section} d={d} screen={screen} update={updateScreen} select={select} connect={connect} patch={patch} add={mode => setPicker({ source: screen.id, mode })} design={() => { setTab('design'); setManager(false); }}/>}<div className="fp-inspector-note">{selected.kind==='sample'?'Sample answers only · campaign unchanged':'Part of this campaign draft · Undo available'}</div></aside>;
  const toolbar = <div className="fp-map-toolbar jt-toolbar">
    {variant === 'B' ? <div className="mx-map-heading"><strong>Journey map</strong><button aria-pressed={view==='steps'} onClick={()=>changeView(view==='steps'?'map':'steps')}>{view==='steps'?'Back to map':`Screens (${d.screens.length})`}</button></div> : <strong>Manage screens</strong>}
    {(view==='map'||variant==='A') && <div className="fx-find"><button onClick={()=>setSearching(!searching)}><Search size={15}/>Find screen</button>{searching && <div className="fx-find-panel"><input aria-label="Find a screen" placeholder="Search by screen name…" value={query} onChange={e=>setQuery(e.target.value)} autoFocus/>{d.screens.filter(s=>s.name.toLowerCase().includes(query.toLowerCase())).map(s=><button key={s.id} onClick={()=>jump(s.id)}><span><b>{s.name}</b><small>{kindLabel(s)}{s.showWhen?' · Conditional':''}</small></span><ArrowRight size={12}/></button>)}</div>}</div>}
    <Button variant="outline" size="sm" onClick={()=>setPicker(selected.kind==='edge'?{edge:selected.id}:{source:screen.kind==='acknowledgement'?d.entry:screen.id,mode:'insert'})}><Plus/>Add screen</Button><Button variant="outline" size="sm" onClick={()=>{changeView('map');select('sample',null);}}>Try answers</Button><Button size="sm" onClick={()=>startTest()}><Play/>Preview</Button>
    {variant==='B' && <details className="jt-more"><summary>More</summary><div>{d.id==='interests' && <button onClick={e=>{setGuideHidden(!guideHidden);e.currentTarget.closest('details').open=false;}}>{guideHidden?'Show setup guide':'Hide setup guide'}</button>}<button onClick={e=>{setExpanded(!expanded);e.currentTarget.closest('details').open=false;}}>{expanded?'Exit focus':'Focus workspace'}</button><button onClick={e=>{setStateOpen(true);e.currentTarget.closest('details').open=false;}}>Prototype details</button></div></details>}
    {variant==='A' && <button className="fx-toolbar-close" aria-label="Close screen manager" onClick={()=>setManager(false)}><X size={19}/></button>}
  </div>;
  const workspace = <div className={`fp-workspace fx-refined ${panelOpen ? 'has-inspector' : ''}`}>
    {toolbar}<div className="fx-context"><button onClick={() => select('display', 'display')}><Globe size={14}/><span><b>Starts:</b> {d.rules.audience} · {d.rules.type === 'inline' ? 'Inline placement' : d.rules.trigger === 'exit' ? 'Exit intent' : d.rules.trigger === 'click' ? 'On click' : `after ${d.rules.delay}s`}</span><ChevronRight size={12}/></button><span className="fx-context-separator"/><button onClick={() => select('destinations', 'destinations')}><Send size={14}/><span>{d.destinations.length ? d.destinations.map(id => destinations[id].name).join(' + ') : 'Save in WConvert only'}</span><ChevronRight size={12}/></button></div>
    {variant === 'B' && d.id === 'interests' && !guideHidden && <div className="jt-setup-wrap"><button className="jt-dismiss" onClick={()=>setGuideHidden(true)}>Dismiss</button><SetupSummary d={d} runs={testRuns} open={select} test={() => setPublishOpen(true)}/></div>}
    {d.starter && d.screens.length === 1 && <div className="wb-starter"><div><strong>What would you like visitors to do?</strong><p>Start with a proven structure, then make it yours.</p></div><Button variant="outline" onClick={() => setTemplates(true)}>Choose a starting point</Button><button onClick={() => setPicker({ source: d.entry, mode: 'insert' })}>Build my own →</button></div>}

    <div className={`fp-workspace-body ${variant==='B'&&view==='steps'?'jt-steps-body':''}`}>{variant==='B'&&view==='steps' ? <StepsView d={d} selected={selected} select={select} preview={setPreviewId} add={setPicker} visited={visited} onMap={()=>changeView('map')}/> : <JourneyGraph key={scenario} d={d} selected={selected} select={select} connect={connect} add={setPicker} preview={setPreviewId} previews={previews} setPreviews={setPreviews} positions={layout} setPositions={setLayout} visited={visited} visitedEdges={visitedEdges} clearTrace={clearSample} sampleActive={selected.kind==='sample'} focus={focus} variant={variant}/>}{inspector}</div>
    <div className="fx-workspace-footer" role="status"><span>{notice || (view==='steps' ? 'Find a screen here. Use the map to understand its connections.' : 'Select a screen to edit. Connection tools appear on selection.')}</span>{variant==='A' && <button onClick={() => setStateOpen(true)}>Prototype details</button>}</div>
  </div>;
  const switcher = import.meta.env.DEV ? <div className="fp-switcher"><button aria-label="Previous layout" onClick={() => changeVariant(variant === 'A' ? 'B' : 'A')}><ArrowLeft size={16}/></button><span><small>COMPARE DIRECTIONS</small>{variant} · {variants[variant]}</span><button aria-label="Next layout" onClick={() => changeVariant(variant === 'A' ? 'B' : 'A')}><ArrowRight size={16}/></button><i/><select aria-label="Example campaign" value={scenario} onChange={e => changeScenario(e.target.value)}>{Object.entries(scenarioNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div> : null;
  const previewScreen = d.screens.find(s => s.id === previewId);
  return <div className={`fp-app fx-app fp-variant-${variant} ${expanded && tab === 'journey' ? 'wb-expanded' : ''}`}>
    <header ref={historyRef} tabIndex={-1} className="fp-header"><span className="fp-brand"><Workflow size={23}/>wconvert</span><span className="fp-divider"/><div><small>Campaign / {d.business}</small><h1>{d.name}</h1></div><span className="fp-draft">{published ? signature(published) === signature(d) ? 'Demo published' : 'Unpublished changes' : 'Draft'}</span><div className="fp-header-actions"><Button variant="ghost" size="sm" disabled={!past.length} aria-label={past.length?`Undo: ${past.at(-1).label}`:'Undo'} title={past.length?past.at(-1).label:'Nothing to undo'} onClick={()=>restore('undo')}><Undo2/>Undo</Button><Button variant="ghost" size="sm" disabled={!future.length} aria-label={future.length?`Redo: ${future.at(-1).label}`:'Redo'} title={future.length?future.at(-1).label:'Nothing to redo'} onClick={()=>restore('redo')}><Redo2/><span className="er-redo-label">Redo</span></Button><Button size="sm" onClick={saveDraft}>{saved ? 'Saved for session' : 'Save draft'}</Button><Button variant="outline" size="sm" onClick={() => setPublishOpen(true)}>Review & publish{issues.length>0 && <span className="jt-review-badge">{issues.length}</span>}</Button></div></header>
    <nav className="fp-tabs" aria-label="Campaign sections">{[['journey', 'Journey', Workflow], ['design', 'Design', LayoutTemplate], ['display', 'Display rules', Globe], ['destinations', 'Destinations', Send]].map(([id, label, Icon]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); if (id === 'journey') setManager(true); }}><Icon size={16}/>{label}</button>)}<span>{d.purpose}</span></nav>
    {tab === 'journey' && variant === 'B' ? workspace : tab === 'display' ? <div className="fp-detail-page"><div><DisplayInspector d={d} patch={patch}/><Button variant="outline" onClick={() => { setTab('journey'); setManager(true); select('display', 'display'); }}>Back to journey</Button></div></div> : tab === 'destinations' ? <div className="fp-detail-page"><div><DestinationInspector d={d} patch={patch}/><Button variant="outline" onClick={() => { setTab('journey'); setManager(true); select('destinations', 'destinations'); }}>Back to journey</Button></div></div> : <div className="fp-design-host"><div className="fp-design-toolbar"><span>Editing: {screen.name}</span><Button variant="outline" onClick={() => { setTab('journey'); setManager(true); }}><Workflow/>Manage screens</Button></div><div className="fp-design-stage"><RendererScreen d={d} screen={screen}/></div><aside><h2>Edit design</h2><Field label="Screen name"><input value={screen.name} onChange={e => updateScreen({ ...screen, name: e.target.value })}/></Field><Field label="Headline"><textarea value={screen.question?.label ?? screen.heading ?? screen.name} onChange={e => updateScreen(screen.question ? { ...screen, question: { ...screen.question, label: e.target.value } } : { ...screen, heading: e.target.value })}/></Field>{screen.question && <><h3>Answer choices</h3>{screen.question.options.map((option, i) => <Field key={option.value} label={`Choice ${i + 1}`}><input value={option.label} onChange={e => updateScreen({ ...screen, question: { ...screen.question, options: screen.question.options.map(o => o.value === option.value ? { ...o, label: e.target.value } : o) } })}/></Field>)}</>}<Button onClick={() => { setTab('journey'); setManager(true); }}>Return to journey</Button></aside></div>}
    <Dialog open={variant === 'A' && tab === 'journey' && manager} onOpenChange={setManager}><DialogContent className="fp-manager-dialog fx-manager" showCloseButton={false}><DialogTitle className="sr-only">Manage screens</DialogTitle><DialogDescription className="sr-only">Edit screens and paths without leaving your design.</DialogDescription>{workspace}{switcher}</DialogContent></Dialog>
    {!(variant === 'A' && tab === 'journey' && manager) && switcher}
    <Dialog open={Boolean(picker)} onOpenChange={open => { if (!open) setPicker(null); }}><DialogContent className="fx-add-dialog"><DialogTitle>What happens next?</DialogTitle><DialogDescription>Add a screen on this path, or connect to one you already have.</DialogDescription>{picker && <AddStep d={d} context={picker} onAdd={finishAdd}/>}</DialogContent></Dialog>
    <Dialog open={Boolean(pendingChange)} onOpenChange={open=>{if(!open)setPendingChange(null);}}><DialogContent className="er-impact-dialog"><DialogTitle>Review this path change</DialogTitle><DialogDescription>{pendingChange?.label}. Check which parts of the journey this affects.</DialogDescription>{pendingChange && <ImpactSummary impact={pendingChange.impact}/>}<div className="er-actions"><Button variant="outline" onClick={()=>setPendingChange(null)}>Keep current journey</Button><Button onClick={()=>{const proposal=pendingChange;setPendingChange(null);patch(()=>proposal.next,{label:proposal.label});proposal.after?.();}}>Apply to draft</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(previewScreen)} onOpenChange={open => { if (!open) setPreviewId(null); }}><DialogContent className="fx-screen-preview"><DialogTitle>{previewScreen?.name}</DialogTitle><DialogDescription>Screen preview · current content in the visitor renderer</DialogDescription>{previewScreen && <><RendererScreen d={d} screen={previewScreen}/><Button onClick={() => { select('screen', previewScreen.id); setPreviewId(null); setTab('design'); setManager(false); }}>Edit design & content<ArrowRight/></Button></>}</DialogContent></Dialog>
    <Dialog open={templates} onOpenChange={setTemplates}><DialogContent className="wb-templates"><DialogTitle>Choose a starting point</DialogTitle><DialogDescription>This replaces the example in this prototype. Your live campaigns are unaffected.</DialogDescription>{[['signup', 'Collect email signups', 'One form and a thank-you.'], ['interests', 'Ask relevant follow-ups', 'Visitors choose several interests and see every relevant question.'], ['coffee', 'Recommend a product', 'Questions, a personalized result and optional email signup.']].map(([id, name, description]) => <button key={id} onClick={() => { changeScenario(id); setTemplates(false); }}><strong>{name}</strong><span>{description}</span><ArrowRight size={16}/></button>)}</DialogContent></Dialog>
    <Dialog open={publishOpen} onOpenChange={setPublishOpen}><DialogContent className="cw-publish-dialog"><DialogTitle>Review this campaign</DialogTitle><DialogDescription>Check the visitor experience, then publish a simulated version.</DialogDescription><PublishReview d={d} savedDraft={savedDraft} published={published} runs={testRuns} open={(kind,id)=>{setPublishOpen(false);select(kind,id);}} test={startTest} save={saveDraft} publish={()=>{setPublished(clone(d));setNotice('Demo published from this saved draft. No live campaign was changed.');}}/></DialogContent></Dialog>
    <Dialog open={stateOpen} onOpenChange={setStateOpen}><DialogContent className="fp-review"><DialogTitle>Prototype decisions & state</DialogTitle><DialogDescription>A: focused screen manager. B: persistent journey workspace. C has been removed.</DialogDescription><a className="cw-baseline-link" href="/?prototype=flow&compare=current" target="_blank" rel="noreferrer">Compare with the actual current screen manager ↗</a><p>Named answer paths, explicit fallback, contextual insertion, optional previews, and an inspector that opens on selection. React Flow supplies canvas interactions; ELK arranges nodes using named connection ports.</p><p>First matching branch wins. Everyone else is evaluated last. This is a proposed graph model, with sample data and in-memory edits.</p><details><summary>Inspect full draft state</summary><pre>{JSON.stringify({ variant, selection: selected, draft: d, nodePositions: layout, tracedScreens: visited, tracedEdges: visitedEdges }, null, 2)}</pre></details></DialogContent></Dialog>
    <Dialog open={testing} onOpenChange={setTesting}><DialogContent className="fp-test-dialog wb-test-dialog"><DialogTitle>Preview & test</DialogTitle><DialogDescription>Try sample answers to see which screens appear and why. No details are sent.</DialogDescription>{testing && <PreviewAndTest d={d} initialCase={testCase} onComplete={run => setTestRuns(old => old.some(item => JSON.stringify(item) === JSON.stringify(run)) ? old : [...old.slice(-19),run])} edit={(kind, id, section) => { setTesting(false); select(kind, id, section); }} done={(path, edges) => { changeView('map'); setVisited(path); setVisitedEdges(edges); setSelected({ kind: 'overview', id: null }); setTesting(false); setNotice('Your sample path is highlighted. Other screens are dimmed.'); }}/>}</DialogContent></Dialog>
  </div>;
}

function AddStep({ d, context, onAdd }) {
  const edge = d.edges.find(e => e.id === context.edge);
  const source = d.screens.find(s => s.id === (edge?.source ?? context.source)) ?? d.screens[0];
  const outgoing = d.edges.filter(e => e.source === source.id && !e.skip);
  const [mode, setMode] = useState(context.mode ?? 'insert');
  const sources = questionsUpstream(d, source.id);
  const [question, setQuestion] = useState(sources[0]?.question.id ?? '');
  const q = sources.find(s => s.question.id === question)?.question;
  const [answer, setAnswer] = useState(q?.options.find(o => !outgoing.some(e => e.value === o.value && questionFor(d, e)?.id === q.id))?.value ?? q?.options[0]?.value ?? '__choose__');
  const [kind, setKind] = useState('question');
  const [name, setName] = useState('A follow-up question');
  const [existing, setExisting] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const options = [ ['question', CircleHelp, 'Ask a question', 'Learn something before continuing', 'A follow-up question'], ['content', LayoutTemplate, 'Show a message', 'Explain an offer or the next step', 'A helpful introduction'], ['capture', Send, 'Collect details', 'Save a request or signup', 'Your contact details'], ['acknowledgement', Flag, 'Finish this path', 'Show a closing message', 'All done'] ];
  return <div className="fx-add-body"><div className="fx-insertion"><span>AFTER</span><strong>{source.name}</strong>{edge && <><ArrowRight size={14}/><span>{edgeLabel(d, edge)}</span></>}</div><div className="fx-segments"><button aria-pressed={!useExisting} onClick={() => setUseExisting(false)}>New screen</button><button aria-pressed={useExisting} onClick={() => {setUseExisting(true);if(mode==='conditional')setMode('insert');}}>Existing screen</button></div>
    {!edge && outgoing.length > 0 && <fieldset className="sc-connection-choices"><legend>What should visitors experience?</legend>{[
      ['insert','Continue this path','Show the new screen to everyone taking this path.'],
      ['conditional','Ask a relevant follow-up','Check its answers rule. Skip this screen when it does not match. Other matching follow-ups can still appear.'],
      ['branch','Take a different path','Choose one next screen. The first matching rule wins; other branches are not visited.'],
    ].map(([value,title,description])=><label key={value}><input type="radio" name="connection-mode" value={value} checked={mode===value} disabled={value!=='insert'&&(!sources.length||(value==='conditional'&&useExisting))} onChange={()=>{setMode(value);if(value==='conditional'&&kind==='acknowledgement'){setKind('question');setName('A follow-up question');}}}/><span><strong>{title}</strong><small>{description}</small></span></label>)}</fieldset>}

    {!edge && ['branch','conditional'].includes(mode) && <div className="cx-branch-condition"><div className="jt-logic-note"><strong>{mode==='conditional'?'Show this screen when…':'Choose the next screen when…'}</strong><p>{mode==='conditional'?'Check this screen independently. Several matching follow-ups can appear in the same visit.':'Only the first matching branch is followed. Other matching branches are not visited.'}</p></div><Field label="Based on question"><select value={question} onChange={e => { setQuestion(e.target.value); setAnswer(sources.find(s => s.question.id === e.target.value)?.question.options[0]?.value); }}>{sources.map(s => <option key={s.id} value={s.question.id}>{s.question.label}</option>)}</select></Field><Field label="Matching answer"><select value={answer} onChange={e => setAnswer(e.target.value)}>{q?.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field></div>}
    {useExisting ? <Field label="Connect to"><select value={existing} onChange={e => setExisting(e.target.value)}><option value="">Choose a screen…</option>{d.screens.filter(s => validConnection(d, source.id, s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field> : <><div className="fx-type-options">{options.map(([id, Icon, title, description, sample]) => <button disabled={mode==='conditional' && id==='acknowledgement'} key={id} aria-pressed={kind === id} onClick={() => { setKind(id); setName(sample); }}><Icon size={20}/><span><strong>{title}</strong><small>{description}</small></span>{kind === id && <Check size={16}/>}</button>)}</div><Field label="Screen name"><input value={name} onChange={e => setName(e.target.value)}/></Field></>}
    <p>{useExisting ? 'Connects this path to the selected screen. Other incoming paths stay intact.' : mode === 'conditional' ? 'If its condition does not match, the visitor continues to the following screen. This does not create an exclusive branch.' : kind === 'acknowledgement' ? 'This path will end here. Other paths and screens stay available.' : mode === 'branch' ? 'The new branch rejoins the current fallback screen. The current fallback remains available for everyone else.' : 'The new screen is connected automatically. The current condition and following screen are preserved.'}</p>
    <Button disabled={(['branch','conditional'].includes(mode) && (!q || !answer)) || (useExisting ? !existing : !name.trim())} onClick={() => onAdd({ kind, name: name.trim(), mode, answer, question, existing: useExisting ? existing : null })}><Plus/>{useExisting ? 'Connect screen' : mode==='conditional' ? 'Add conditional follow-up' : mode==='branch' ? 'Add branch' : 'Add screen'}</Button>
  </div>;
}

function ReviewInspector({ issues, jump, select, test }) {
  return <div className="fp-inspector-content"><h2>{issues.length ? 'Review your journey' : 'Structure looks ready'}</h2><p>{issues.length ? 'Resolve incomplete settings, then test the visitor experience.' : 'No structural issues found. Preview different answers before publishing.'}</p>{issues.map((issue, i) => <button className="fx-review-item" key={i} onClick={() => issue.kind === 'screen' ? jump(issue.target) : select(issue.kind, issue.target)}><CircleHelp size={16}/><span><small>{issue.severity === 'error' ? 'NEEDS FIXING' : 'CHECK THIS'}</small>{issue.text}</span><ArrowRight size={14}/></button>)}<Button className="fp-wide" onClick={test}><Play/>Preview & test</Button><small>Checks include connectivity, missing answers, conflicting single-answer rules and identical shadowed paths. Preview covers the combinations you try; this is not exhaustive logic verification.</small></div>;
}

function ScreenInspector({ reveal, d, screen, update, select, connect, patch, add, design }) {
  const outgoing = [...d.edges.filter(e => e.source === screen.id && e.value !== null && !e.skip), ...d.edges.filter(e => e.source === screen.id && e.value === null && !e.skip), ...d.edges.filter(e => e.source === screen.id && e.skip)];
  const incoming = d.edges.filter(e => e.target === screen.id);
  const [section, setSection] = useState('content');
  const [target, setTarget] = useState('');
  const candidates = d.screens.filter(s => validConnection(d, screen.id, s.id) && !outgoing.some(e => !e.skip && e.target === s.id));
  const usedBy = referencesTo(d, screen.question?.id).filter(ref => ref.id !== screen.id);
  return <div className="fp-inspector-content"><h2>{screen.name}</h2><p>{kindLabel(screen)} · Changes update the journey immediately</p><ArrivalSummary d={d} screen={screen} select={select}/><ShowCondition initiallyOpen={reveal==='visibility'} d={d} screen={screen} update={update}/>
    <div className="cx-panel-tabs" role="tablist" aria-label="Screen editing" onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); const next = section === 'content' ? 'paths' : 'content'; setSection(next); e.currentTarget.querySelectorAll('button')[next === 'content' ? 0 : 1]?.focus(); } }}><button role="tab" aria-selected={section === 'content'} onClick={() => setSection('content')}>{screen.question ? 'Content & answers' : 'Content'}</button><button role="tab" aria-selected={section === 'paths'} onClick={() => setSection('paths')}>Next screen <span>{outgoing.length}</span></button></div>
    {section === 'content' && <div className="cx-content-editor">{screen.kind === 'result' ? <ResultsEditor initialOpened={reveal?.startsWith('result:')?reveal.slice(7):null} d={d} screen={screen} update={update} patch={patch}/> : screen.question ? <QuestionContent d={d} screen={screen} update={update} patch={patch} select={select}/> : <><Field label="Heading"><textarea value={screen.heading ?? screen.name} onChange={e => update({ ...screen, heading: e.target.value })}/></Field><Field label="Message"><textarea value={screen.body ?? ''} onChange={e => update({ ...screen, body: e.target.value })}/></Field>{screen.kind === 'capture' && <Field label="Button text"><input value={screen.button ?? 'Continue'} onChange={e => update({ ...screen, button: e.target.value })}/></Field>}</>}</div>}
    {section === 'paths' && <section><h3>Choose the next screen {outgoing.filter(e => !e.skip).length > 1 && <span>First match wins</span>}</h3>{outgoing.filter(e => !e.skip).length > 1 && <p>Choose one path: the first matching branch wins. Unlike show conditions, matching branches do not all run. Everyone else is checked last.</p>}{outgoing.length === 0 ? <p>{screen.kind === 'acknowledgement' ? 'This is an ending screen.' : 'Connect this screen to continue the journey.'}</p> : outgoing.map((e, index) => <button key={e.id} className="fp-path-row" onClick={() => select('edge', e.id)}><b>{e.value === null ? '↳' : index + 1}</b><span><strong>{edgeLabel(d, e)}</strong><small>Go to {d.screens.find(s => s.id === e.target)?.name}</small></span><ChevronRight size={14}/></button>)}
    {screen.kind !== 'acknowledgement' && <><div className="cx-next-actions"><Button variant="outline" size="sm" onClick={() => add('insert')}><Plus/>{outgoing.filter(e => !e.skip).length > 1 ? 'Insert on Everyone else' : 'Insert next screen'}</Button>{questionsUpstream(d,screen.id).length>0 && outgoing.some(e=>e.value===null&&!e.skip) && <Button variant="outline" size="sm" onClick={()=>add('conditional')}><Plus/>Add a conditional follow-up</Button>}{questionsUpstream(d, screen.id).length > 0 && <Button variant="outline" size="sm" onClick={() => add('branch')}><GitBranch/>Add branch</Button>}</div><details className="fx-advanced"><summary>Connect manually</summary><Field label="Connect to a screen"><select value={candidates.some(s => s.id === target) ? target : ''} onChange={e => setTarget(e.target.value)}><option value="">Choose a screen…</option>{candidates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Button variant="outline" size="sm" disabled={!candidates.some(s => s.id === target)} onClick={() => { connect({ source: screen.id, target }); setTarget(''); }}><Plus/>Add path</Button></details></>}
    </section>}{section === 'content' && outgoing.length > 0 && <button className="cx-next-summary" onClick={() => setSection('paths')}><GitBranch size={16}/><span><strong>{outgoing.filter(e => e.value !== null).length ? `${outgoing.filter(e => e.value !== null).length} answer path${outgoing.filter(e => e.value !== null).length===1?'':'s'} + everyone else` : `${d.screens.find(s=>s.id===outgoing[0].target)?.showWhen?'Next check':'Next'}: ${d.screens.find(s => s.id === outgoing[0].target)?.name}`}</strong><small>{outgoing.length===1 && d.screens.find(s=>s.id===outgoing[0].target)?.showWhen?'Skip this screen if its show condition does not match.':'Review or change what happens next'}</small></span><ChevronRight size={15}/></button>}{incoming.length > 1 && <div className="fp-callout"><GitBranch size={16}/><p>{incoming.length} paths rejoin here. Only the path the visitor took supplies answers.</p></div>}
    {screen.kind === 'capture' && <><CaptureSettings screen={screen} update={update}/><section><h3>After submission is saved</h3><p>{screen.optional ? 'Adds submitted details to the same journey. Skipping saves no new contact details.' : 'Saves this request or signup before continuing.'}</p>{d.destinations.filter(id => destinations[id].channel === screen.channel).map(id => <button className="fp-handoff" key={id} onClick={() => select('destinations', 'destinations')}><Send size={15}/>{destinations[id].name}<ArrowRight size={13}/></button>)}<p>Handoffs run in the background. They do not decide the visitor’s next screen.</p></section></>}
    {usedBy.length > 0 && <section><h3>Answer used by</h3>{usedBy.map(ref => <button className="fp-path-row" key={`${ref.kind}-${ref.id}`} onClick={() => select(ref.kind, ref.id)}>{ref.name}<ArrowRight size={14}/></button>)}</section>}
    <Button variant="outline" className="fp-wide cx-appearance" onClick={design}><LayoutTemplate/>Edit appearance<ArrowRight/></Button><details className="fx-advanced"><summary>Screen options</summary><Field label="Screen name"><input value={screen.name} onChange={e => update({ ...screen, name: e.target.value })}/></Field><ScreenActions d={d} screen={screen} patch={patch} select={select}/></details>
  </div>;
}

function QuestionContent({ d, screen, update, patch, select }) {
  const [removing,setRemoving]=useState(null);
  const choicesRef=useRef(null);
  const closeRemoval=()=>{setRemoving(null);requestAnimationFrame(()=>choicesRef.current?.querySelector('input[aria-label="Answer choice 1"]')?.focus());};
  const q = screen.question;
  const used = value => answerReferences(d,screen.question.id,value).length;
  const write = changes => update({ ...screen, question: { ...q, ...changes } });
  return <div ref={choicesRef} className="cx-question"><Field label="Question"><textarea value={q.label} onChange={e => write({ label: e.target.value })}/></Field><Field label="Answer type"><select value={q.type} onChange={e => write({ type: e.target.value })}><option value="single">Choose one answer</option><option value="multi">Choose several answers</option></select></Field><div className="cx-choices-heading"><strong>Answer choices</strong><small>Labels update every connected path</small></div>{q.options.map((o, i) => <div className="cx-choice" key={o.value}><span>{i + 1}</span><input aria-label={`Answer choice ${i + 1}`} value={o.label} onChange={e => write({ options: q.options.map(item => item.value === o.value ? { ...item, label: e.target.value } : item) })}/><button aria-label={`Remove answer choice ${i + 1}`} disabled={q.options.length <= 2} title={q.options.length<=2?'Keep at least two answers':used(o.value)?'Review uses before removing':'Remove this choice'} onClick={() => used(o.value)?setRemoving(o.value):write({ options: q.options.filter(item => item.value !== o.value) })}><X size={14}/></button></div>)}{removing && q.options.some(o=>o.value===removing) && <AnswerRemoval key={removing} d={d} screen={screen} option={q.options.find(o=>o.value===removing)} patch={patch} select={select} close={closeRemoval}/>}<button className="cx-text-action" onClick={() => write({ options: [...q.options, { value: `choice-${Date.now()}`, label: 'New answer' }] })}><Plus size={14}/>Add answer choice</button><label className="cx-check"><input type="checkbox" checked={q.required !== false} onChange={e => write({ required: e.target.checked })}/>Require an answer before continuing</label>{q.type === 'multi' && <p className="cx-help">Visitors can choose several answers. Show conditions can include every relevant follow-up. Branches choose just one next path.</p>}</div>;
}

function EdgeInspector({ d, edge, patch, reviewChange, select, add }) {
  const from = d.screens.find(s => s.id === edge.source);
  const to = d.screens.find(s => s.id === edge.target);
  const change = changes => patch(old => ({ ...old, edges: old.edges.map(e => e.id === edge.id ? { ...e, ...changes } : e) }));
  const matches = d.edges.filter(e => e.source === edge.source && e.value !== null && !e.skip);
  const priority = matches.findIndex(e => e.id === edge.id);
  const move = direction => patch(old => { const next = [...old.edges]; const at = next.findIndex(e => e.id === edge.id); const other = next.findIndex(e => e.id === matches[priority + direction].id); [next[at], next[other]] = [next[other], next[at]]; return { ...old, edges: next }; });
  return <div className="fp-inspector-content ux-path-editor"><h2>{edge.skip ? 'Skip signup' : edge.value === null ? edgeLabel(d, edge) : 'Choose who takes this path'}</h2><p>After <b>{from.name}</b>, send matching visitors to <b>{to.name}</b>.</p>
    {edge.skip ? <div className="fp-callout">The visitor chooses No thanks. No new contact details are saved.</div> : edge.value === null ? <div className="ux-fallback"><Check size={18}/><div><strong>{matches.length ? 'Everyone else continues here' : 'Everyone continues here'}</strong><p>{matches.length ? 'Checked last, after all answer conditions. This keeps every visitor on a complete path.' : 'There are no answer conditions at this screen.'}</p></div></div> : <><div className="ux-priority"><span><GitBranch size={15}/><b>Check {priority + 1} of {matches.length}</b></span><div><button aria-label="Move condition earlier" disabled={priority === 0} onClick={() => move(-1)}><MoveUp size={14}/></button><button aria-label="Move condition later" disabled={priority === matches.length - 1} onClick={() => move(1)}><MoveDown size={14}/></button></div></div><p className="ux-priority-help">First matching path wins. Put more specific conditions first.</p><RouteRules d={d} edge={edge} change={change}/></>}
    <div className="ux-then"><span>THEN</span><Field label="Go to screen"><select value={edge.target} onChange={e => { const target=e.target.value;reviewChange(old=>({...old,edges:old.edges.map(item=>item.id===edge.id?{...item,target}:item)}),'Reconnect path'); }}>{d.screens.filter(s => s.id === edge.target || validConnection({ ...d, edges: d.edges.filter(e => e.id !== edge.id) }, edge.source, s.id)).map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></Field><button className="ux-text-button" onClick={() => select('screen', to.id)}>Edit {to.name}<ArrowRight size={13}/></button></div>
    <Button variant="outline" size="sm" className="fp-wide" onClick={add}><Plus/>Insert a screen before {to.name}</Button><div className="cx-rule-sentence"><strong>{ruleText(d, edge)}</strong><span>→ {to.name}</span></div><details className="cx-source-editor"><summary>Preview {to.name}</summary><MiniScreen screen={to}/></details>{edge.value !== null && <Button variant="ghost" size="sm" onClick={() => { reviewChange(old => ({ ...old, edges: old.edges.filter(e => e.id !== edge.id) }), 'Remove condition path', ()=>select('screen',from.id)); }}><Trash2/>Remove this condition path</Button>}{edge.value === null && !edge.skip && <small>The default path stays available. Change its destination above.</small>}
  </div>;
}

function DisplayInspector({ d, patch, full }) {
  const write = (key, value) => patch(old => ({ ...old, rules: { ...old.rules, [key]: value } }));
  return <div className="fp-inspector-content"><h2>When this appears</h2><p>Campaign entry conditions apply before the first screen.</p><Field label="Campaign format"><select value={d.rules.type} onChange={e => write('type', e.target.value)}><option value="popup">Popup</option><option value="inline">Inline embed</option></select></Field><Field label="Pages"><select value={d.rules.pages} onChange={e => write('pages', e.target.value)}><option>All pages except checkout</option><option>Product pages</option><option>Blog posts</option></select></Field><Field label="Audience"><select value={d.rules.audience} onChange={e => write('audience', e.target.value)}><option>Everyone</option><option>Signed-out visitors</option><option>Mobile visitors</option></select></Field>{d.rules.type !== 'inline' && <Field label="Open when"><select value={d.rules.trigger} onChange={e => write('trigger', e.target.value)}><option value="delay">After a delay</option><option value="exit">Visitor shows exit intent</option><option value="click">Visitor clicks the launcher</option></select></Field>}{d.rules.type !== 'inline' && d.rules.trigger === 'delay' && <Field label="Open after (seconds)"><input type="number" min="0" max="120" value={d.rules.delay} onChange={e => write('delay', Math.max(0, Math.min(120, Number(e.target.value))))}/></Field>}<Field label="Repeat limit"><select value={d.rules.frequency} onChange={e => write('frequency', e.target.value)}><option>Once per tab session</option><option>Once every 7 days</option><option>Every eligible page</option></select></Field><div className="fp-callout"><Globe size={16}/><p>{d.rules.audience}, on {d.rules.pages.toLowerCase()}, {d.rules.type === 'inline' ? 'at its inline placement' : d.rules.trigger === 'delay' ? `after ${d.rules.delay} seconds` : d.rules.trigger === 'exit' ? 'on exit intent' : 'when the launcher is clicked'}. {d.rules.frequency}. Page exclusions and site limits still apply.</p></div>{full && <Button variant="outline" className="fp-wide" onClick={full}>Open Display rules<ArrowRight/></Button>}<small>Representative controls for this prototype; advanced groups and schedules stay in the full display editor.</small></div>;
}

function DestinationInspector({ d, patch }) {
  const [shared, setShared] = useState(null);
  return <div className="fp-inspector-content"><h2>Where submissions go</h2><p>Select destinations for this campaign. Each receives compatible, explicitly submitted details.</p>{Object.entries(destinations).map(([id, item]) => <div className="fp-destination" key={id}><label><input type="checkbox" checked={d.destinations.includes(id)} onChange={e => patch(old => ({ ...old, destinations: e.target.checked ? [...old.destinations, id] : old.destinations.filter(x => x !== id) }))}/><span><strong>{item.name}</strong><small>{item.target}</small></span></label><p>{item.description}</p>{d.destinations.includes(id) && <div className="wb-destination-binding"><strong>Receives from</strong>{d.screens.filter(s => s.kind === 'capture' && s.channel === item.channel).map(s => <p key={s.id}>{s.name}<small>{item.channel === 'sms' ? 'Phone number + explicit SMS signup' : 'Saved email details'}</small></p>)}{!d.screens.some(s => s.kind === 'capture' && s.channel === item.channel) && <p className="ux-warning">Add a {item.channel} capture screen to use this destination.</p>}<p>{id === 'webhook' ? 'Includes the answers saved with the enquiry.' : 'Question answers remain in WConvert unless this destination supports an explicit mapping.'}</p><label className="fp-field"><span>Sample configuration status</span><select value={d.destinationState?.[id] ?? 'ready'} onChange={e => patch(old => ({ ...old, destinationState: { ...old.destinationState, [id]: e.target.value } }))}><option value="ready">Ready</option><option value="setup">Needs setup</option></select></label></div>}<button onClick={() => setShared(shared === id ? null : id)}><Settings2 size={13}/>Shared destination details</button>{shared === id && <div className="fp-shared"><strong>Used by {item.shared} sample campaigns</strong><p>Provider settings affect shared live use immediately and are outside campaign Undo. A production editor would open the existing shared-settings form here.</p><small>Example details only. No credentials or provider calls.</small></div>}</div>)}<div className="fp-callout"><Send size={16}/><p>{d.destinations.length ? 'Each saved submission starts its handoff immediately. A later optional signup does not repeat the earlier handoff.' : 'Submissions are saved in WConvert only. External destinations are optional.'}</p></div></div>;
}

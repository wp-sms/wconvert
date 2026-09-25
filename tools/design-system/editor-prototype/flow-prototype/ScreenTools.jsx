import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { clone, questionsUpstream, referencesTo, reviewJourney } from './model';
import { RouteRules } from './JourneyExperience';
import { conditionLabel } from '../journey-prototype/model';
const initialCondition = q => ({ match: 'all', clauses: q ? [{ question: q.id, operator: q.type === 'multi' ? 'includes_any' : 'is', values: [q.options[0].value] }] : [] });
export function ShowCondition({ d, screen, update, initiallyOpen=false }) {
  const [open,setOpen]=useState(initiallyOpen);
  const qs = questionsUpstream(d, screen.id).filter(s => s.id !== screen.id);
  if (screen.id === d.entry || screen.kind === 'acknowledgement') return null;
  const next=d.screens.find(s=>s.id===d.edges.find(e=>e.source===screen.id&&e.value===null&&!e.skip)?.target);
  return <details className="wb-show" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary><strong>Show this screen when…</strong><span>{screen.showWhen ? conditionLabel(screen.showWhen, d) : 'To everyone who reaches it'}</span></summary><p className="jt-logic-note">This decides whether this screen appears. It does not choose between different paths.</p><label className="fp-field"><span>Show to</span><select value={screen.showWhen ? 'conditional' : 'everyone'} onChange={e => update({ ...screen, showWhen: e.target.value === 'everyone' ? undefined : initialCondition(qs[0]?.question) })}><option value="everyone">Everyone who reaches this screen</option><option value="conditional" disabled={!qs.length}>Only when answers match</option></select></label>{screen.showWhen && <><RouteRules d={d} edge={{ source: screen.id, condition: screen.showWhen }} excludeSelf change={({ condition }) => update({ ...screen, showWhen: condition })}/><p>If this rule does not match, skip this screen{next ? <> and continue to <b>{next.name}</b></> : <>. Add a next screen so visitors can continue</>}. Other matching follow-ups can still appear.</p></>}{!qs.length && <p>Add an earlier question to make this screen conditional.</p>}</details>;
}
export function ResultsEditor({ d, screen, update, patch, initialOpened=null }) {
  const [opened, setOpened] = useState(initialOpened);
  const results = screen.results ?? [{ id: 'fallback', name: 'Everyone else', title: 'Your recommendation', body: '', products: [] }];
  const write = list => update({ ...screen, results: list });
  const updateResult = (id, changes) => write(results.map(r => r.id === id ? { ...r, ...changes } : r));
  const move = (i, direction) => { const next = [...results]; [next[i], next[i + direction]] = [next[i + direction], next[i]]; write(next); };
  return <section className="wb-results"><ResultAccess d={d} screen={screen} patch={patch}/><h3>Choose a result</h3><p>Check conditions in order. Show the first match, or Everyone else. Visitors see one result.</p>{results.map((r, i) => <div className="wb-result" key={r.id}><button className="wb-result-title" onClick={() => setOpened(opened === r.id ? null : r.id)}><span>{r.condition ? i + 1 : '↳'}</span><strong>{r.name}<small>{r.condition ? conditionLabel(r.condition, d) : 'Everyone else · always available'}</small></strong><span>{opened === r.id ? '−' : '+'}</span></button>{opened === r.id && <div className="wb-result-body"><label className="fp-field"><span>Result name</span><input value={r.name} onChange={e => updateResult(r.id, { name: e.target.value })}/></label><label className="fp-field"><span>Visitor heading</span><input value={r.title} onChange={e => updateResult(r.id, { title: e.target.value })}/></label><label className="fp-field"><span>Message</span><textarea value={r.body ?? ''} onChange={e => updateResult(r.id, { body: e.target.value })}/></label>{d.products?.length > 0 && <fieldset className="wb-products"><legend>Recommended products</legend>{d.products.map(product => <label key={product.id}><input type="checkbox" checked={(r.product_ids ?? []).includes(product.id)} onChange={e => updateResult(r.id, { product_ids: e.target.checked ? [...(r.product_ids ?? []), product.id] : r.product_ids.filter(id => id !== product.id) })}/><span>{product.name}<small>{product.detail}</small></span></label>)}</fieldset>}{r.condition && <><RouteRules d={d} edge={{ source: screen.id, condition: r.condition }} change={({ condition }) => updateResult(r.id, { condition })}/><div className="wb-actions"><Button variant="outline" size="sm" aria-label={`Move ${r.name} earlier`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp/></Button><Button variant="outline" size="sm" aria-label={`Move ${r.name} later`} disabled={!results[i + 1]?.condition} onClick={() => move(i, 1)}><ArrowDown/></Button><Button variant="ghost" size="sm" onClick={() => write(results.filter(item => item.id !== r.id))}><Trash2/>Remove result</Button></div></>}</div>}</div>)}<Button variant="outline" size="sm" onClick={() => { const id = `result-${Date.now()}`; write([...results.filter(r => r.condition), { id, name: 'New result', title: 'Your recommendation', body: '', products: [], condition: initialCondition(questionsUpstream(d, screen.id)[0]?.question) }, ...results.filter(r => !r.condition)]); setOpened(id); }}><Plus/>Add conditional result</Button></section>;
}
export function ScreenActions({ d, screen, patch, select }) {
  const [confirm, setConfirm] = useState(false), [moveAfter, setMoveAfter] = useState(''), [error, setError] = useState('');
  const outgoing = d.edges.filter(e => e.source === screen.id), incoming = d.edges.filter(e => e.target === screen.id);
  const continuation = outgoing.find(e => e.value === null && !e.skip);
  const references = referencesTo(d, screen.question?.id).filter(ref => !(ref.kind === 'edge' && outgoing.some(e => e.id === ref.id)) && ref.id !== screen.id);
  const removable = screen.id !== d.entry && !references.length && outgoing.length <= 1 && !!continuation;
  const duplicate = () => {
    const copy = clone(screen), id = `copy-${Date.now()}`; copy.id = id; copy.name += ' copy'; if (copy.question) copy.question.id = id;
    patch(old => ({ ...old, screens: [...old.screens, copy], edges: continuation ? [...old.edges.map(e => e.id === continuation.id ? { ...e, target: id } : e), { id: `${id}-next`, source: id, target: continuation.target, value: null }] : old.edges })); select('screen', id);
  };
  const remove = old => ({ ...old, screens: old.screens.filter(s => s.id !== screen.id), edges: old.edges.filter(e => e.source !== screen.id).map(e => e.target === screen.id ? { ...e, target: continuation.target } : e) });
  const movable = removable && incoming.length === 1 && !screen.showWhen;
  const targets = movable ? d.screens.filter(s => s.id !== screen.id && s.id !== incoming[0].source && d.edges.filter(e => e.source === s.id).length === 1 && d.edges.some(e => e.source === s.id && e.value === null && !e.skip)) : [];
  const move = () => {
    const detached = remove(d), after = detached.edges.find(e => e.source === moveAfter);
    if (!after) return;
    const next = { ...detached, screens: d.screens, edges: [...detached.edges.map(e => e.id === after.id ? { ...e, target: screen.id } : e), { ...continuation, target: after.target }] };
    const issues = reviewJourney(next).filter(i => i.severity === 'error');
    if (issues.some(issue => !reviewJourney(d).some(old => old.severity === 'error' && old.text === issue.text))) { setError('This move would put an answer condition before its question. Choose another position.'); return; }
    patch(() => next); setError(''); setMoveAfter('');
  };
  return <div className="wb-screen-actions"><Button variant="outline" size="sm" disabled={!continuation || screen.kind === 'capture' || screen.kind === 'result' || outgoing.length > 1} onClick={duplicate}><Copy/>Duplicate after this screen</Button>{(screen.kind === 'capture' || screen.kind === 'result' || outgoing.length > 1) && <small>For capture, results or branching screens, add a new screen and choose its connections explicitly.</small>}{targets.length > 0 && <><label className="fp-field"><span>Move after</span><select value={moveAfter} onChange={e => setMoveAfter(e.target.value)}><option value="">Choose a screen…</option>{targets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><Button variant="outline" size="sm" disabled={!moveAfter} onClick={move}>Move screen</Button>{error && <p role="alert">{error}</p>}</>}{screen.id !== d.entry && <><Button variant="ghost" size="sm" disabled={!removable} onClick={() => setConfirm(!confirm)}><Trash2/>Remove screen</Button>{references.length > 0 ? <p>Update these answer references before removing:<br/>{references.map(ref => <button className="ux-text-button" key={`${ref.kind}-${ref.id}`} onClick={() => select(ref.kind, ref.id)}>{ref.name}</button>)}</p> : !removable ? <small>Reconnect incoming paths before removing an ending or branching screen.</small> : confirm && <div className="wb-remove-confirm"><p>{incoming.length} incoming path{incoming.length === 1 ? '' : 's'} will continue to <b>{d.screens.find(s => s.id === continuation.target)?.name}</b>. {screen.kind==='capture'?'Visitors will no longer submit details on this screen.':'This screen and its show condition will be removed.'} Undo can restore them.</p><Button variant="outline" size="sm" onClick={() => { patch(remove); select('screen', continuation.target); }}>Remove & reconnect</Button></div>}</>}</div>;
}

function ResultAccess({ d, screen, patch }) {
  const capture = d.screens.find(s => s.kind === 'capture');
  if (!capture || d.screens.filter(s => s.kind === 'capture').length !== 1 || d.id !== 'coffee') return null;
  const required = d.edges.some(e => e.source === capture.id && e.target === screen.id);
  const change = nextRequired => patch(old => {
    const ending = old.screens.find(s => s.kind === 'acknowledgement');
    const boundary = required ? capture.id : screen.id;
    const edges = old.edges.filter(e => e.source !== capture.id && e.source !== screen.id).map(e => e.target === boundary ? { ...e, target: nextRequired ? capture.id : screen.id } : e);
    edges.push({ id: 'result-capture', source: nextRequired ? capture.id : screen.id, target: nextRequired ? screen.id : capture.id, value: null }, { id: 'result-ending', source: nextRequired ? screen.id : capture.id, target: ending.id, value: null });
    if (!nextRequired) edges.push({ id: 'email-skip', source: capture.id, target: ending.id, value: null, skip: true });
    return { ...old, edges, screens: old.screens.map(s => s.id === capture.id ? { ...s, optional: !nextRequired, name: nextRequired ? 'Email to see your match' : 'Optional email signup', heading: nextRequired ? 'Enter your email to see your match' : 'More good coffee in your inbox?', body: nextRequired ? 'Submit your email to continue to your coffee recommendation.' : 'Your match is already available. Signup is optional.' } : s) };
  });
  return <div className="wb-result-access"><label className="fp-field"><span>When can visitors see their result?</span><select value={required ? 'before' : 'after'} onChange={e => change(e.target.value === 'before')}><option value="after">Before signup · signup is optional</option><option value="before">After a required email submission</option></select></label><p>Updates the connected screens together. Preview both experiences to decide what suits your offer.</p></div>;
}

// Prototype routing controller around the shipping visitor renderer. No loader/capture calls.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { render } from '@renderer/render';
import { mountedStyles } from '@renderer/css';
import { registerPremiumJourneyRenderer } from '../../../../pro/modules/journeys/loader/render';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, RotateCcw, Send } from 'lucide-react';
import { destinations, resolveNext, matches, edgeCondition } from './model';
import { signature, behaviorSignature } from './CampaignWorkflow';
import { resultFor } from '../journey-prototype/model';
import { answerAfterEdit, fixedAnswer, relevantState } from './visitorState';
registerPremiumJourneyRenderer();
const EMPTY = {};

export function RendererScreen({ d, screen, answers = {}, submitted = false, answerLocked = false, savedFields = EMPTY, productState = 'selected', contactDraft = EMPTY, templateOverride, onAction }) {
  const anchor = useRef(null);
  const [ready, setReady] = useState(false);
  const action = useRef(onAction); action.current = onAction;
  const template = useMemo(() => templateOverride ?? ({ tokens: { bg: '#fffdf8', fg: '#22322d', accent: d.accent || '#38674a', 'accent-fg': '#ffffff', padding: '28px', width: '420px', radius: '12px', gap: '16px' }, tree: { v: 2, submissions: [], steps: [{ id: screen.id, name: screen.name, kind: screen.kind === 'acknowledgement' ? 'acknowledgement' : 'input', content: { type: 'stack', children: [
    { type: 'text', text: d.business },
    ...(screen.id === d.entry && d.edges.some(e => d.screens.find(s => s.id === e.source)?.kind === 'capture' && d.screens.find(s => s.id === e.target)?.kind === 'result') ? [{ type: 'text', text: 'Answer a few questions, then enter your email to see your recommendation.' }] : []),
    ...(screen.question && answerLocked ? [{type:'text',text:'This answer is part of your submitted request. You can review it, but it cannot be changed.'}] : []),
    ...(screen.question ? [{ ...screen.question, type: 'question', answer_type: screen.question.type }] : [{ type: 'heading', text: screen.kind === 'result' ? resultFor(screen, answers)?.title ?? 'Your result' : screen.heading ?? screen.name, level: '2', size: 'xl' }, { type: 'text', text: screen.kind === 'result' ? resultFor(screen, answers)?.body ?? '' : screen.body ?? '' }]),
    ...(screen.kind === 'result' ? [{ type: 'text', text: productState === 'empty' ? 'No selected products are available. Browse the shop for alternatives.' : productState === 'error' ? 'Products could not load. You can still browse the shop.' : (resultFor(screen, answers)?.product_ids ?? []).map(id => d.products?.find(p => p.id === id)?.name ?? `Product ${id}`).join(' · ') }, { type: 'button', action: 'link', href: '#sample-shop', label: 'Browse the shop' }] : []),
    ...(screen.kind === 'capture' && screen.reviewAnswers ? [{type:'heading',text:'Your enquiry',level:'3'},...d.screens.filter(s=>s.question && answers[s.question.id] !== undefined).map(s=>({type:'text',text:`${s.question.label}\n${s.question.options.filter(o=>Array.isArray(answers[s.question.id])?answers[s.question.id].includes(o.value):answers[s.question.id]===o.value).map(o=>o.label).join(', ')}`}))] : []),
    ...(screen.kind === 'capture' ? submitted ? [{ type: 'text', text: 'These details have already been submitted. Continuing will not submit them again.' },...Object.entries(savedFields).map(([name,value])=>({type:'text',text:`${name === 'email' ? 'Email address' : name === 'phone' ? 'Phone number' : 'Name'}: ${value}`}))] : (screen.fields ?? [screen.channel === 'sms' ? 'phone' : 'email']).map(field => ({type:'field',name:field,label:field === 'name' ? 'Your name (optional)' : field === 'phone' ? 'Phone number' : 'Email address',required:field !== 'name',placeholder:field === 'email' ? 'you@example.com' : field === 'name' ? 'Your name' : '+1 202 555 0100'})) : []),
    ...(screen.kind === 'capture' && screen.privacyNote ? [{type:'text',text:screen.privacyNote,size:'sm'}] : []),
    ...(screen.kind === 'acknowledgement' ? [] : [{ type: 'button', label: submitted ? 'Continue' : screen.button ?? 'Continue', action: 'next' }]),
    ...(d.edges.some(e => e.source === screen.id && e.skip) && !submitted ? [{ type: 'button', label: 'No thanks', action: 'skip' }] : [])
  ] } }] } }), [d, screen, answers, submitted, answerLocked, savedFields, productState, templateOverride]);
  useEffect(() => {
    const frame = anchor.current, doc = frame?.contentDocument;
    if (!ready || !doc?.body) return;
    const style = doc.createElement('style'); style.textContent = mountedStyles() + 'body{margin:0;background:transparent}.wc-root{max-block-size:none;box-shadow:none}';
    const root = render(template.tree, template.tokens, 0);
    doc.body.replaceChildren(style, root);
    const observer = new ResizeObserver(() => { frame.style.height = `${Math.ceil(root.getBoundingClientRect().height) + 2}px`; }); observer.observe(root);
    for (const input of root.querySelectorAll('[data-question-id]')) { const value = answers[input.dataset.questionId]; input.checked = Array.isArray(value) ? value.includes(input.value) : value === input.value; input.disabled = answerLocked; }
    // Only fictional sample contact details; the renderer has no submission handler here.
    for (const input of root.querySelectorAll('input')) if (!input.dataset.questionId) input.value = contactDraft[input.name] ?? (input.name === 'email' ? 'visitor@example.com' : input.name === 'phone' ? '+12025550100' : input.name === 'name' ? 'Alex Example' : '');
    const readDraft = () => {
      const inputs = [...root.querySelectorAll('[data-question-id]')];
      const value = screen.question?.type === 'multi' ? inputs.filter(i=>i.checked).map(i=>i.value) : inputs.find(i=>i.checked)?.value;
      const fields = Object.fromEntries([...root.querySelectorAll('input')].filter(i=>!i.dataset.questionId&&i.name).map(i=>[i.name,i.value]));
      return {value,fields};
    };
    const remember = () => { const {value,fields}=readDraft();action.current?.('draft',value,fields); };
    root.addEventListener('input',remember);root.addEventListener('change',remember);remember();
    const advance = e => {
      const button = e.target.closest('button[data-action],a'); if (!button) return;
      e.preventDefault(); const type = button.dataset.action;
      if (!['next', 'submit', 'skip'].includes(type)) return;
      const {value,fields}=readDraft();
      if(type!=='skip') {
        if(screen.question && screen.question.required!==false && !value?.length){action.current?.('invalid');return;}
        if(typeof root.reportValidity==='function'&&!root.reportValidity())return;
      }
      action.current?.(type,value,fields);
    };
    root.addEventListener('click', advance); root.addEventListener('submit', e => e.preventDefault());
    return () => { observer.disconnect(); doc.body.replaceChildren(); };
  }, [template, ready]);
  return <iframe className="wb-renderer" title={`Visitor preview: ${screen.name}`} ref={anchor} srcDoc="<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body></body></html>" onLoad={() => setReady(true)}/>;
}

export function PreviewAndTest({ d, done, edit, initialCase, onComplete }) {
  const [trail, setTrail] = useState([{ id: d.entry, answers: {}, edges: [], skipped: [] }]);
  const [answers, setAnswers] = useState(initialCase ? {project:initialCase.interests} : {});
  const [failureMode, setFailureMode] = useState('success');
  const [contactDraft, setContactDraft] = useState({});
  const liveDraft=useRef(null);
  const [captureChoices,setCaptureChoices]=useState({});
  const complete = useRef(onComplete); complete.current = onComplete;
  const [ledger, setLedger] = useState([]);
  const [message, setMessage] = useState('');
  const [productState, setProductState] = useState('selected');
  const current = trail.at(-1), originalScreen = d.screens.find(s => s.id === current.id);
  const screen = originalScreen.kind === 'acknowledgement' && !ledger.length ? { ...originalScreen, heading: 'You’re all set', body: 'Thanks for exploring. No signup details were submitted.' } : originalScreen;
  const accepted=ledger.find(item=>item.id===screen.id);
  const submitted=Boolean(accepted);
  const locked=screen.question?fixedAnswer(ledger,screen.question.id).locked:false;
  const questionIds=trail.map(t=>d.screens.find(s=>s.id===t.id)?.question?.id).filter(Boolean);
  const captureAnswers=useMemo(()=>Object.fromEntries(Object.entries(answers).filter(([id])=>trail.some(t=>d.screens.find(s=>s.id===t.id)?.question?.id===id))),[answers,trail,d]);
  const advance = (type, value, fields = {}) => {
    if(type==='draft'){liveDraft.current={id:screen.id,value,fields};return;}
    if (type === 'invalid') { setMessage('Choose at least one answer to continue.'); return; }
    if (screen.kind === 'capture' && type !== 'skip' && !submitted && failureMode === 'capture-error') { setContactDraft(old=>({...old,[screen.id]:fields})); setMessage('The sample save failed. Your details and answers are still here. Choose Save succeeds in the test controls, then try again.'); return; }
    const choices=screen.kind==='capture'?{...captureChoices,[screen.id]:type==='skip'?'skip':'submit'}:captureChoices;
    const nextAnswers=answerAfterEdit(d,answers,screen,value,ledger,choices);
    const cleared=d.screens.filter(s=>s.question&&Object.hasOwn(answers,s.question.id)&&!Object.hasOwn(nextAnswers,s.question.id)&&s.id!==screen.id);
    if(screen.kind==='capture'&&!submitted)setContactDraft(old=>({...old,[screen.id]:type==='skip'?Object.fromEntries(Object.keys(fields).map(key=>[key,''])):fields}));
    const next = resolveNext(d, screen.id, nextAnswers, type === 'skip');
    if (!next.target) { setMessage('This path needs a next screen. Use Edit this screen to connect it.'); return; }
    if (screen.kind === 'capture' && type !== 'skip' && !submitted) setLedger(old => [...old, { id: screen.id, name: screen.name, answers: structuredClone(Object.fromEntries(Object.entries(nextAnswers).filter(([id])=>questionIds.includes(id)))), questionIds, fields: structuredClone(fields), delivery: failureMode === 'delivery-error' ? 'retry' : 'queued', names: d.destinations.filter(id => destinations[id].channel === screen.channel).map(id => destinations[id].name) }]);
    const matchesCount = d.edges.filter(e => e.source === screen.id && e.value !== null && !e.skip && matches(edgeCondition(d, e), nextAnswers)).length;
    setCaptureChoices(choices);
    if(screen.question){const active=relevantState(d,nextAnswers,choices).screens;setContactDraft(old=>Object.fromEntries(Object.entries(old).filter(([id])=>active.includes(id))));}
    setAnswers(nextAnswers); setTrail(old => [...old, { ...next, id: next.target, answers: nextAnswers, reason: `${next.reason}${matchesCount > 1 ? ` · ${matchesCount} paths matched; the first won` : ''}` }]);
    setMessage(type === 'skip' ? 'Signup skipped. No new details were submitted.' : cleared.length ? `Removed answers that no longer apply: ${cleared.map(s=>s.name).join(', ')}. Other answers are kept.` : '');
  };
  useEffect(() => { if (originalScreen.kind === 'acknowledgement') complete.current?.({version:signature(d),behavior:behaviorSignature(d),answers:structuredClone(answers),submissions:structuredClone(ledger),path:trail.map(item=>item.id)}); }, [current.id, answers, ledger]);
  const back = () => {
    const draft=liveDraft.current?.id===screen.id?liveDraft.current:null;
    if(draft){setAnswers(answerAfterEdit(d,answers,screen,draft.value,ledger,captureChoices));if(screen.kind==='capture'&&!submitted)setContactDraft(old=>({...old,[screen.id]:draft.fields}));}
    setTrail(old=>old.slice(0,-1));
    setMessage('Your answers are kept. Changing a choice removes only answers that no longer apply. Submitted details stay read-only.');
  };
  const reset = () => { setTrail([{ id: d.entry, answers: {}, edges: [], skipped: [] }]); setAnswers({}); setLedger([]);setCaptureChoices({}); setMessage(''); setContactDraft({}); setFailureMode('success'); setProductState('selected');liveDraft.current=null; };
  return <div className="wb-test"><div className="wb-visitor"><div className="wb-preview-heading"><span>VISITOR VIEW</span><span>{screen.name}</span></div><RendererScreen d={d} screen={screen} answers={accepted?.answers??(screen.kind==='capture'?captureAnswers:answers)} submitted={submitted} answerLocked={locked} savedFields={accepted?.fields} productState={productState} contactDraft={contactDraft[screen.id]} onAction={advance}/><div className="wb-visitor-tools"><Button variant="outline" disabled={trail.length === 1} onClick={back}><ArrowLeft/>Back</Button><button onClick={() => edit('screen', screen.id)}>Edit this screen<ArrowRight size={13}/></button></div>{message && <p className="wb-status" role="status">{message}</p>}{screen.kind === 'acknowledgement' && <p className="wb-status">Journey complete. Try another answer combination or review the path.</p>}</div><aside className="wb-test-side"><h3>Why this path?</h3><ol>{trail.map((item, i) => <React.Fragment key={`${item.id}-${i}`}>{item.skipped.map(skipped => <li className="wb-skipped" key={skipped.id}><strong>{d.screens.find(s => s.id === skipped.id)?.name}</strong><small>Skipped: {skipped.reason} did not match.</small><button onClick={() => edit('screen', skipped.id, 'visibility')}>Edit show condition</button></li>)}<li aria-current={i === trail.length - 1 ? 'step' : undefined}><strong>{d.screens.find(s => s.id === item.id)?.name}</strong><small>{item.reason ?? 'Display rules allow this visitor to start'}</small></li></React.Fragment>)}</ol>{screen.kind === 'result' && <label className="fp-field"><span>Test product availability</span><select value={productState} onChange={e => setProductState(e.target.value)}><option value="selected">Products available</option><option value="empty">None available</option><option value="error">Loading failed</option></select></label>}{screen.kind === 'capture' && !submitted && <label className="fp-field"><span>Simulate submission outcome</span><select value={failureMode} onChange={e=>setFailureMode(e.target.value)}><option value="success">Save succeeds</option><option value="capture-error">Save fails · visitor retries</option><option value="delivery-error">Save succeeds · destination retries</option></select></label>}<h3><Send size={14}/>Simulated submissions</h3>{ledger.length ? ledger.map(item => <div className="wb-ledger" key={item.id}><b>{item.name}</b><span>{item.names.join(' + ') || 'WConvert only'}</span><small>Saved once · retained when going Back</small><small>{item.names.length ? item.delivery === 'retry' ? 'Destination failed · retry pending. The enquiry is saved.' : 'Queued for destination · delivery not confirmed' : 'Stored in WConvert'}</small><details><summary>Inspect saved submission</summary>{Object.entries(item.fields).map(([name,value])=><span key={name}>{name}: {value}</span>)}{d.screens.filter(s=>s.question && item.answers[s.question.id] !== undefined).map(s=><span key={s.id}>{s.name}: {s.question.options.filter(o=>Array.isArray(item.answers[s.question.id])?item.answers[s.question.id].includes(o.value):item.answers[s.question.id]===o.value).map(o=>o.label).join(', ')}</span>)}</details></div>) : <p>No details submitted yet.</p>}<Button variant="outline" onClick={() => done(trail.map(t => t.id), trail.flatMap(t => t.edges))}>Show this path on map<ArrowRight/></Button><Button variant="ghost" onClick={reset}><RotateCcw/>Restart test</Button><small>Real screen renderer, sample routing. No leads, analytics or provider requests.</small></aside></div>;
}

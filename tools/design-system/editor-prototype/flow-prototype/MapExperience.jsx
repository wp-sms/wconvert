// THROWAWAY: presentation groups never change the visitor journey model.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { sampleJourney } from './model';

// Collapse only uninterrupted runs. Shared entry/exit screens stay outside the group.
export function followupGroups(d) {
  const eligible = s => s?.showWhen && ['question','content'].includes(s.kind) && d.edges.filter(e=>e.source===s.id).length===1 && d.edges.some(e=>e.source===s.id && e.value===null && !e.skip);
  const used = new Set(), groups=[];
  const starts = d.screens.filter(eligible).filter(s=>{
    const incoming=d.edges.filter(e=>e.target===s.id);
    return incoming.length!==1 || !eligible(d.screens.find(p=>p.id===incoming[0].source));
  });
  for (const start of starts) {
    const members=[]; let s=start;
    while(eligible(s)&&!used.has(s.id)) {
      used.add(s.id); members.push(s);
      const edge=d.edges.find(e=>e.source===s.id);
      const next=d.screens.find(n=>n.id===edge.target);
      if(d.edges.filter(e=>e.target===next?.id).length!==1) break;
      s=next;
    }
    if(members.length>1) groups.push({id:`followups:${start.id}`,members});
  }
  return groups;
}

export function SampleExplorer({d, trace, select}) {
  const [answers,setAnswers]=useState(()=>Object.fromEntries(d.screens.filter(s=>s.question).map(s=>[s.question.id,s.question.type==='multi'?[s.question.options[0]?.value]:s.question.options[0]?.value])));
  const [captures,setCaptures]=useState({});
  const result=useMemo(()=>sampleJourney(d,answers,Object.fromEntries(d.screens.filter(s=>s.kind==='capture').map(s=>[s.id,captures[s.id]??'submit']))),[d,answers,captures]);
  useEffect(()=>{trace(result.screens,result.edges);},[result]);
  const choose=(q,value)=>setAnswers(old=>({...old,[q.id]:q.type==='multi'?(old[q.id]?.includes(value)?old[q.id].filter(v=>v!==value):[...(Array.isArray(old[q.id])?old[q.id]:[]),value]):value}));
  return <div className="fp-inspector-content mx-sample"><h2>Try a visitor’s answers</h2><p>Change the sample answers to see the path update. First choices are prefilled; submissions are simulated.</p>
    {result.screens.map(id=>d.screens.find(s=>s.id===id)).filter(s=>s.question).map(s=><fieldset key={s.id}><legend>{s.question.label}</legend>{s.question.type==='multi' && <small>Choose one or more</small>}{s.question.options.map(o=><label key={o.value}><input type={s.question.type==='multi'?'checkbox':'radio'} name={`sample-${s.id}`} checked={s.question.type==='multi'?(answers[s.question.id]??[]).includes(o.value):answers[s.question.id]===o.value} onChange={()=>choose(s.question,o.value)}/>{o.label}</label>)}{s.question.required===false && <button className="mx-skip-answer" onClick={()=>setAnswers(old=>({...old,[s.question.id]:'__unanswered__'}))}>Leave this optional question unanswered</button>}</fieldset>)}
    <h3>This visitor’s path</h3><ol className="mx-sample-path">{result.screens.map((id,i)=>{const s=d.screens.find(s=>s.id===id);return <li key={id}><button onClick={()=>select('screen',id)}><span>{i+1}</span>{s.name}<ArrowRight size={12}/></button>{s.kind==='capture' && <label className="mx-capture-choice">Sample action<select value={captures[id]??'submit'} onChange={e=>setCaptures(old=>({...old,[id]:e.target.value}))}><option value="submit">Submit details</option>{s.optional && <option value="skip">No thanks</option>}</select></label>}</li>;})}</ol>
    {result.waiting && <p className="mx-sample-notice">Waiting for an answer to {d.screens.find(s=>s.id===result.waiting)?.name}.</p>}
    {result.blocked && <p className="mx-sample-notice">This path cannot continue. Check the connections on {d.screens.find(s=>s.id===result.blocked)?.name}.</p>}
    {result.skipped.length>0 && <div className="mx-skipped"><h3>Skipped for these answers</h3>{result.skipped.map(s=><p key={s.id}><b>{d.screens.find(n=>n.id===s.id)?.name}</b><small>Show condition did not match: {s.reason}</small></p>)}</div>}
    {result.decisions.filter(x=>d.edges.filter(e=>e.source===x.source&&!e.skip).length>1).map(x=><p className="mx-sample-notice" key={x.source}><b>{d.screens.find(s=>s.id===x.source)?.name}: </b>{x.reason}. {x.alsoMatches>0?`${x.alsoMatches} later matching path ignored because the first match wins.`:'First matching path wins; otherwise use Everyone else.'}</p>)}
    <div className="mx-outcome"><b>{result.handoffs.length} simulated submission{result.handoffs.length===1?'':'s'}</b><p>{result.complete&&result.handoffs.length===1?'One submission with answers from the questions this visitor saw.':result.complete?'This sample reached an ending.':'Complete the highlighted path to see its outcome.'}</p><small>No details are saved or sent. Use Preview for the full visitor experience.</small></div>
  </div>;
}

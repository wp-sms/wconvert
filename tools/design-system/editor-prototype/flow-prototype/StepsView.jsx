// THROWAWAY: accessible list and map share the same journey and inspector.
import React, { useRef, useState } from 'react';
import { ArrowRight, Eye } from 'lucide-react';

// Place shared screens after every predecessor, without implying a single visitor path.
export function orderedScreens(d) {
  const remaining = new Set(d.screens.map(s => s.id)), result = [];
  while (remaining.size) {
    const ready = d.screens.filter(s => remaining.has(s.id) && !d.edges.some(e => e.target === s.id && remaining.has(e.source)));
    if (!ready.length) { result.push(...d.screens.filter(s=>remaining.has(s.id))); break; }
    for (const s of ready) { remaining.delete(s.id); result.push(s); }
  }
  return result;
}
const labels = {question:'Question',capture:'Collect details',content:'Message',result:'Results',acknowledgement:'Ending'};
export function StepsView({ d, selected, select, preview, visited, onMap }) {
  const [query,setQuery] = useState('');
  const list = useRef(null);
  const screens = orderedScreens(d).filter(s=>`${s.name} ${s.question?.label??''}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="jt-steps mx-navigator" aria-label="Screen navigator" ref={list}>
    <div className="jt-steps-heading"><div><h2>Screens</h2><p>Find and edit a screen. This is an inventory, not a visitor’s path.</p></div><input aria-label="Search screens" placeholder="Find a screen…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <button className="mx-back-map" onClick={onMap}>See connections on the journey map <ArrowRight size={14}/></button>
    {!screens.length && <p className="jt-empty">No screens match “{query}”. Try another name.</p>}
    <ul className="jt-step-list">{screens.map(s=><li key={s.id} className={`${selected.id===s.id?'is-selected':''} ${visited.includes(s.id)?'is-traced':''}`}>
      <div className="jt-step-main"><button className="jt-step-select" aria-current={selected.id===s.id?'true':undefined} onClick={()=>select('screen',s.id)}><small>{s.id===d.entry?'First screen · ':''}{labels[s.kind]}{s.showWhen?' · Conditional':''}</small><strong>{s.name}</strong></button><button className="jt-icon" aria-label={`Preview ${s.name}`} onClick={()=>preview(s.id)}><Eye size={16}/></button></div>
    </li>)}</ul>
  </section>;
}

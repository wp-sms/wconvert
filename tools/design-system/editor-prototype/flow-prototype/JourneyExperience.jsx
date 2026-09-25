// THROWAWAY: task-focused controls around the journey canvas.
import React from 'react';
import { ArrowRight, Check, CircleHelp, GitBranch, Plus, Send, X, Play, RotateCcw } from 'lucide-react';
import { edgeCondition, edgeLabel, questionsUpstream, ruleText } from './model';
import { conditionLabel } from '../journey-prototype/model';

export function ArrivalSummary({ d, screen, select }) {
  const incoming = d.edges.filter(e => e.target === screen.id);
  return <details className="ux-arrival" open={undefined}>
    <summary><GitBranch size={14}/><span>Who reaches this screen?<small>{screen.id === d.entry ? 'Every visitor who opens this campaign' : screen.showWhen ? conditionLabel(screen.showWhen, d) : incoming.length === 1 ? ruleText(d, incoming[0]) : `${incoming.length} incoming paths · review conditions`}</small></span></summary>
    {screen.id === d.entry ? <p>Display rules decide who can open the campaign. This is their first screen.</p> : incoming.length ? incoming.map(e => <button key={e.id} onClick={() => select('edge', e.id)}><span><b>From {d.screens.find(s => s.id === e.source)?.name}</b><small>{ruleText(d, e)}</small></span><ArrowRight size={14}/></button>) : <p>No visitors can reach this screen yet. Connect an incoming path.</p>}
    {incoming.length > 0 && <p>These are the immediate entry rules. Earlier choices still determine whether a visitor reaches the source screen.</p>}
  </details>;
}

export function RouteRules({ d, edge, change, excludeSelf = false }) {
  const condition = edgeCondition(d, edge);
  const choices = questionsUpstream(d, edge.source).filter(s => !excludeSelf || s.id !== edge.source);
  const write = next => change({ condition: next, question: next.clauses[0]?.question, value: next.clauses[0]?.values[0] ?? '__choose__' });
  const clause = (index, changes) => write({ ...condition, clauses: condition.clauses.map((c, i) => i === index ? { ...c, ...changes } : c) });
  return <div className="ux-rules"><div className="ux-rule-intro"><span>WHEN</span><select aria-label="Combine conditions" value={condition.match} onChange={e => write({ ...condition, match: e.target.value })}><option value="all">All conditions match</option><option value="any">Any condition matches</option></select></div>
    {condition.clauses.map((c, i) => { const q = d.screens.find(s => s.question?.id === c.question)?.question; return <React.Fragment key={i}>{i > 0 && <div className="ux-rule-join">{condition.match === 'all' ? 'AND' : 'OR'}</div>}<div className="ux-rule-clause"><div><label>Question<select aria-label={`Condition ${i + 1} question`} value={c.question ?? ''} onChange={e => { const next = choices.find(s => s.question.id === e.target.value).question; clause(i, { question: next.id, values: [next.options[0].value] }); }}><option disabled value="">Choose a question</option>{choices.map(s => <option key={s.id} value={s.question.id}>{s.name} · {s.question.label}</option>)}</select></label>{condition.clauses.length > 1 && <button aria-label={`Remove condition ${i + 1}`} onClick={() => write({ ...condition, clauses: condition.clauses.filter((_, index) => i !== index) })}><X size={14}/></button>}</div>
    <label>Answer<select aria-label={`Condition ${i + 1} comparison`} value={c.operator} onChange={e => clause(i, { operator: e.target.value })}><option value="includes_any">Includes any of</option><option value="includes_none">Includes none of</option><option value="is">Is</option><option value="is_not">Is not</option></select></label>
    <div className="ux-rule-values" role="group" aria-label={`Condition ${i + 1} answers`}>{q?.options?.map(o => <label key={o.value}><input type="checkbox" checked={c.values.includes(o.value)} onChange={e => clause(i, { values: e.target.checked ? [...c.values, o.value] : c.values.filter(v => v !== o.value) })}/>{o.label}</label>)}</div>{!c.values.length && <p className="ux-warning">Choose at least one answer.</p>}</div></React.Fragment>; })}
    <button className="ux-text-button" disabled={!choices.length} onClick={() => { const q = choices[0].question; write({ ...condition, clauses: [...condition.clauses, { question: q.id, operator: q.type === 'multi' ? 'includes_any' : 'is', values: [q.options[0].value] }] }); }}><Plus size={14}/>Add condition</button><p className="ux-rule-help">An unanswered question never matches, including “is not”. Only questions reachable before this screen are available.</p>
  </div>;
}

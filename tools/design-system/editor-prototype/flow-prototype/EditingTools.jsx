import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { answerReferences, replaceAnswer } from './editing';

export function AnswerRemoval({d,screen,option,patch,select,close}) {
  const [replacement,setReplacement]=useState('');
  const refs=answerReferences(d,screen.question.id,option.value);
  return <div className="er-answer-removal" role="region" aria-label={`Remove ${option.label}`}>
    <strong>“{option.label}” is used in {refs.length} place{refs.length===1?'':'s'}</strong>
    <p>Update these conditions individually, or choose another answer to replace every use before removing this choice.</p>
    <div className="er-reference-links">{refs.map((ref,i)=><button key={i} onClick={()=>select(ref.kind,ref.id,ref.section)}>{ref.name} →</button>)}</div>
    <label className="fp-field"><span>Replace its uses with</span><select value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">Choose an existing answer…</option>{screen.question.options.filter(o=>o.value!==option.value).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
    {replacement && <p className="er-impact-note">Conditions that used “{option.label}” will use “{screen.question.options.find(o=>o.value===replacement)?.label}”. Branch priority stays the same; preview the changed paths.</p>}
    <div className="er-actions"><Button variant="outline" size="sm" disabled={!replacement} onClick={()=>{patch(old=>replaceAnswer(old,screen.question.id,option.value,replacement),{label:`Replace and remove ${option.label}`});close();}}>Replace uses & remove</Button><Button variant="ghost" size="sm" onClick={close}>Cancel</Button></div>
    <small>One change. Undo restores the answer and all its references.</small>
  </div>;
}

export function ImpactSummary({impact}) {
  return <div className="er-impact-summary">
    {impact.disconnected.length>0 && <><h3>{impact.disconnected.length} screen{impact.disconnected.length===1?' becomes':'s become'} unreachable</h3><p>These screens stay in your draft, but no path from the start reaches them.</p><ul>{impact.disconnected.map(s=><li key={s.id}>{s.name}{s.kind==='capture'?' · submissions here will stop':''}</li>)}</ul></>}
    {impact.removed.some(s=>s.kind==='capture') && <p>This removes a submission screen. Visitors will no longer submit details there.</p>}
    {impact.errors.length>0 && <><h3>New issues to resolve before publishing</h3><ul>{impact.errors.map((issue,i)=><li key={i}>{issue.text}</li>)}</ul></>}
    <p>Undo can restore this change. Use Try answers to check the affected journey.</p>
  </div>;
}

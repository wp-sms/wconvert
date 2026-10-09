// Exact current screen manager, isolated fixture state. This is not variant A.
import React, { useState } from 'react';
import { JourneyEditor } from '@/builder/JourneyEditor';
import { referencedJourney } from '@/builder/structure/journey';
import '@/builder/editor.css';
import { Button } from '@/components/ui/button';
import { seed, clone } from './model';
import { RendererScreen } from './PreviewAndTest';

const fixture = seed('interests');
const tokens = { bg:'#fffdf8', fg:'#22322d', accent:fixture.accent, 'accent-fg':'#fff', width:'420px', radius:'12px', gap:'16px' };
function baselineTree() {
  return referencedJourney({v:2, submissions:[{id:'enquiry',required:true,fields:[],consents:[]}], steps:fixture.screens.map(s=>({id:s.id,name:s.name,kind:s.kind==='acknowledgement'?'acknowledgement':'input',when:s.showWhen,content:{type:'stack',children:[{type:'text',text:fixture.business},...(s.question?[{...s.question,type:'question',answer_type:s.question.type,required:s.question.required!==false}]:[{type:'heading',text:s.heading??s.name,role:'headline'},{type:'text',text:s.body??'',role:'body'}]),...(s.kind==='capture'?[{type:'field',name:'name',label:'Your name',required:false},{type:'field',name:'email',label:'Email address',required:true}]:[]),...(s.kind==='acknowledgement'?[]:[{type:'button',label:s.button??'Continue',action:s.kind==='capture'?'submit':'next',...(s.kind==='capture'?{submission:'enquiry'}:{})}])]}}))});
}
export default function CurrentBaseline() {
  const [tree,setTree]=useState(baselineTree),[step,setStep]=useState(0),[past,setPast]=useState([]);
  const current=tree.steps[step]??tree.steps[0];
  const question=current.content.children.find(n=>n.type==='question');
  const screen={...fixture.screens.find(s=>s.id===current.id),id:current.id,name:current.name,kind:current.kind==='acknowledgement'?'acknowledgement':question?'question':'content',question:question?{...question,type:question.answer_type}:undefined,heading:current.content.children.find(n=>n.type==='heading')?.text,body:current.content.children.find(n=>n.role==='body')?.text};
  return <main className="cw-baseline"><header><div><small>COMPARISON · CURRENT IMPLEMENTATION</small><h1>Multiple-interest enquiry</h1><p>The existing Manage screens component from this checkout, with isolated sample data. Changes stay in this tab.</p></div><a href="/?prototype=flow&variant=B&scenario=interests">Open prototype B →</a></header><div className="cw-baseline-tools"><Button variant="outline" disabled={!past.length} onClick={()=>{setTree(past.at(-1));setPast(p=>p.slice(0,-1));setStep(0);}}>Undo</Button><JourneyEditor tree={tree} tokens={tokens} step={step} primaryChannel={null} onSelect={setStep} onChange={next=>{setPast(p=>[...p,clone(tree)]);setTree(next);}}/></div><div className="cw-baseline-body"><section><h2>{current.name}</h2><RendererScreen d={fixture} screen={screen} templateOverride={{tree:{...tree,steps:[current]},tokens}}/></section><aside><h2>Compare the same tasks</h2><ol><li>Explain which questions someone choosing garden and balcony will see.</li><li>Change the balcony follow-up to appear for indoor spaces too.</li><li>Duplicate a follow-up, rename it, then remove it.</li><li>Find where a combined enquiry is submitted.</li><li>Try the visitor journey and go Back to change interests.</li></ol><p>Record completion without hints, incorrect predictions, and confidence. Do not compare arbitrary branching here: the current implementation uses ordered visibility and supports up to seven screens.</p><small>This harness compares screen management. The current app’s full design, targeting and destination editors are outside this fixture.</small></aside></div></main>;
}

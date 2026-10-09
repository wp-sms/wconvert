// Prototype-only editing helpers. Stable IDs remain distinct from editable labels.
import { edgeCondition, reviewJourney } from './model';

export function answerReferences(d, question, value) {
  const uses = condition => condition?.clauses?.some(c => c.question === question && c.values.includes(value));
  return [
    ...d.edges.filter(e => e.value !== null && !e.skip && uses(edgeCondition(d,e))).map(e => ({kind:'edge',id:e.id,name:`Path from ${d.screens.find(s=>s.id===e.source)?.name} to ${d.screens.find(s=>s.id===e.target)?.name}`})),
    ...d.screens.flatMap(s => [
      ...(uses(s.showWhen)?[{kind:'screen',id:s.id,section:'visibility',name:`Show condition · ${s.name}`}]:[]),
      ...(s.results??[]).filter(r=>uses(r.condition)).map(r=>({kind:'screen',id:s.id,section:`result:${r.id}`,name:`Result · ${r.name} in ${s.name}`})),
    ]),
  ];
}

export function replaceAnswer(d, question, removed, replacement) {
  const source=d.screens.find(s=>s.question?.id===question);
  if(!source || source.question.options.length<=2 || !source.question.options.some(o=>o.value===removed) || replacement===removed || !source.question.options.some(o=>o.value===replacement)) return d;
  const rewrite=condition=>condition?{...condition,clauses:condition.clauses.map(c=>c.question===question?{...c,values:[...new Set(c.values.map(v=>v===removed?replacement:v))]}:c)}:condition;
  return {...d,
    screens:d.screens.map(s=>({...s,
      ...(s.question?.id===question?{question:{...s.question,options:s.question.options.filter(o=>o.value!==removed)}}:{}),
      ...(s.showWhen?{showWhen:rewrite(s.showWhen)}:{}),
      ...(s.results?{results:s.results.map(r=>({...r,...(r.condition?{condition:rewrite(r.condition)}:{})}))}:{}),
    })),
    edges:d.edges.map(e=>{
      if(e.value===null || e.skip) return e;
      const before=edgeCondition(d,e);
      const changed=before.clauses.some(c=>c.question===question&&c.values.includes(removed));
      if(!changed) return e;
      return e.condition?{...e,condition:rewrite(e.condition),...(e.question===question&&e.value===removed?{value:replacement}:{})}:{...e,value:replacement};
    }),
  };
}

export function reachableScreens(d) {
  const reached=new Set(), stack=[d.entry];
  while(stack.length){const id=stack.pop();if(reached.has(id))continue;reached.add(id);d.edges.filter(e=>e.source===id).forEach(e=>stack.push(e.target));}
  return reached;
}
export function changeImpact(before,after) {
  const was=reachableScreens(before), now=reachableScreens(after);
  const disconnected=after.screens.filter(s=>was.has(s.id)&&!now.has(s.id));
  const removed=before.screens.filter(s=>!after.screens.some(n=>n.id===s.id));
  const oldErrors=reviewJourney(before).filter(i=>i.severity==='error').map(i=>i.text);
  const errors=reviewJourney(after).filter(i=>i.severity==='error'&&!oldErrors.includes(i.text)&&!disconnected.some(s=>i.text===`${s.name} has no path from the start.`));
  return {disconnected,removed,errors};
}
export function describeEdit(before,after) {
  const added=after.screens.find(s=>!before.screens.some(old=>old.id===s.id));if(added)return `Add ${added.name}`;
  const removed=before.screens.find(s=>!after.screens.some(next=>next.id===s.id));if(removed)return `Remove ${removed.name}`;
  const screen=after.screens.find(s=>JSON.stringify(s)!==JSON.stringify(before.screens.find(old=>old.id===s.id)));if(screen)return `Edit ${screen.name}`;
  if(JSON.stringify(before.edges)!==JSON.stringify(after.edges))return 'Change journey paths';
  if(JSON.stringify(before.rules)!==JSON.stringify(after.rules))return 'Edit display rules';
  return 'Edit destinations';
}

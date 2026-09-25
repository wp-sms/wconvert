// THROWAWAY visitor-state proposal. No persistence or production runtime calls.
import { matches, nextEdge } from './model';

export function fixedAnswer(ledger, question) {
  const saved=ledger.find(item=>item.questionIds?.includes(question)||Object.hasOwn(item.answers,question));
  return {locked:Boolean(saved),value:saved?.answers[question]};
}

// Replay only current-path answers in forward order. Never let an answer on a
// discarded branch participate in a later condition, result or submission.
export function relevantState(d, supplied, captures={}) {
  const answers={},screens=[],seen=new Set();let id=d.entry;
  while(id&&!seen.has(id)) {
    seen.add(id);const screen=d.screens.find(s=>s.id===id);if(!screen)break;
    if(screen.showWhen&&!matches(screen.showWhen,answers)) {
      id=d.edges.find(e=>e.source===id&&e.value===null&&!e.skip)?.target;continue;
    }
    screens.push(screen.id);
    if(screen.question) {
      const q=screen.question,value=supplied[q.id];
      const valid=q.type==='multi'?Array.isArray(value)?[...new Set(value.filter(v=>q.options.some(o=>o.value===v)))]:[]:q.options.some(o=>o.value===value)?value:undefined;
      if(valid?.length)answers[q.id]=valid;
    }
    id=nextEdge(d,id,answers,captures[id]==='skip')?.target;
  }
  return {answers,screens};
}

export const relevantAnswers=(d,supplied,captures={})=>relevantState(d,supplied,captures).answers;

export function answerAfterEdit(d, answers, screen, value, ledger=[], captures={}) {
  const next={...answers};
  if(screen.question) {
    const q=screen.question.id,fixed=fixedAnswer(ledger,q),answer=fixed.locked?fixed.value:value;
    if(answer?.length)next[q]=answer;else delete next[q];
  }
  return relevantAnswers(d,next,captures);
}

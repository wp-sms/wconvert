// PROTOTYPE ONLY. Bounded helpers, not a new workflow framework or production schema.
export const clone = value => globalThis.structuredClone(value);
export const questions = scenario => scenario.screens.filter(s => s.question).map(s => ({ ...s.question, screen: s.id, screenName: s.name }));
export function matches(condition, answers) {
  if (!condition) return true;
  const clauses = condition.clauses.map(c => {
    const raw = answers[c.question];
    if (raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)) return false;
    const actual = Array.isArray(raw) ? raw : [raw];
    const hit = c.values.some(v => actual.includes(v));
    return ['is_not', 'includes_none'].includes(c.operator) ? !hit : hit;
  });
  return clauses.length > 0 && (condition.match === 'any' ? clauses.some(Boolean) : clauses.every(Boolean));
}
export function activeAnswers(scenario, answers) {
  const next = {};
  for (const screen of scenario.screens) {
    if (screen.question && matches(screen.condition, next) && answers[screen.question.id] !== undefined) next[screen.question.id] = answers[screen.question.id];
  }
  return next;
}
export const visibleScreens = (scenario, answers) => scenario.screens.filter(s => matches(s.condition, answers));
export const resultFor = (screen, answers) => screen.results?.find(r => r.condition && matches(r.condition, answers)) ?? screen.results?.find(r => !r.condition);
export function conditionLabel(condition, scenario) {
  if (!condition) return 'Always shown';
  const qs = questions(scenario);
  const parts = condition.clauses.map(c => {
    const q = qs.find(q => q.id === c.question);
    const labels = c.values.map(v => q?.options.find(o => o.value === v)?.label ?? 'Removed choice');
    const operator = ({is:'is',is_not:'is not',includes_any:'includes',includes_none:'excludes'})[c.operator];
    return `${q?.screenName ?? 'Removed question'} ${operator} ${labels.join(' or ')}`;
  });
  return parts.length ? parts.join(condition.match === 'any' ? ' OR ' : ' AND ') : 'Choose an earlier answer';
}
export function issues(scenario) {
  const problems=[]; const seen=new Set();
  const check = (condition, owner) => {
    if (!condition) return;
    if (!condition.clauses.length) problems.push(`${owner}: choose an earlier answer.`);
    for(const c of condition.clauses){
      const q=questions(scenario).find(q=>q.id===c.question);
      if(!q || !seen.has(q.id)) problems.push(`${owner}: its question must come earlier.`);
      else if(!c.values.length || c.values.some(v=>!q.options?.some(o=>o.value===v))) problems.push(`${owner}: repair a missing answer choice.`);
    }
  };
  for(const screen of scenario.screens){
    check(screen.condition,screen.name);
    for(const r of screen.results??[]) check(r.condition,r.name);
    if(screen.question){if(screen.question.type!=='text'&&!screen.question.options.length)problems.push(`${screen.name}: add at least one answer choice.`);seen.add(screen.question.id);}
  }
  return problems;
}
export function dependentScreens(scenario, id) {
  return scenario.screens.filter(s=>s.condition?.clauses.some(c=>c.question===id)||(s.results??[]).some(r=>r.condition?.clauses.some(c=>c.question===id))).map(s=>s.name);
}
export function moveScreen(scenario, from, to) {
  if(to<0||to>=scenario.screens.length||scenario.screens[from].kind==='acknowledgement')return null;
  const next=clone(scenario);const [moving]=next.screens.splice(from,1);next.screens.splice(to,0,moving);
  if(issues(next).length)return null;
  const end=next.screens.findIndex(s=>s.kind==='acknowledgement');
  if(end>=0&&end!==next.screens.length-1)return null;
  const firstCapture=next.screens.findIndex(s=>s.kind==='capture');
  const result=next.screens.findIndex(s=>s.kind==='result');
  if(next.capture==='optional'&&firstCapture>=0&&result>firstCapture)return null;
  const boundary=next.screens.findIndex(s=>s.kind==='result'||s.kind==='capture');
  if(boundary>=0&&next.screens.some((s,i)=>s.question&&i>boundary))return null;
  return next;
}
export function toPreviewTemplate(scenario) {
  return {tokens:{bg:'#fffdf8',fg:'#22322d',accent:scenario.accent,'accent-fg':'#ffffff',padding:'32px',width:'420px',radius:'10px',gap:'16px'},tree:{v:2,submissions:[],steps:scenario.screens.map(s=>({id:s.id,name:s.name,kind:s.kind==='acknowledgement'?'acknowledgement':s.question||s.kind==='capture'?'input':'content',content:{type:'stack',children:[
    {type:'text',text:scenario.business},
    {type:'heading',text:s.question?.label??s.heading??s.name,level:'2',size:'xl'},
    ...(s.question?[{type:'text',text:s.question.options?.map(o=>`○ ${o.label}`).join('   ')??'Your answer'}]:[{type:'text',text:s.body??'A recommendation based on your answers.'}]),
    ...(s.kind==='capture'?[{type:'field',name:s.channel==='sms'?'phone':'email',label:s.channel==='sms'?'Phone number':'Email address',placeholder:s.channel==='sms'?'+1 202 555 0100':'you@example.com'}]:[]),
    ...(s.kind==='result'?[{type:'text',text:s.results?.[0]?.title??'Your result'}]:[]),
    ...(s.kind!=='acknowledgement'?[{type:'button',label:s.button??(s.kind==='result'?'View your match':'Continue'),action:'next'}]:[])
  ]}}))}};
}

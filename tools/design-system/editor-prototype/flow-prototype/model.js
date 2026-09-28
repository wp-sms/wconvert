// THROWAWAY graph model. This is deliberately not the shipping ordered journey schema.
import seeds from '../journey-prototype/scenarios.json';
import { conditionLabel } from '../journey-prototype/model';
import { matches } from '@loader/journey-rules';
export { matches };
export const variants = { A: 'Focused screen manager', B: 'Journey workspace' };
export const clone = value => globalThis.structuredClone(value);
const link = (source, target, value = null, extra = {}) => ({ id: `${source}-${target}`, source, target, value, ...extra });
export function seed(id) {
  if (id === 'stress') {
    const d = seed('interests');
    const extras = Array.from({length:15}, (_,i)=>({id:`detail-${i+1}`,name:`Project detail ${i+1}`,kind:'question',question:{id:`detail-${i+1}`,type:'single',label:`Would you like help with planning detail ${i+1}?`,required:false,options:[{value:'yes',label:'Yes, include this in my consultation'},{value:'no',label:'No, I have already taken care of this'}]}}));
    const screens = [...d.screens.slice(0,3),...extras,...d.screens.slice(3)];
    return {...d,id,name:'Large journey · 20 screens',screens,edges:screens.slice(0,-1).map((s,i)=>link(s.id,screens[i+1].id))};
  }
  if (id === 'signup') { const d = seed('newsletter'); return { ...d, id, name: 'Simple email signup', screens: d.screens.filter(s => s.id !== 'sms'), edges: [link('email', 'thanks')], destinations: ['mailpoet'] }; }
  if (id === 'blank') return { ...seed('signup'), id, name: 'Untitled campaign', starter: true, screens: [{ id: 'welcome', name: 'Welcome', kind: 'content', heading: 'Welcome', body: 'Introduce your offer, then add the next screen.' }], edges: [], entry: 'welcome', destinations: [] };
  if (id === 'interests') {
    const d = seed('garden');
    return { ...d, id, name: 'Plan your spaces', screens: d.screens.map(s => s.id === 'contact' ? { ...s, fields: ['name','email'], reviewAnswers: true, privacyNote: 'We use your details to respond to this consultation request. This does not sign you up for marketing.' } : s.id === 'project' ? { ...s, question: { ...s.question, type: 'multi', label: 'Which spaces would you like help with?' } } : ['space', 'balcony'].includes(s.id) ? { ...s, showWhen: { match: 'all', clauses: [{ question: 'project', operator: 'includes_any', values: [s.id === 'space' ? 'garden' : 'balcony'] }] } } : s), edges: [link('project', 'space'), link('space', 'balcony'), link('balcony', 'contact'), link('contact', 'thanks')] };
  }
  const base = clone(seeds.find(s => s.id === id) ?? seeds[0]);
  let screens = base.screens.map(s => { const copy = { ...s }; delete copy.condition; return copy; });
  let edges;
  if (base.id === 'garden') {
    screens.splice(2, 0, { id: 'balcony', name: 'Balcony light', kind: 'question', question: { id: 'light', type: 'single', label: 'How much sun does your balcony get?', options: [{ value: 'sunny', label: 'Mostly sunny' }, { value: 'shade', label: 'Mostly shade' }] } });
    edges = [link('project', 'space', 'garden'), link('project', 'balcony', 'balcony'), link('project', 'contact'), link('space', 'contact'), link('balcony', 'contact'), link('contact', 'thanks')];
  } else if (base.id === 'coffee') {
    edges = [link('brew', 'taste'), link('taste', 'grind', 'filter', { question: 'brew' }), link('taste', 'result'), link('grind', 'result'), link('result', 'email'), link('email', 'thanks'), link('email', 'thanks', null, { id: 'email-skip', skip: true })];
  } else {
    edges = [link('email', 'sms'), link('sms', 'thanks'), link('sms', 'thanks', null, { id: 'sms-skip', skip: true })];
  }
  return { ...base, screens, edges, entry: screens[0].id, rules: { type: 'popup', trigger: 'delay', pages: 'All pages except checkout', audience: 'Everyone', delay: 8, frequency: 'Once per tab session' }, destinations: base.id === 'garden' ? ['webhook'] : base.id === 'coffee' ? ['mailpoet'] : ['mailpoet', 'wsms'] };
}
export const destinations = {
  webhook: { name: 'Enquiry webhook', target: 'Garden team · enquiries', channel: 'email', shared: 2, status: 'Ready', description: 'Sends the saved request and answers to your configured endpoint.' },
  mailpoet: { name: 'MailPoet', target: 'Plant notes · email list', channel: 'email', shared: 3, status: 'Ready', description: 'Hands off the saved email signup. Subscription status belongs to MailPoet.' },
  wsms: { name: 'WP SMS', target: 'Plant notes · SMS list', channel: 'sms', shared: 1, status: 'Ready', description: 'Runs only when the visitor explicitly submits their SMS signup.' },
};
export function questionFor(d, edge) { return d.screens.find(s => s.question?.id === edge.question)?.question ?? d.screens.find(s => s.id === edge.source)?.question; }
export function edgeLabel(d, edge) {
  if (edge.skip) return 'No thanks';
  const siblings = d.edges.filter(e => e.source === edge.source && !e.skip);
  if (edge.value === null) return siblings.length > 1 ? 'Everyone else' : 'Continue';
  if (edge.condition) {
    const labels = edge.condition.clauses.map(c => { const s = d.screens.find(s => s.question?.id === c.question); const values = c.values.map(v => s?.question.options.find(o => o.value === v)?.label ?? 'Choose answer').join(' or '); return `${s?.id === edge.source ? '' : `${s?.name ?? 'Question'}: `}${['is_not', 'includes_none'].includes(c.operator) ? 'not ' : ''}${values || 'Choose answer'}`; });
    return labels.join(edge.condition.match === 'any' ? ' or ' : ' and ');
  }
  const q = questionFor(d, edge);
  const source = d.screens.find(s => s.question?.id === q?.id);
  return `${source && source.id !== edge.source ? `${source.name}: ` : ''}${q?.options?.find(o => o.value === edge.value)?.label ?? 'Choose answer'}`;
}
export function validConnection(d, source, target) {
  if (!source || !target || source === target || d.screens.find(s => s.id === source)?.kind === 'acknowledgement' || !d.screens.some(s => s.id === target)) return false;
  const visit = (id, seen = new Set()) => { if (id === source) return true; if (seen.has(id)) return false; seen.add(id); return d.edges.filter(e => e.source === id).some(e => visit(e.target, seen)); };
  return !visit(target);
}
export function graphIssues(d) {
  const seen = new Set();
  const walk = id => { if (seen.has(id)) return; seen.add(id); d.edges.filter(e => e.source === id).forEach(e => walk(e.target)); };
  walk(d.entry);
  const problems = [];
  for (const s of d.screens) {
    const out = d.edges.filter(e => e.source === s.id && !e.skip);
    if (!seen.has(s.id)) problems.push(`${s.name} has no path from the start.`);
    if (s.kind !== 'acknowledgement' && !out.length) problems.push(`${s.name} needs a next screen.`);
    if (out.length && out.filter(e => e.value === null).length !== 1) problems.push(`${s.name} needs exactly one Everyone else path.`);
    if (out.some(e => e.value === '__choose__')) problems.push(`${s.name} has a branch without an answer.`);
    const available = questionsUpstream(d, s.id).map(s => s.question.id);
    for (const edge of out.filter(e => e.value !== null)) {
      const condition = edgeCondition(d, edge);
      if (!condition.clauses.length || condition.clauses.some(c => !c.values.length)) problems.push(`${s.name} has a condition without an answer.`);
      if (condition.clauses.some(c => !available.includes(c.question) || c.values.some(v => !d.screens.find(s => s.question?.id === c.question)?.question.options.some(o => o.value === v)))) problems.push(`${s.name} has a condition using an unavailable question or answer.`);
    }
  }
  return problems;
}
export function nextEdge(d, id, answers, skip = false) {
  const outgoing = d.edges.filter(e => e.source === id);
  if (skip) return outgoing.find(e => e.skip);
  return outgoing.find(e => !e.skip && e.value !== null && matches(edgeCondition(d, e), answers)) ?? outgoing.find(e => !e.skip && e.value === null);
}
export function positions(d) {
  const depth = Object.fromEntries(d.screens.map(s => [s.id, 0]));
  for (let n = 0; n < d.screens.length; n++) for (const e of d.edges) depth[e.target] = Math.max(depth[e.target], depth[e.source] + 1);
  const layers = {};
  d.screens.forEach(s => (layers[depth[s.id]] ??= []).push(s.id));
  return Object.fromEntries(Object.entries(layers).flatMap(([level, ids]) => ids.map((id, i) => [id, { x: Number(level) * 340, y: i * 300 - (ids.length - 1) * 150 }])));
}

export function questionsUpstream(d, id) {
  const seen = new Set();
  const visit = current => { if (seen.has(current)) return; seen.add(current); d.edges.filter(e => e.target === current).forEach(e => visit(e.source)); };
  visit(id);
  return d.screens.filter(s => seen.has(s.id) && s.question?.options).sort((a, b) => a.id === id ? -1 : b.id === id ? 1 : 0);
}

export function edgeCondition(d, edge) {
  return edge.condition ?? { match: 'all', clauses: [{ question: questionFor(d, edge)?.id, operator: questionFor(d, edge)?.type === 'multi' ? 'includes_any' : 'is', values: [edge.value] }] };
}
export function ruleText(d, edge) {
  if (edge.skip) return 'They choose No thanks';
  if (edge.value === null) return d.edges.some(e => e.source === edge.source && e.value !== null) ? 'No earlier condition matches' : 'They continue';
  return conditionLabel(edgeCondition(d, edge), d);
}
// Replay from the start, retaining only answers actually encountered on this path.
export function sampleJourney(d, supplied = {}, captures = {}) {
  const screens = [], edges = [], answers = {}, decisions = [], handoffs = [], skipped = [];
  let id = d.entry; const evaluated = new Set();
  while (id && !evaluated.has(id)) {
    evaluated.add(id);
    const s = d.screens.find(s => s.id === id);
    if (!s) break;
    if (s.showWhen && !matches(s.showWhen, answers)) { skipped.push({ id, reason: conditionLabel(s.showWhen, d) }); const bypass = d.edges.find(e => e.source === id && e.value === null && !e.skip); if (!bypass) return { screens, edges, answers, decisions, handoffs, skipped, blocked: id }; edges.push(bypass.id); id = bypass.target; continue; }
    screens.push(id);
    if (s.kind === 'acknowledgement') return { screens, edges, answers, decisions, handoffs, skipped, complete: true };
    if (s.question) {
      const value = supplied[s.question.id];
      const valid = Array.isArray(value) ? value.filter(v => s.question.options.some(o => o.value === v)) : s.question.options.some(o => o.value === value) ? value : undefined;
      if (value !== '__unanswered__' || s.question.required !== false) {
        if (valid === undefined || valid.length === 0) return { screens, edges, answers, decisions, handoffs, skipped, waiting: id };
        answers[s.question.id] = valid;
      }
    }
    if (s.kind === 'capture' && !captures[id]) return { screens, edges, answers, decisions, handoffs, skipped, waiting: id };
    const skip = captures[id] === 'skip';
    const edge = nextEdge(d, id, answers, skip);
    if (!edge) return { screens, edges, answers, decisions, handoffs, skipped, blocked: id };
    if (s.kind === 'capture' && !skip) handoffs.push({ screen: s.name, names: d.destinations.filter(id => destinations[id].channel === s.channel).map(id => destinations[id].name) });
    const matching = d.edges.filter(e => e.source === id && !e.skip && e.value !== null && matches(edgeCondition(d, e), answers));
    decisions.push({ source: id, edge: edge.id, reason: ruleText(d, edge), alsoMatches: matching.filter(e => e.id !== edge.id).length });
    edges.push(edge.id); id = edge.target;
  }
  return { screens, edges, answers, decisions, handoffs, skipped };
}

export function resolveNext(d, source, answers, skip = false) {
  const first = nextEdge(d, source, answers, skip);
  if (!first) return { edges: [], skipped: [] };
  const edges = [first.id], skipped = [], seen = new Set(); let target = first.target;
  while (target && !seen.has(target)) {
    seen.add(target); const s = d.screens.find(s => s.id === target);
    if (!s) return { edges, skipped };
    if (!s.showWhen || matches(s.showWhen, answers)) return { target, edges, skipped, reason: ruleText(d, first) };
    skipped.push({ id: target, reason: conditionLabel(s.showWhen, d) });
    const bypass = d.edges.find(e => e.source === target && e.value === null && !e.skip);
    if (!bypass) return { edges, skipped };
    edges.push(bypass.id); target = bypass.target;
  }
  return { edges, skipped };
}
export function referencesTo(d, question) {
  if (!question) return [];
  return [...d.screens.filter(s => s.showWhen?.clauses.some(c => c.question === question) || s.results?.some(r => r.condition?.clauses.some(c => c.question === question))).map(s => ({ kind: 'screen', id: s.id, name: s.name })), ...d.edges.filter(e => e.value !== null && edgeCondition(d, e).clauses.some(c => c.question === question)).map(e => ({ kind: 'edge', id: e.id, name: `${d.screens.find(s => s.id === e.source)?.name} → ${d.screens.find(s => s.id === e.target)?.name}` }))];
}
export function reviewJourney(d) {
  const items = graphIssues(d).map((text, i) => ({ id: `error-${i}`, severity: 'error', text, kind: 'screen', target: d.screens.find(s => text.startsWith(s.name + ' '))?.id }));
  const inspect = (condition, owner, kind, target, sources) => {
    if (!condition) return;
    if (!condition.clauses.length || condition.clauses.some(c => !c.values.length || !sources.includes(c.question) || c.values.some(v => !d.screens.find(s => s.question?.id === c.question)?.question.options.some(o => o.value === v)))) items.push({ severity: 'error', text: `${owner}: repair an incomplete or unavailable answer condition.`, kind, target });
    if (condition.match === 'all') for (const q of d.screens.filter(s => s.question?.type === 'single').map(s => s.question)) {
      const clauses = condition.clauses.filter(c => c.question === q.id);
      if (clauses.length && !q.options.some(o => matches({ match: 'all', clauses }, { [q.id]: o.value }))) items.push({ severity: 'warning', text: `${owner}: no single answer to “${q.label}” can satisfy all these conditions.`, kind, target });
    }
  };
  for (const s of d.screens) {
    const qs = questionsUpstream(d, s.id).map(s => s.question.id);
    inspect(s.showWhen, s.name, 'screen', s.id, qs.filter(id => id !== s.question?.id));
    s.results?.forEach(r => inspect(r.condition, r.name, 'screen', s.id, qs));
    if (s.results && s.results.filter(r => !r.condition).length !== 1) items.push({ severity: 'error', text: `${s.name}: add exactly one Everyone else result.`, kind: 'screen', target: s.id });
    const out = d.edges.filter(e => e.source === s.id && e.value !== null && !e.skip);
    out.forEach((e, i) => { const c = edgeCondition(d, e); inspect(c, `Path ${i + 1} from ${s.name}`, 'edge', e.id, qs); if (out.slice(0, i).some(earlier => JSON.stringify(edgeCondition(d, earlier)) === JSON.stringify(c))) items.push({ severity: 'warning', text: `${s.name}: this condition repeats an earlier path, so it cannot win.`, kind: 'edge', target: e.id }); });
  }
  for (const id of d.destinations) if (!d.screens.some(s => s.kind === 'capture' && s.channel === destinations[id].channel)) items.push({ severity: 'warning', text: `${destinations[id].name} has no matching capture screen.`, kind: 'destinations', target: 'destinations' });
  return items;
}

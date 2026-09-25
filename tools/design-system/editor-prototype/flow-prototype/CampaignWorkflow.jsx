// THROWAWAY: a complete draft-to-review task, without publishing or network effects.
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, CircleHelp, Play } from 'lucide-react';
import { destinations, reviewJourney } from './model';
export const signature = d => JSON.stringify(d);
// Wording and appearance do not change which screens or submissions a visitor reaches.
// Preserve route evidence only while the complete behavior contract remains identical.
export const behaviorSignature = d => JSON.stringify({
  id:d.id, entry:d.entry, capture:d.capture, rules:d.rules, destinations:d.destinations, destinationState:d.destinationState,
  edges:d.edges.map(({id,source,target,value,question,condition,skip})=>({id,source,target,value,question,condition,skip})),
  screens:d.screens.map(s=>({id:s.id,kind:s.kind,showWhen:s.showWhen,channel:s.channel,optional:s.optional,fields:s.fields,
    question:s.question && {id:s.question.id,type:s.question.type,required:s.question.required!==false,options:s.question.options.map(o=>o.value)},
    results:s.results?.map(({id,condition,product_ids,products})=>({id,condition,product_ids,products}))}))
});
export const enquiryCases = [
  { id: 'garden', label: 'Garden only', interests: ['garden'] },
  { id: 'balcony', label: 'Balcony only', interests: ['balcony'] },
  { id: 'both', label: 'Garden + balcony', interests: ['garden', 'balcony'] },
  { id: 'indoors', label: 'Indoor space only', interests: ['indoors'] },
];
export function completedCase(run, d) {
  if (run.behavior !== behaviorSignature(d) || !run.submissions.length || (d.id === 'interests' && run.submissions.length !== 1)) return null;
  const chosen = [...(Array.isArray(run.answers.project) ? run.answers.project : [run.answers.project])].sort().join(',');
  return enquiryCases.find(c => [...c.interests].sort().join(',') === chosen)?.id;
}
export function campaignChecks(d) {
  const issues = reviewJourney(d);
  const captures = d.screens.filter(s => s.kind === 'capture');
  if (d.id === 'interests' && captures.length !== 1) issues.push({ severity: 'error', kind: 'screen', target: d.entry, text: 'This enquiry should have one contact screen and one combined submission.' });
  if (d.capture === 'required') {
    const required = new Set(captures.filter(s => !s.optional && !s.showWhen).map(s => s.id));
    const seen = new Set(); let bypass = null;
    const walk = id => { if (seen.has(id) || required.has(id)) return; seen.add(id); const screen = d.screens.find(s => s.id === id); if (screen?.kind === 'acknowledgement') bypass = id; d.edges.filter(e => e.source === id).forEach(e => walk(e.target)); };
    walk(d.entry);
    if (bypass || !required.size) issues.push({ severity: 'error', kind: 'screen', target: bypass ?? d.entry, text: 'A visitor can finish without the required enquiry. Connect every ending through its contact screen.' });
  }
  for (const s of captures) if (!(s.fields ?? [s.channel === 'sms' ? 'phone' : 'email']).includes(s.channel === 'sms' ? 'phone' : 'email')) issues.push({ severity:'error', kind:'screen', target:s.id, text:`${s.name}: add the required contact field.` });
  for (const id of d.destinations) if (d.destinationState?.[id] === 'setup') issues.push({severity:'error',kind:'destinations',target:'destinations',text:`${destinations[id].name}: finish destination setup or remove it from this campaign.`});
  return issues;
}
export function CaptureSettings({ screen, update }) {
  const fields = screen.fields ?? [screen.channel === 'sms' ? 'phone' : 'email'];
  return <section className="cw-capture"><h3>Contact details</h3><p>{screen.channel === 'sms' ? 'Phone is required for this SMS submission.' : 'Email is required so your team can reply. Answers are saved with this submission.'}</p><label className="cx-check"><input type="checkbox" checked={fields.includes('name')} onChange={e => update({ ...screen, fields: e.target.checked ? ['name', ...fields] : fields.filter(f => f !== 'name') })}/>Ask for a name (optional)</label><label className="cx-check"><input type="checkbox" checked={!!screen.reviewAnswers} onChange={e => update({ ...screen, reviewAnswers: e.target.checked })}/>Let visitors review their answers before submitting</label><label className="fp-field"><span>How you will use their details</span><textarea value={screen.privacyNote ?? ''} placeholder="We use your details to reply to your request." onChange={e => update({ ...screen, privacyNote: e.target.value })}/></label><small>An enquiry is not a marketing signup. Add a separate explicit signup if you want to collect marketing permission.</small></section>;
}
export function SetupSummary({ d, runs, open, test }) {
  const count = enquiryCases.filter(c => runs.some(r => completedCase(r, d) === c.id)).length;
  return <details className="cw-setup"><summary><span><strong>Setup guide · one combined enquiry</strong><small>Everyone answers the first question. Each matching follow-up appears, then contact details.</small></span><b>{count}/4 walkthroughs</b></summary><div className="cw-setup-actions"><button onClick={() => open('screen', d.entry)}>1. Questions & follow-ups<ArrowRight size={13}/></button><button onClick={() => open('screen', d.screens.find(s => s.kind === 'capture')?.id ?? d.entry)}>2. Enquiry details<ArrowRight size={13}/></button><button onClick={() => open('display', 'display')}>3. When it appears<ArrowRight size={13}/></button><button onClick={() => open('destinations', 'destinations')}>4. Where it goes<ArrowRight size={13}/></button><button onClick={test}>5. Test & review<Play size={13}/></button></div></details>;
}
export function PublishReview({ d, savedDraft, published, runs, open, test, save, publish }) {
  const issues = campaignChecks(d), errors = issues.filter(i => i.severity === 'error');
  const saved = savedDraft && signature(savedDraft) === signature(d);
  const tested = runs.filter(r => r.behavior === behaviorSignature(d));
  const contentChanged = tested.some(r=>r.version !== signature(d));
  const completed = enquiryCases.filter(c => tested.some(r => completedCase(r, d) === c.id));
  const casesReady = d.id !== 'interests' ? tested.length > 0 : completed.length === enquiryCases.length;
  const ready = saved && !errors.length;
  return <div className="cw-review"><div className="cw-review-summary"><strong>{d.name}</strong><p>{d.rules.audience} · {d.rules.pages} · {d.rules.type === 'inline' ? 'Inline' : d.rules.trigger === 'delay' ? `After ${d.rules.delay}s` : d.rules.trigger === 'exit' ? 'Exit intent' : 'On click'}</p><p>{d.screens.filter(s => s.kind === 'capture').length} submission screen(s) · Saved in WConvert{d.destinations.length ? ` → ${d.destinations.map(id => destinations[id].name).join(' + ')}` : ''}</p></div><h3>Before this draft goes live</h3>{issues.map((issue, i) => <button className="fx-review-item" key={i} onClick={() => open(issue.kind, issue.target)}><CircleHelp size={15}/><span>{issue.text}</span><ArrowRight size={14}/></button>)}{!issues.length && <p className="cw-ok"><Check size={15}/>Structure checks passed</p>}<div className="cw-save-row"><span>{saved ? 'This version is saved for this session' : 'This draft has unsaved changes'}</span>{!saved && <Button variant="outline" size="sm" onClick={save}>Save this draft</Button>}</div><h3>Recommended visitor checks</h3>{contentChanged && <p className="jt-content-note">Wording or appearance changed; routing is unchanged. Your walkthroughs are retained. Preview the updated content before publishing.</p>}{!casesReady && <p className="cw-muted">{runs.length && !tested.length ? "Journey behaviour changed. Earlier walkthroughs no longer cover this version." : "Try the relevant paths before publishing. Walkthroughs are recommended, not a publication requirement."}</p>}{d.id === 'interests' ? <div className="cw-cases">{enquiryCases.map(c => { const run = tested.find(r => completedCase(r,d) === c.id); return <div key={c.id}><span>{run ? <Check size={15}/> : <CircleHelp size={15}/>} {c.label}{run && <small>Visited: {run.path.map(id=>d.screens.find(s=>s.id===id)?.name ?? id).join(' → ')}</small>}</span><button onClick={() => test(c)}>Try this path<ArrowRight size={12}/></button></div>; })}</div> : <Button variant="outline" onClick={() => test()}><Play/>Test this draft</Button>}<p className="cw-muted">A check means the walkthrough finished, not that its outcome was verified. Compare the visited screens with your intention. Content edits keep these records; changes to routing, answers, capture, display rules or destinations require fresh checks. These examples do not cover every combination.</p><Button className="fp-wide" disabled={!ready} onClick={publish}>{published && signature(published) === signature(d) ? 'Demo version is published' : 'Publish demo version'}</Button><p className="cw-muted">Prototype simulation only. Save and publish keep separate snapshots in memory; reload resets both. No live campaign or destination is changed.</p></div>;
}

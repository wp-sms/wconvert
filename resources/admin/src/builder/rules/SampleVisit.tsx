import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { audienceMatches, audienceRules, groupMatches, openingMatches, openingRules, type Answer } from '../../../../loader/src/display-rules';
import { phraseOf } from './sentence';
import type { Rule, RuleVocabulary } from '../api';
import type { DisplayRulesValue } from './summaries';

/** Hypothetical facts only. This module has no storage, listeners, beacons or capture imports. */
export default function SampleVisit({ value, vocabulary, onClose }: { value: DisplayRulesValue; vocabulary: RuleVocabulary; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [seconds, setSeconds] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [idle, setIdle] = useState(0);
  const [page, setPage] = useState(true);
  const [limits, setLimits] = useState(true);
  const [pacing, setPacing] = useState(true);
  const [completion, setCompletion] = useState(true);
  const [goal, setGoal] = useState(true);
  // The displayed result is the last simulated event. Any fact edit ends that
  // event, so advancing the clock or changing eligibility cannot replay it.
  const [gesture, setGesture] = useState<string | null>(null);
  const change = <T,>(setter: (value: T) => void, next: T) => { setGesture(null); setter(next); };
  const reset = () => {
    setAnswers({}); setSeconds(0); setScroll(0); setIdle(0); setGesture(null);
    setPage(true); setLimits(true); setPacing(true); setCompletion(true); setGoal(true);
  };
  const plan = value.display_rules;
  const types = [...vocabulary.targeting, ...vocabulary.conditions, ...vocabulary.triggers];
  const isGesture = (type: string) => ['exit_intent', 'scroll_up', 'click_element'].includes(type);
  const read = (rule: { readonly [key: string]: unknown }): Answer => rule.type === 'time_on_page' ? seconds >= Number(rule.seconds)
    : rule.type === 'scroll_depth' ? scroll >= Number(rule.percent) : rule.type === 'inactivity' ? Math.min(idle, seconds) >= Number(rule.seconds)
      : isGesture(String(rule.type)) ? gesture === String(rule.id) : answers[String(rule.id)] ?? false;
  const rows = plan ? [...audienceRules(plan), ...openingRules(plan)] : [];
  const automaticValue = (type: string) => ['time_on_page', 'scroll_depth', 'inactivity'].includes(type);
  const audience = plan ? audienceMatches(plan.audience, read) : false;
  const opening = plan ? openingMatches(plan.opening, read, seconds) : false;
  const automaticAllowed = plan?.opening.mode === 'click' || pacing;
  const passes = page && limits && completion && automaticAllowed && goal && audience === true && opening === true;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{__('Test a sample visit', 'wconvert')}</DialogTitle>
      <DialogDescription>{__('Test your unsaved draft with hypothetical facts. This does not check a real URL, save, publish, or count a visit. Use the live inspector on your site to check published behavior.', 'wconvert')}</DialogDescription></DialogHeader>
    <p className="text-note font-semibold">{__('Simulation', 'wconvert')}</p>
    <label><input type="checkbox" checked={page} onChange={event => change(setPage, event.target.checked)} />{__('Sample page is included and not excluded', 'wconvert')}</label>
    <label><input type="checkbox" checked={limits} onChange={event => change(setLimits, event.target.checked)} />{__('Schedule, page visibility and presentation allow opening', 'wconvert')}</label>
    <label><input type="checkbox" checked={completion} onChange={event => change(setCompletion, event.target.checked)} />{__('Campaign and site completion restrictions allow opening', 'wconvert')}</label>
    <label><input type="checkbox" checked={pacing} onChange={event => change(setPacing, event.target.checked)} />{__('Automatic appearance limits, waiting periods and dismissal settings allow opening', 'wconvert')}</label>
    {plan?.opening.mode === 'click' && <p className="text-note">{__('Explicit clicks skip automatic pacing. Completion, audience, schedule and another open popup still apply.', 'wconvert')}</p>}
    <label><input type="checkbox" checked={goal} onChange={event => change(setGoal, event.target.checked)} />{__('Required Goal conditions are met', 'wconvert')}</label>
    <label>{__('Seconds since navigation', 'wconvert')} <input type="number" min={0} value={seconds} onChange={event => change(setSeconds, Number(event.target.value))} /></label>
    {rows.some(rule => rule.type === 'scroll_depth') && <label>{__('Furthest scroll depth (%)', 'wconvert')} <input type="number" min={0} max={100} value={scroll} onChange={event => change(setScroll, Number(event.target.value))} /></label>}
    {rows.some(rule => rule.type === 'inactivity') && <label>{__('Visible seconds since last activity', 'wconvert')} <input type="number" min={0} value={idle} onChange={event => change(setIdle, Number(event.target.value))} /></label>}
    {rows.filter(rule => automaticValue(rule.type)).map(rule => <p key={String(rule.id)}>{phraseOf(rule as Rule, types).text}: {read(rule) === true ? __('Matches', 'wconvert') : __('Not yet', 'wconvert')}</p>)}
    {rows.filter(rule => !automaticValue(rule.type) && !isGesture(rule.type)).map(rule => <label key={String(rule.id)} className="flex flex-col gap-1">
      {phraseOf(rule as Rule, types).text}<select value={String(read(rule))} onChange={event => change(setAnswers, { ...answers, [String(rule.id)]: event.target.value === 'blocked' ? 'blocked' : event.target.value === 'true' })}>
        <option value="false">{__('Does not match', 'wconvert')}</option><option value="true">{__('Matches now', 'wconvert')}</option><option value="blocked">{__('Consent withheld — not read', 'wconvert')}</option>
      </select></label>)}
    {rows.some(rule => isGesture(rule.type)) && <fieldset className="flex flex-col gap-2"><legend>{__('Simulate a fresh event', 'wconvert')}</legend>
      <p className="text-note">{__('Each button tests an event against the current facts. Changing any fact clears that event; an earlier exit or click never opens later.', 'wconvert')}</p>
      {rows.filter(rule => isGesture(rule.type)).map(rule => <Button variant="outline" key={String(rule.id)} onClick={() => { setIdle(0); setGesture(String(rule.id)); }}>
        {rule.type === 'exit_intent' ? __('Simulate exit intent', 'wconvert') : rule.type === 'scroll_up' ? __('Simulate scroll back up', 'wconvert') : `${__('Simulate click', 'wconvert')}: ${String(rule.selector ?? '')}`}
      </Button>)}
    </fieldset>}
    {plan?.audience.mode === 'groups' && <ol>{plan.audience.groups.map((group, index) => <li key={group.id}>{__('Audience group', 'wconvert')} {index + 1} ({group.match.toUpperCase()}): {groupMatches(group, read) === true ? __('Matches', 'wconvert') : groupMatches(group, read) === 'blocked' ? __('Needs consent', 'wconvert') : __('Does not match', 'wconvert')}</li>)}</ol>}
    <div role="status" className="wconvert-display-test-result"><strong>{passes ? __('Can open for this sample', 'wconvert') : __('Does not open for this sample', 'wconvert')}</strong>
      <p>{!page ? __('The page gate prevents opening.', 'wconvert') : !goal ? __('A required Goal condition prevents opening.', 'wconvert') : !limits ? __('A universal restriction prevents opening.', 'wconvert') : !completion ? __('A completion restriction prevents opening.', 'wconvert') : !automaticAllowed ? __('Automatic pacing prevents opening.', 'wconvert') : audience !== true ? __('The audience does not match or needs consent.', 'wconvert') : opening !== true ? __('The opening requirements or minimum time have not been met.', 'wconvert') : __('All supplied sample facts allow opening.', 'wconvert')}</p>
    </div>
    <Button variant="outline" onClick={reset}>{__('Reset sample', 'wconvert')}</Button>
  </DialogContent></Dialog>;
}

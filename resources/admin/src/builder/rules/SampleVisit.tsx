import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { audienceMatches, audienceRules, groupMatches, openingMatches, openingRules, type Answer } from '../../../../loader/src/display-rules';
import { phraseOf } from './sentence';
import type { Rule, RuleVocabulary } from '../api';
import type { DisplayRulesValue } from './summaries';

/** Hypothetical facts only. This module has no storage, listeners, beacons or capture imports. */
export default function SampleVisit({ value, vocabulary, onClose }: { value: DisplayRulesValue; vocabulary: RuleVocabulary; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [adBlocking, setAdBlocking] = useState<'detected' | 'not_detected' | 'unknown' | 'pending'>('unknown');
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
    setAnswers({}); setAdBlocking('unknown'); setSeconds(0); setScroll(0); setIdle(0); setGesture(null);
    setPage(true); setLimits(true); setPacing(true); setCompletion(true); setGoal(true);
  };
  const plan = value.display_rules;
  const types = [...vocabulary.targeting, ...vocabulary.conditions, ...vocabulary.triggers];
  const isGesture = (type: string) => ['exit_intent', 'scroll_up', 'click_element'].includes(type);
  const read = (rule: { readonly [key: string]: unknown }): Answer => rule.type === 'time_on_page' ? seconds >= Number(rule.seconds)
    : rule.type === 'scroll_depth' ? scroll >= Number(rule.percent) : rule.type === 'inactivity' ? Math.min(idle, seconds) >= Number(rule.seconds)
      : isGesture(String(rule.type)) ? gesture === String(rule.id)
        : rule.type === 'ad_blocking' ? (adBlocking === 'detected' || adBlocking === 'not_detected') && adBlocking === rule.value : answers[String(rule.id)] ?? false;
  const rows = plan ? [...audienceRules(plan), ...openingRules(plan)] : [];
  const automaticValue = (type: string) => ['time_on_page', 'scroll_depth', 'inactivity'].includes(type);
  const audience = plan ? audienceMatches(plan.audience, read) : false;
  const opening = plan ? openingMatches(plan.opening, read, seconds) : false;
  const automaticAllowed = plan?.opening.mode === 'click' || pacing;
  const passes = page && limits && completion && automaticAllowed && goal && audience === true && opening === true;
  const timed = rows.filter(rule => automaticValue(rule.type));
  const facts = rows.filter(rule => rule.type !== 'ad_blocking' && !automaticValue(rule.type) && !isGesture(rule.type));
  const hasAdBlocking = rows.some(rule => rule.type === 'ad_blocking');
  const gestures = rows.filter(rule => isGesture(rule.type));
  const minimum = plan?.opening.mode === 'automatic' ? plan.opening.minimum_seconds ?? 0 : 0;
  const showTime = minimum > 0 || rows.some(rule => ['time_on_page', 'inactivity'].includes(rule.type));
  const changedAssumptions = [page, limits, completion, pacing, goal].filter(allowed => !allowed).length;
  const ResultIcon = passes ? CheckCircle2 : CircleDashed;
  const reason = !plan ? __('Set up your display rules before testing a visit.', 'wconvert')
    : !page ? __('This page is excluded from the campaign.', 'wconvert')
      : !goal ? __('A required goal condition is not met.', 'wconvert')
        : !limits ? __('The schedule or page conditions prevent opening.', 'wconvert')
          : !completion ? __('Completion rules stop this visitor from seeing it again.', 'wconvert')
            : !automaticAllowed ? __('Repeat limits stop another automatic appearance.', 'wconvert')
              : audience !== true ? __('This visitor does not match your audience, or has not given the needed consent.', 'wconvert')
                : minimum > seconds ? sprintf(__('The visitor needs at least %d seconds on the page.', 'wconvert'), minimum)
                  : opening !== true ? __('The opening conditions below are not met yet.', 'wconvert')
                    : __('This visitor meets your rules, using the assumptions below.', 'wconvert');
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="wconvert-sample-dialog sm:max-w-2xl flex flex-col gap-0 p-0 overflow-hidden max-h-[calc(100dvh-2rem)]">
      <DialogHeader className="wconvert-sample-header text-start">
        <DialogTitle>{__('Test a sample visit', 'wconvert')}</DialogTitle>
        <DialogDescription>{__('Describe a pretend visitor. The result updates automatically as you change the values.', 'wconvert')}</DialogDescription>
      </DialogHeader>
      <div className="wconvert-sample-result" data-passes={passes} role="status" aria-live="polite" aria-atomic="true">
        <ResultIcon aria-hidden="true" />
        <div><strong>{passes ? __('Would show', 'wconvert') : __('Would not show', 'wconvert')}</strong><p>{reason}</p></div>
      </div>
      <div className="wconvert-sample-body">
        {(showTime || timed.length > 0 || gestures.length > 0) && <section aria-labelledby="wconvert-sample-activity">
          <h3 id="wconvert-sample-activity">{__('Visitor activity', 'wconvert')}</h3>
          {(showTime || timed.length > 0) && <>
            <p className="wconvert-sample-help">{__('Enter pretend values — you do not need to wait or scroll.', 'wconvert')}</p>
            <div className="wconvert-sample-fields">
              {showTime && <SampleNumber id="wconvert-sample-time" label={__('Time on page', 'wconvert')} unit={__('seconds', 'wconvert')} value={seconds} onChange={next => change(setSeconds, next)} />}
              {rows.some(rule => rule.type === 'scroll_depth') && <SampleNumber id="wconvert-sample-scroll" label={__('Page scrolled', 'wconvert')} unit="%" max={100} value={scroll} onChange={next => change(setScroll, next)} />}
              {rows.some(rule => rule.type === 'inactivity') && <SampleNumber id="wconvert-sample-idle" label={__('Time without activity', 'wconvert')} unit={__('seconds', 'wconvert')} value={idle} onChange={next => change(setIdle, next)} />}
            </div>
            {rows.some(rule => rule.type === 'inactivity') && idle > seconds && <p className="wconvert-sample-help">{__('Inactive time is counted only up to the time on page.', 'wconvert')}</p>}
            {(timed.length > 0 || minimum > 0) && <ul className="wconvert-sample-checks" aria-label={__('Opening and activity conditions', 'wconvert')}>
              {timed.map(rule => <li key={String(rule.id)}><span>{phraseOf(rule as Rule, types).text}</span><span data-met={read(rule) === true}>{read(rule) === true ? __('Met', 'wconvert') : __('Not yet', 'wconvert')}</span></li>)}
              {minimum > 0 && <li><span>{sprintf(__('Minimum %d seconds on the page', 'wconvert'), minimum)}</span><span data-met={seconds >= minimum}>{seconds >= minimum ? __('Met', 'wconvert') : __('Not yet', 'wconvert')}</span></li>}
            </ul>}
          </>}
          {plan?.opening.mode === 'automatic' && plan.opening.rules.length > 1 && <p className="wconvert-sample-help">{plan.opening.match === 'all' ? __('All opening rules must match.', 'wconvert') : __('Any one opening rule can match.', 'wconvert')}</p>}
          {gestures.length > 0 && <div className="wconvert-sample-events">
            <p className="wconvert-sample-help">{__('Try an action with these values. If you change a value, try the action again.', 'wconvert')}</p>
            <div className="wconvert-sample-event-buttons">{gestures.map(rule => <Button variant="outline" key={String(rule.id)} onClick={() => { setIdle(0); setGesture(String(rule.id)); }}>
              {rule.type === 'exit_intent' ? __('Simulate exit intent', 'wconvert') : rule.type === 'scroll_up' ? __('Simulate scroll back up', 'wconvert') : `${__('Simulate click', 'wconvert')}: ${String(rule.selector ?? '')}`}
            </Button>)}</div>
          </div>}
        </section>}
        {(facts.length > 0 || hasAdBlocking) && <section aria-labelledby="wconvert-sample-visitor">
          <h3 id="wconvert-sample-visitor">{__('Visitor details', 'wconvert')}</h3>
          <p className="wconvert-sample-help">{__('For this pretend visitor, choose whether each condition is true.', 'wconvert')}</p>
          {hasAdBlocking && <label>{__('Ad-block status', 'wconvert')}
            <select value={adBlocking} onChange={event => change(setAdBlocking, event.target.value as typeof adBlocking)}>
              <option value="detected">{__('Detected', 'wconvert')}</option>
              <option value="not_detected">{__('Not detected', 'wconvert')}</option>
              <option value="unknown">{__('Unknown', 'wconvert')}</option>
              <option value="pending">{__('Checking', 'wconvert')}</option>
            </select>
          </label>}
          <div className="wconvert-sample-facts">{facts.map(rule => <label key={String(rule.id)}>
            <span>{phraseOf(rule as Rule, types).text}</span><select value={String(read(rule))} onChange={event => change(setAnswers, { ...answers, [String(rule.id)]: event.target.value === 'blocked' ? 'blocked' : event.target.value === 'true' })}>
              <option value="false">{__('Does not match', 'wconvert')}</option><option value="true">{__('Matches', 'wconvert')}</option><option value="blocked">{__('Consent not given', 'wconvert')}</option>
            </select></label>)}</div>
          {plan?.audience.mode === 'groups' && plan.audience.groups.length > 1 && <ul className="wconvert-sample-checks" aria-label={__('Audience groups', 'wconvert')}>
            {plan.audience.groups.map((group, index) => <li key={group.id}><span>{sprintf(__('Audience group %d', 'wconvert'), index + 1)} ({group.match.toUpperCase()})</span><span>{groupMatches(group, read) === true ? __('Matches', 'wconvert') : groupMatches(group, read) === 'blocked' ? __('Needs consent', 'wconvert') : __('Does not match', 'wconvert')}</span></li>)}
          </ul>}
        </section>}
        {plan?.opening.mode === 'immediate' && <p className="wconvert-sample-help">{__('This campaign opens immediately when the audience and other conditions allow it.', 'wconvert')}</p>}
        <details className="wconvert-sample-assumptions">
          <summary><span>{__('Other conditions', 'wconvert')}</span><span>{changedAssumptions ? sprintf(__('%d changed', 'wconvert'), changedAssumptions) : __('All allowed', 'wconvert')}</span></summary>
          <div className="wconvert-sample-assumption-body">
            <p className="wconvert-sample-help">{__('These are assumptions, not checks of your website. Leave them checked for a basic test; uncheck one to see how it blocks opening.', 'wconvert')}</p>
            <label><input type="checkbox" checked={page} onChange={event => change(setPage, event.target.checked)} /><span>{__('Page is allowed', 'wconvert')}</span></label>
            <label><input type="checkbox" checked={limits} onChange={event => change(setLimits, event.target.checked)} /><span>{__('Schedule and page conditions allow opening', 'wconvert')}</span></label>
            <label><input type="checkbox" checked={completion} onChange={event => change(setCompletion, event.target.checked)} /><span>{__('Completion rules allow another appearance', 'wconvert')}</span></label>
            <label><input type="checkbox" checked={pacing} onChange={event => change(setPacing, event.target.checked)} /><span>{__('Repeat limits allow another appearance', 'wconvert')}</span></label>
            {plan?.opening.mode === 'click' && <p className="wconvert-sample-help">{__('Visitor clicks skip repeat limits. Audience, completion and the other conditions still apply.', 'wconvert')}</p>}
            <label><input type="checkbox" checked={goal} onChange={event => change(setGoal, event.target.checked)} /><span>{__('Required goal conditions are met', 'wconvert')}</span></label>
          </div>
        </details>
      </div>
      <div className="wconvert-sample-footer">
        <p>{__('Uses your current draft. No real popup opens or visit is recorded.', 'wconvert')}</p>
        <Button variant="outline" onClick={reset}>{__('Reset sample', 'wconvert')}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function SampleNumber({ id, label, unit, value, max, onChange }: { id: string; label: string; unit: string; value: number; max?: number; onChange: (next: number) => void }) {
  return <div className="wconvert-sample-field"><Label htmlFor={id}>{label}</Label>
    <div><Input id={id} type="number" min={0} max={max} value={value} aria-describedby={`${id}-unit`}
      onChange={event => { const next = Number(event.target.value); onChange(Number.isFinite(next) ? Math.max(0, Math.min(max ?? Infinity, next)) : 0); }} />
      <span id={`${id}-unit`}>{unit}</span></div>
  </div>;
}

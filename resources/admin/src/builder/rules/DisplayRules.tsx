import { __, sprintf } from '@wordpress/i18n';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { ConvertingAct } from '../structure/catalogue';
import type { DisplayPlan } from '@loader/display-rules';
import { FlaskConical } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { HowOften } from './HowOften';
import { StartingPoints, patchOf, affectedSections, type BundlePatch } from './StartingPoints';
import { Where } from './Where';
import { AudienceEditor } from './AudienceEditor';
import { OpeningEditor } from './OpeningEditor';
import { summarise, type DisplayRulesValue } from './summaries';
import { targetingSummary } from './targetingSummary';
import { freshRule, incompletePlan, newRuleId } from './plan';
import type { Rule, RuleVocabulary } from '../api';

const SampleVisit = lazy(() => import('./SampleVisit'));
export type { DisplayRulesValue } from './summaries';
export interface DisplayRulesProps {
  readonly compact?: boolean;
  readonly vocabulary: RuleVocabulary;
  readonly value: DisplayRulesValue;
  readonly overlay: boolean;
  readonly act?: ConvertingAct;
  readonly audienceRequirement?: string | null;
  readonly initialSection?: string;
  readonly onSectionChange?: (section: string) => void;
  readonly onChange: (patch: Partial<DisplayRulesValue>) => void;
  readonly reopenEnabled?: boolean;
  readonly placement?: { readonly summary: string; readonly controls: ReactNode };
  readonly reveal?: { readonly id: string; readonly focus?: string } | null;
}

/** One canonical draft; navigation and the summary are views of it. */
export function DisplayRules({ vocabulary, value, overlay, act = 'submit', onChange, reveal, placement, audienceRequirement, initialSection, onSectionChange, reopenEnabled, compact = false }: DisplayRulesProps) {
  const summaries = summarise(value, vocabulary, overlay, act);
  const [active, setActive] = useState(() => initialSection ?? summaries.find(section => section.attention)?.id ?? 'when');
  const [testing, setTesting] = useState(false);
  const plan = value.display_rules;
  useEffect(() => { onSectionChange?.(active); }, [active, onSectionChange]);
  useEffect(() => {
    if (!reveal) return;
    setActive(reveal.id === 'placement' ? 'where' : reveal.id);
    const frame = requestAnimationFrame(() => document.getElementById(reveal.focus ?? 'wconvert-display-heading')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [reveal]);
  const current = summaries.find(section => section.id === active) ?? summaries[0];
  const update = (next: DisplayPlan) => onChange({ display_rules: next });
  const audienceTypes = [...vocabulary.conditions, ...vocabulary.targeting.filter(type => type.kind === 'visitor')];

  return <div className="wconvert-display" data-compact={compact || undefined}>
    <div className="wconvert-display-header">
      {!compact && <h2>{__('Display setup', 'wconvert')}</h2>}
      <div className="wconvert-display-actions">
        <StartingPoints bundles={vocabulary.bundles} describe={bundle => {
          const nextValue = { ...value, ...applied(patchOf(bundle), value) };
          const next = summarise(nextValue, vocabulary, overlay, act);
          return summaries.filter(axis => affectedSections(bundle).includes(axis.id)).map(axis => ({ label: axis.eyebrow,
            before: axis.id === 'where' ? targetingSummary(value.targeting, vocabulary.targeting, 'review') : axis.text,
            after: axis.id === 'where' ? targetingSummary(nextValue.targeting, vocabulary.targeting, 'review') : next.find(each => each.id === axis.id)!.text }));
        }} onApply={patch => onChange(applied(patch, value))} />
      </div>
    </div>
    {!plan && <div role="alert" className="wconvert-display-repair"><p>{__('This draft uses an older development rule format. Review and replace its display setup before saving or publishing.', 'wconvert')}</p>
      <Button onClick={() => update(incompletePlan())}>{__('Set up display rules', 'wconvert')}</Button></div>}
    <div className="wconvert-display-grid">
      {compact ? <label className="wconvert-journey__field">{__('Display setting', 'wconvert')}<select value={active} onChange={event => setActive(event.target.value)}>{summaries.map(section => <option key={section.id} value={section.id}>{section.eyebrow}{section.attention ? ` · ${__('Needs attention', 'wconvert')}` : ''}</option>)}</select></label> : <>
      <nav aria-label={__('Display setup sections', 'wconvert')}>
        {summaries.map((section, index) => <button type="button" key={section.id} aria-current={active === section.id ? 'step' : undefined}
          onClick={() => setActive(section.id)}><span className="wconvert-display-step" aria-hidden="true">{index + 1}</span><span>{section.eyebrow}
          <small>{section.attention ? __('Needs attention', 'wconvert') : section.id === 'how-often' ? repeatHint(value) : section.text}</small></span></button>)}
      </nav>
      </>}
      <section className="wconvert-display-editor" aria-labelledby="wconvert-display-heading">
        <h3 id="wconvert-display-heading" tabIndex={-1}>{current.eyebrow}</h3>
        {active === 'where' && <><Where types={vocabulary.targeting} targeting={value.targeting} onChange={targeting => onChange({ targeting })} />
          {placement && <div className="mt-6"><h4>{__('Placement', 'wconvert')}</h4>{placement.controls}</div>}</>}
        {audienceRequirement && active === 'who' && <p role="note">{audienceRequirement}</p>}
        {active === 'who' && plan && <AudienceEditor value={plan.audience} types={audienceTypes} onChange={audience => update({ ...plan, audience })} />}
        {active === 'when' && plan && <OpeningEditor value={plan.opening} types={vocabulary.triggers} onChange={opening => update({ ...plan, opening })} />}
        {active === 'how-often' && <HowOften act={act} frequency={value.frequency} schedule={value.schedule} priority={value.priority} overlay={overlay}
          reopenEnabled={reopenEnabled} onFrequency={frequency => onChange({ frequency })} onSchedule={schedule => onChange({ schedule })} onPriority={priority => onChange({ priority })} />}
      </section>
      <aside className="wconvert-display-summary" aria-label={__('Display summary', 'wconvert')}>
        <details open={!compact}><summary>{__('Your campaign will appear…', 'wconvert')}</summary>
        <dl>{summaries.map(section => <div key={section.id}><dt><button type="button" onClick={() => setActive(section.id)}>{section.eyebrow}</button></dt><dd>{section.text}</dd></div>)}</dl>
        <p className="text-note text-muted-foreground">{__('Page exclusions, required Goal conditions and site limits always apply.', 'wconvert')}</p>
        <Button variant="outline" className="wconvert-display-test" onClick={() => setTesting(true)}><FlaskConical aria-hidden="true" />{__('Test a sample visit', 'wconvert')}</Button>
        <p className="text-note text-muted-foreground">{__('This is your draft. Changes go live only when published.', 'wconvert')}</p>
        </details>
      </aside>
    </div>

    {testing && <Suspense fallback={<p role="status">{__('Loading sample tester…', 'wconvert')}</p>}><SampleVisit value={value} vocabulary={vocabulary} onClose={() => setTesting(false)} /></Suspense>}
  </div>;
}

/** A reviewed starting point changes only the sections it names, in one undo step. */
function applied(patch: BundlePatch, value: DisplayRulesValue): Partial<DisplayRulesValue> {
  let plan = value.display_rules ?? incompletePlan();
  if (patch.triggers !== undefined) {
    const rules = patch.triggers.map(rule => freshRule(rule as Rule));
    const immediate = rules.some(rule => rule.type === 'page_load');
    const click = rules.length > 0 && rules.every(rule => rule.type === 'click_element');
    plan = { ...plan, opening: immediate ? { mode: 'immediate' } : click ? { mode: 'click', rules } : { mode: 'automatic', match: 'any', rules, minimum_seconds: 0 } };
  }
  if (patch.conditions !== undefined) plan = { ...plan, audience: patch.conditions.length ? { mode: 'groups', groups: [{ id: newRuleId(), match: 'all', rules: patch.conditions.map(rule => freshRule(rule as Rule)) }] } : { mode: 'everyone' } };
  return { ...(patch.triggers !== undefined || patch.conditions !== undefined ? { display_rules: plan } : {}),
    ...(patch.targeting !== undefined ? { targeting: patch.targeting } : {}), ...(patch.frequency !== undefined ? { frequency: patch.frequency } : {}) };
}

/** Navigation needs the main pacing choice; the adjacent summary carries every stop. */
function repeatHint({ frequency, schedule }: DisplayRulesValue): string {
  if (schedule.starts_at || schedule.ends_at) return __('Scheduled dates', 'wconvert');
  if (frequency.cooldownDays) return sprintf(__('Every %d days at most', 'wconvert'), frequency.cooldownDays);
  if (frequency.maxPerSession === 1) return __('Once per tab session', 'wconvert');
  if (frequency.maxPerSession) return sprintf(__('%d per tab session', 'wconvert'), frequency.maxPerSession);
  return __('Every eligible page', 'wconvert');
}

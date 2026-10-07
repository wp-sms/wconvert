import { __ } from '@wordpress/i18n';
import { Fragment, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Template } from '@renderer/types';
import type { ConvertingAct } from '../structure/catalogue';
import type { DisplayPlan } from '@loader/display-rules';
import { FlaskConical } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { HowOften } from './HowOften';
import { Dates } from './Dates';
import { Where } from './Where';
import { AudienceEditor } from './AudienceEditor';
import { OpeningEditor } from './OpeningEditor';
import { QuickPicks } from './QuickPicks';
import { pickFor, SECTIONS, switchPick, type Pick, type SectionId } from './picks';
import { sentenceParts, type SentencePart } from './sentence';
import { questions, summarise, type DisplayRulesValue } from './summaries';
import { incompletePlan } from './plan';
import type { RuleVocabulary } from '../api';

const SampleVisit = lazy(() => import('./SampleVisit'));
export type { DisplayRulesValue } from './summaries';
export interface DisplayRulesProps {
  readonly compact?: boolean;
  readonly template?: Template;
  readonly cartRequired?: boolean;
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

/** The parts of the value a pick reads. A change to them that this screen did not make is an undo or redo. */
const signature = ({ display_rules, targeting, frequency, schedule }: DisplayRulesValue): string =>
  JSON.stringify([display_rules, targeting, frequency, schedule]);

const sectionOf = (id: string | undefined): SectionId | undefined =>
  id === 'placement' ? 'where' : SECTIONS.find(section => section === id);

/**
 * Five plain questions, one open at a time, each answered by a [[Quick pick]]
 * or by the full rule builder behind Custom… (ADR 0129).
 *
 * One canonical draft; the sentence, the menu and the picks are all views of
 * it. The only state here is which section is open and, while it stays open,
 * which open pick the merchant chose — the sticky rule in {@see pickFor}.
 */
export function DisplayRules({ vocabulary, value, overlay, act = 'submit', onChange, reveal, placement, audienceRequirement, initialSection, onSectionChange, reopenEnabled, compact = false, template, cartRequired = false }: DisplayRulesProps) {
  const summaries = summarise(value, vocabulary);
  const asked = questions();
  const [active, setActive] = useState<SectionId>(() => sectionOf(initialSection) ?? summaries.find(section => section.attention)?.id ?? 'where');
  const [chosen, setChosen] = useState<Partial<Record<SectionId, string>>>({});
  const [testing, setTesting] = useState(false);
  const ours = useRef<string | null>(null);
  const plan = value.display_rules;

  useEffect(() => { onSectionChange?.(active); }, [active, onSectionChange]);
  // Undo, redo or any edit from elsewhere: every section derives its pick again.
  useEffect(() => {
    const now = signature(value);
    if (ours.current !== null && now !== ours.current) setChosen({});
    ours.current = now;
  }, [value]);
  useEffect(() => {
    if (!reveal) return;
    const section = sectionOf(reveal.id);
    if (section === undefined) return;
    setActive(section);
    setChosen(section === 'dates' && reveal.focus ? { dates: 'between' } : {});
    const frame = requestAnimationFrame(() => document.getElementById(reveal.id === 'placement' ? 'wconvert-display-placement' : reveal.focus ?? 'wconvert-display-heading')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [reveal]);

  const open = (section: SectionId) => { setActive(section); setChosen({}); };
  const shown = pickFor(active, value, vocabulary, chosen[active]);
  const write = (patch: Partial<DisplayRulesValue>) => {
    ours.current = signature({ ...value, ...patch });
    onChange(patch);
  };
  // An edit inside an open pick's editor keeps that pick, even where the pick was derived.
  const change = (patch: Partial<DisplayRulesValue>) => {
    if (shown.open && chosen[active] === undefined) setChosen(previous => ({ ...previous, [active]: shown.id }));
    write(patch);
  };
  const update = (next: DisplayPlan) => change({ display_rules: next });
  const choose = (pick: Pick) => {
    setChosen(previous => ({ ...previous, [active]: pick.id }));
    const patch = switchPick(shown, pick, value);
    if (Object.keys(patch).length > 0) write(patch);
  };
  const audienceTypes = [...vocabulary.conditions, ...vocabulary.targeting.filter(type => type.kind === 'visitor')];
  const parts = sentenceParts(value, vocabulary);
  // The connecting words stay plain; each answer is a phrase that opens its question.
  const phrase = (part: SentencePart) => <Fragment key={part.section}>{interpolate(part.frame, [
    <button type="button" className="wconvert-display-token" key={part.section} title={asked[part.section]}
      aria-current={active === part.section || undefined} data-attention={part.attention || undefined} onClick={() => open(part.section)}>{part.text}</button>,
  ])}</Fragment>;
  const current = summaries.find(section => section.id === active) ?? summaries[0];
  // Who and When have nothing to pick from until an older draft's rules are replaced.
  const picking = plan !== undefined || active === 'where' || active === 'how-often' || active === 'dates';

  return <div className="wconvert-display" data-compact={compact || undefined}>
    <div className="wconvert-display-header">
      <p className="wconvert-display-sentence" aria-live="polite">
        {interpolate(
          /* translators: 1: where it shows, e.g. “on every page”. 2: who sees it, e.g. “to everyone”. 3: when it opens, e.g. “after 15 seconds”. 4: how often, e.g. “once per visit”. */
          __('Shows %1$s %2$s, %3$s, %4$s.', 'wconvert'), [phrase(parts.where), phrase(parts.who), phrase(parts.when), phrase(parts.often)])}
        {parts.dates && <> {phrase(parts.dates)}</>}
      </p>
      <Button variant="outline" onClick={() => setTesting(true)}><FlaskConical aria-hidden="true" />{__('Test a visit', 'wconvert')}</Button>
    </div>
    {!plan && <div role="alert" className="wconvert-display-repair"><p>{__('This draft uses an older development rule format. Review and replace its display setup before saving or publishing.', 'wconvert')}</p>
      <Button onClick={() => update(incompletePlan())}>{__('Set up display rules', 'wconvert')}</Button></div>}
    <div className="wconvert-display-grid">
      {compact ? <label className="wconvert-journey__field">{__('Display setting', 'wconvert')}<select value={active} onChange={event => open(event.target.value as SectionId)}>
        {summaries.map(section => <option key={section.id} value={section.id}>{section.eyebrow}{section.attention ? ` · ${__('Needs attention', 'wconvert')}` : ''}</option>)}</select></label>
        : <nav aria-label={__('Display rules', 'wconvert')}>
          {summaries.map(section => <button type="button" key={section.id} aria-current={active === section.id ? 'true' : undefined} onClick={() => open(section.id)}>
            <span>{section.eyebrow}</span>
            <small data-attention={section.attention || undefined}>{section.attention ? __('Needs attention', 'wconvert') : section.text}</small>
          </button>)}
        </nav>}
      <section className="wconvert-display-editor" aria-labelledby="wconvert-display-heading">
        <h3 id="wconvert-display-heading" tabIndex={-1}>{current.eyebrow}</h3>
        {active === 'who' && audienceRequirement && <p role="note">{audienceRequirement}</p>}
        {picking && <QuickPicks key={active} section={active} question={current.eyebrow} value={value} vocabulary={vocabulary} shown={shown}
          onChoose={choose} onParam={n => write(shown.apply(value, n))}
          note={active === 'how-often' && shown.id === 'session' ? __('A visit ends when they close the tab.', 'wconvert') : null} />}
        {active === 'where' && <><Where types={vocabulary.targeting} targeting={value.targeting} showInclude={shown.id === 'selected'} onChange={targeting => (shown.open ? change : write)({ targeting })} />
          {placement && <div className="wconvert-display-placement"><h4 id="wconvert-display-placement" tabIndex={-1}>{__('Placement', 'wconvert')}</h4>{placement.controls}</div>}</>}
        {active === 'who' && plan && shown.open && <AudienceEditor value={plan.audience} types={audienceTypes} onChange={audience => update({ ...plan, audience })} />}
        {active === 'when' && plan && shown.open && <OpeningEditor value={plan.opening} types={vocabulary.triggers} onChange={opening => update({ ...plan, opening })} />}
        {active === 'how-often' && <HowOften act={act} frequency={value.frequency} priority={value.priority} overlay={overlay} reopenEnabled={reopenEnabled}
          custom={shown.open === true} onFrequency={frequency => change({ frequency })} onPriority={priority => change({ priority })} />}
        {active === 'dates' && shown.open && <Dates schedule={value.schedule} onSchedule={schedule => change({ schedule })} />}
      </section>
    </div>

    {testing && <Suspense fallback={<p role="status">{__('Loading sample tester…', 'wconvert')}</p>}><SampleVisit template={template} cartRequired={cartRequired} value={value} vocabulary={vocabulary} onClose={() => setTesting(false)} /></Suspense>}
  </div>;
}

/**
 * A translated frame with `%1$s`-style slots, filled with elements.
 *
 * `sprintf` returns a string, and `@wordpress/element`'s `createInterpolateElement`
 * is not a dependency, so this is the one small thing it would have done: split
 * on the numbered placeholders and put each element where the translator put
 * its number. A bare `%s` reads as the first.
 */
function interpolate(frame: string, slots: readonly ReactNode[]): ReactNode {
  return frame.split(/(%(?:\d+\$)?s)/).map((piece, index) => {
    const slot = /^%(?:(\d+)\$)?s$/.exec(piece);
    return <Fragment key={index}>{slot ? slots[Number(slot[1] ?? 1) - 1] : piece}</Fragment>;
  });
}


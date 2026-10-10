import { __ } from '@wordpress/i18n';
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { ConvertingAct } from '../structure/catalogue';
import type { DisplayPlan } from '@loader/display-rules';
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

export type { DisplayRulesValue } from './summaries';
export interface DisplayRulesProps {
  readonly vocabulary: RuleVocabulary;
  readonly value: DisplayRulesValue;
  readonly overlay: boolean;
  readonly act?: ConvertingAct;
  readonly audienceRequirement?: string | null;
  readonly initialSection?: string;
  readonly onSectionChange?: (section: string) => void;
  readonly onChange: (patch: Partial<DisplayRulesValue>) => void;
  readonly reopenEnabled?: boolean;
  readonly placement?: {
    readonly summary: string;
    readonly controls: ReactNode;
    /**
     * Automatic placement or a content lock is chosen. Both insert the campaign
     * as the page loads, so *When does it open?* is held at Right away and
     * Readiness never has to block on it.
     */
    readonly opensRightAway?: boolean;
    /** Which of the two holds it, so the reason names what the merchant chose. */
    readonly heldBy?: 'automatic' | 'content_lock';
  };
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
export function DisplayRules({ vocabulary, value, overlay, act = 'submit', onChange, reveal, placement, audienceRequirement, initialSection, onSectionChange, reopenEnabled }: DisplayRulesProps) {
  const summaries = summarise(value, vocabulary);
  const asked = questions();
  const [active, setActive] = useState<SectionId>(() => sectionOf(initialSection) ?? summaries.find(section => section.attention)?.id ?? 'where');
  const [chosen, setChosen] = useState<Partial<Record<SectionId, string>>>({});
  const ours = useRef<string | null>(null);
  const heldId = useId();
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
  // Choosing the placement already wrote Right away; this keeps it there, so the refusal is here rather than at Publish.
  const held = active === 'when' && placement?.opensRightAway ? { pick: 'immediate', reason: placement.heldBy === 'content_lock' ? __('A content lock opens right away.', 'wconvert') : __('Automatic placement opens right away.', 'wconvert'), id: heldId } : null;

  return <div className="wconvert-display">
    <div className="wconvert-display-header">
      <p className="wconvert-display-sentence">
        {interpolate(
          /* translators: 1: where it shows, e.g. “on every page”. 2: who sees it, e.g. “to everyone”. 3: when it opens, e.g. “after 15 seconds”. 4: how often, e.g. “once per visit”. */
          __('Shows %1$s %2$s, %3$s, %4$s.', 'wconvert'), [phrase(parts.where), phrase(parts.who), phrase(parts.when), phrase(parts.often)])}
        {parts.dates && <> {phrase(parts.dates)}</>}
      </p>
    </div>
    {!plan && <div role="alert" className="wconvert-display-repair"><p>{__('This draft uses an older development rule format. Review and replace its display setup before saving or publishing.', 'wconvert')}</p>
      <Button onClick={() => update(incompletePlan())}>{__('Set up display rules', 'wconvert')}</Button></div>}
    <div className="wconvert-display-grid">
      <nav aria-label={__('Display rules', 'wconvert')}>
          {summaries.map(section => <button type="button" key={section.id} aria-current={active === section.id ? 'true' : undefined} onClick={() => open(section.id)}>
            <span>{section.eyebrow}</span>
            <small data-attention={section.attention || undefined}>{section.attention ? __('Needs attention', 'wconvert') : section.text}</small>
          </button>)}
        </nav>
      <section className="wconvert-display-editor" aria-labelledby="wconvert-display-heading">
        <h3 id="wconvert-display-heading" tabIndex={-1}>{current.eyebrow}</h3>
        {active === 'who' && audienceRequirement && <p role="note">{audienceRequirement}</p>}
        {picking && <QuickPicks key={active} section={active} question={current.eyebrow} value={value} vocabulary={vocabulary} shown={shown}
          onChoose={choose} onParam={n => write(shown.apply(value, n))} held={held}
          note={active === 'how-often' && shown.id === 'session' ? __('A visit ends when they close the tab.', 'wconvert') : null} />}
        {active === 'where' && <><Where types={vocabulary.targeting} targeting={value.targeting} showInclude={shown.id === 'selected'} onChange={targeting => (shown.open ? change : write)({ targeting })} />
          {placement && <div className="wconvert-display-placement"><h4 id="wconvert-display-placement" tabIndex={-1}>{__('Placement', 'wconvert')}</h4>{placement.controls}</div>}</>}
        {active === 'who' && plan && shown.open && <AudienceEditor value={plan.audience} types={audienceTypes} onChange={audience => update({ ...plan, audience })} />}
        {active === 'when' && plan && shown.open && <OpeningEditor value={plan.opening} types={vocabulary.triggers} heldBy={held?.id} onChange={opening => update({ ...plan, opening })} />}
        {active === 'how-often' && <HowOften act={act} frequency={value.frequency} priority={value.priority} overlay={overlay} reopenEnabled={reopenEnabled}
          custom={shown.open === true} onFrequency={frequency => change({ frequency })} onPriority={priority => change({ priority })} />}
        {active === 'dates' && shown.open && <Dates schedule={value.schedule} onSchedule={schedule => change({ schedule })} />}
      </section>
    </div>

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


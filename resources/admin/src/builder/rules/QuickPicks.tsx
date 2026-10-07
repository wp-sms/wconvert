import { useEffect, useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Lock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { renderingFor, tierName, tierProductName, unlessFree } from '../../goals/availability';
import { availabilityOf, halves, picksIn, type Pick, type PickParam, type SectionId } from './picks';
import { portableSelector } from './validation';
import type { DisplayRulesValue } from './summaries';
import type { RuleVocabulary } from '../api';

export interface QuickPicksProps {
  readonly section: SectionId;
  /** The question, as the group's accessible name. */
  readonly question: string;
  readonly value: DisplayRulesValue;
  readonly vocabulary: RuleVocabulary;
  /** The pick drawn as chosen — {@see pickFor}. */
  readonly shown: Pick;
  readonly onChoose: (pick: Pick) => void;
  /** The chosen pick's inline number or selector changed. */
  readonly onParam: (n: number | string) => void;
}

/**
 * One section's [[Quick pick]]s — native radios in a `role="group"`, drawn as
 * chips (GUIDELINES §7). The chosen chip carries its number inline.
 *
 * A pick this site cannot run is drawn but refused: choosing it, by click or by
 * arrowing onto it, leaves the value alone and says why. On a free install a
 * locked pick is not drawn at all (ADR 0116).
 */
export function QuickPicks({ section, question, value, vocabulary, shown, onChoose, onParam }: QuickPicksProps) {
  const [refused, setRefused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const errorId = useId();
  const name = useId();
  const picks = picksIn(section).map(pick => {
    const availability = availabilityOf(pick, vocabulary);
    return { pick, availability, rendering: renderingFor(availability.availability, 'settings_list') };
  }).filter(each => each.rendering !== 'hide');
  const refusal = picks.find(each => each.pick.id === refused);

  return <div className="wconvert-quick-picks-block">
    <div role="group" aria-label={question} className="wconvert-quick-picks">
      {picks.map(({ pick, availability, rendering }) => {
        const chosen = shown.id === pick.id;
        const offered = rendering === 'offer';
        return <label key={pick.id} className="wconvert-quick-pick" data-open={pick.open || undefined} aria-disabled={offered ? undefined : true}>
          <input type="radio" name={name} value={pick.id} checked={chosen} aria-disabled={offered ? undefined : true}
            aria-describedby={offered ? undefined : reasonId}
            onChange={() => { if (offered) { setRefused(null); onChoose(pick); } else setRefused(pick.id); }} />
          {chosen && pick.param ? <Inline template={pick.template()} param={pick.param} value={value} onChange={onParam} onError={setError} errorId={errorId} />
            : <span>{wordsOf(pick, shown, value)}</span>}
          {rendering === 'upsell' && <Badge variant="secondary"><Lock aria-hidden="true" />{tierName(availability.tier)}</Badge>}
          {rendering === 'explain' && <Badge variant="warning">{sprintf(
            /* translators: %s: a plugin's name, e.g. “WooCommerce”. */
            __('Needs %s', 'wconvert'), availability.requires_label ?? __('another plugin', 'wconvert'))}</Badge>}
        </label>;
      })}
    </div>
    {error !== null && shown.param && <p id={errorId} role="alert" className="wconvert-quick-picks__error">{error}</p>}
    {shown.param?.kind === 'selector' && !shown.param.read(value) && <p className="wconvert-quick-picks__hint">{__('Choose the button or link they click, such as #signup or .offer-button.', 'wconvert')}</p>}
    <p id={reasonId} className="wconvert-quick-picks__reason" role="status">{refusal === undefined ? null
      : refusal.rendering === 'upsell'
        /* translators: %s: a product name, e.g. “WConvert Pro”. */
        ? unlessFree(sprintf(__('Part of %s', 'wconvert'), tierProductName(refusal.availability.tier)))
        /* translators: %s: a plugin's name, e.g. “WooCommerce”. */
        : sprintf(__('Needs %s on this site', 'wconvert'), refusal.availability.requires_label ?? __('another plugin', 'wconvert'))}</p>
  </div>;
}

/** An unchosen chip reads the number choosing it would write. */
function wordsOf(pick: Pick, shown: Pick, value: DisplayRulesValue): string {
  if (pick.param === undefined) return pick.template();
  if (pick.param.kind !== 'number') return pick.label(value);
  const carried = shown.param?.key === pick.param.key ? shown.param.read(value) : undefined;
  return halves(pick.template()).join(String(carried ?? pick.param.default));
}

/**
 * The chosen chip's number or selector, inside the chip.
 *
 * The number keeps its own draft, so an empty field is allowed while typing. A
 * rule's number out of range is still written, so the section and Readiness
 * flag it; a `strict` one is not, because nothing downstream would.
 */
function Inline({ template, param, value, onChange, onError, errorId }: {
  template: string; param: PickParam; value: DisplayRulesValue; onChange: (n: number | string) => void; onError: (error: string | null) => void; errorId: string;
}) {
  const [before, after] = halves(template);
  const stored = param.read(value);
  const [draft, setDraft] = useState(stored === undefined ? '' : String(stored));
  useEffect(() => {
    setDraft(current => param.kind === 'number' && current !== '' && Number(current) === stored ? current : stored === undefined ? '' : String(stored));
  }, [stored, param.kind]);

  const number = Number(draft);
  const error = param.kind === 'selector'
    ? (draft.trim() !== '' && !portableSelector(draft) ? __('Use an ID, class, tag or attribute selector, such as #signup or .offer-button.', 'wconvert') : null)
    : draft === '' || !Number.isInteger(number) || number < (param.min ?? -Infinity) || number > (param.max ?? Infinity)
      /* translators: 1: the lowest number allowed. 2: the highest. */
      ? sprintf(__('Enter a whole number from %1$d to %2$d.', 'wconvert'), param.min ?? 0, param.max ?? 0) : null;
  useEffect(() => { onError(error); }, [error, onError]);
  useEffect(() => () => onError(null), [onError]);

  return <>
    <span>{before}</span>
    {param.kind === 'number'
      ? <input type="number" className="wconvert-quick-pick__number" aria-label={param.label()} min={param.min} max={param.max} value={draft}
        aria-invalid={error !== null || undefined} aria-describedby={error !== null ? errorId : undefined}
        onChange={event => {
          setDraft(event.target.value);
          const next = Number(event.target.value);
          const inRange = Number.isInteger(next) && next >= (param.min ?? -Infinity) && next <= (param.max ?? Infinity);
          if (event.target.value !== '' && Number.isFinite(next) && (inRange || !param.strict)) onChange(next);
        }} />
      : <input type="text" className="wconvert-quick-pick__selector" aria-label={param.label()} placeholder="#signup" value={draft} spellCheck={false}
        aria-invalid={error !== null || undefined} aria-describedby={error !== null ? errorId : undefined}
        onChange={event => { setDraft(event.target.value); onChange(event.target.value); }} />}
    <span>{after}</span>
  </>;
}

import type { Ref } from 'react';
import { Check, CircleHelp, FileText, Flag, Send } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import { JourneyIssueMarker } from '../JourneyIssueMarker';
import type { CampaignIssue } from '../readiness/campaignIssues';
import { endingWords, kindWord, type CardKind, type FlowCard as Card, type FlowGroupBox, type Priority } from '../structure/flowModel';
import type { Rect } from '../structure/flowLayout';
import type { TraceState } from './FlowLines';

export const kindIcon = { question: CircleHelp, message: FileText, form: Send, result: Flag, ending: Check } satisfies Record<CardKind, unknown>;

/** "Then → X": a directional glyph, so it is mirrored in RTL (GUIDELINES §15). */
const Arrow = () => <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>;

export interface NodeProps {
  box: Rect; rtl: boolean; state: TraceState; active: boolean; issues: readonly CampaignIssue[];
  onIssue?(issue: CampaignIssue): void; onSelect(index: number): void; onSelectPath(index: number, priority: Priority): void;
  onFocusNode(): void; focusRef: Ref<HTMLButtonElement>; measureRef: Ref<HTMLDivElement>;
}

/** One screen: kind, name, who sees it and where it goes (ADR 0142). Only the active card is in the tab order. */
export function FlowCard({ card, selected, destinationSummary, shownResult, box, rtl, state, active, issues, onIssue, onSelect, onSelectPath, onFocusNode, focusRef, measureRef }: NodeProps & {
  card: Card; selected: boolean; destinationSummary?: string; shownResult?: string;
}) {
  const Icon = kindIcon[card.kind];
  const tab = active ? 0 : -1;
  const shown = card.results?.slice(0, 3) ?? [];
  return <div ref={measureRef} className="wconvert-flow-card" data-flow-node={card.id} data-kind={card.kind} data-colour={card.colour} data-state={state}
    data-unreachable={card.unreachable || undefined} data-selected={selected || undefined} dir={rtl ? 'rtl' : 'ltr'}
    style={{ left: box.x, top: box.y, width: box.width }}>
    <button ref={focusRef} type="button" className="wconvert-flow-card__main" data-flow-key={card.id} tabIndex={tab} aria-current={selected ? 'true' : undefined}
      aria-label={card.label} onClick={() => onSelect(card.index)} onFocus={onFocusNode}>
      <span className="wconvert-flow-card__kind"><span className="wconvert-flow-tile" data-kind={card.kind} aria-hidden="true"><Icon /></span>
        {kindWord(card.kind)}{card.first ? ` · ${__('First screen', 'wconvert')}` : card.multi ? ` · ${__('Choose several', 'wconvert')}` : ''}{card.optional ? ` · ${__('Optional', 'wconvert')}` : ''}</span>
      <strong className="wconvert-flow-card__name"><bdi>{card.name}</bdi></strong>
      {card.unreachable ? <span className="wconvert-flow-chip" data-warn="true">{__('No line reaches this screen', 'wconvert')}</span>
        : card.onlyIf && <span className="wconvert-flow-chip" data-colour={card.onlyIf.colour}><bdi>{sprintf(/* translators: %s: a rule, e.g. “Interests includes Growing”. */ __('Only if %s', 'wconvert'), card.onlyIf.text)}</bdi></span>}
      {card.kind === 'form' && <span className="wconvert-flow-card__sub"><b>{card.optional ? __('Can save', 'wconvert') : __('Saves the lead', 'wconvert')}</b>{destinationSummary ? <span>· <bdi>{destinationSummary}</bdi></span> : null}</span>}
      {shown.map(result => <span key={result.id} className="wconvert-flow-card__sub" data-shown={shownResult === result.id || undefined}>
        <span className="wconvert-flow-dot" data-colour={result.colour} aria-hidden="true" /><span className="wconvert-flow-card__result"><bdi>{result.heading}</bdi>
        {result.fallback && <small> · {__('all other answers', 'wconvert')}</small>}
        {result.needsCondition && <small data-problem="true"> · {__('needs a condition', 'wconvert')}</small>}</span>
      </span>)}
      {(card.results?.length ?? 0) > 3 && <span className="wconvert-flow-card__sub">{sprintf(/* translators: %d: how many more results. */ __('+%d more · first match wins', 'wconvert'), card.results!.length - 3)}</span>}
    </button>
    {card.kind === 'ending' || card.kind === 'result' && !card.then && !card.linesText
      ? <span className="wconvert-flow-card__foot" data-early={card.endsWithout ? 'true' : undefined}>{endingWords(card.endsWithout)}</span>
      : card.missingThen ? <button type="button" className="wconvert-flow-card__foot" data-problem="true" tabIndex={tab} onClick={() => onSelectPath(card.index, card.fallbackPriority)}>{__('Choose where visitors go', 'wconvert')}</button>
        : card.linesText ? <button type="button" className="wconvert-flow-card__foot" tabIndex={tab} onClick={() => onSelectPath(card.index, card.linePriority ?? 0)}>{card.linesText}</button>
          : card.then && <button type="button" className="wconvert-flow-card__foot" tabIndex={tab} onClick={() => onSelectPath(card.index, card.then!.priority)}>
            {__('Then', 'wconvert')} <Arrow /> <b><bdi>{card.then.name}</bdi></b></button>}
    {card.skip && <button type="button" className="wconvert-flow-card__foot" data-skip="true" tabIndex={tab} onClick={() => onSelectPath(card.index, 'hidden')}>
      {__('If skipped', 'wconvert')} <Arrow /> <b><bdi>{card.skip.name}</bdi></b></button>}
    <JourneyIssueMarker issues={issues} onIssue={onIssue} tabIndex={tab} />
  </div>;
}

/** Several follow-ups on one question: every match is asked, one at a time, then all continue (ADR 0142). */
export function FlowGroup({ group, selected, visited, box, rtl, state, active, issues, onIssue, onSelect, onSelectPath, onFocusNode, focusRef, measureRef, nextPriority }: NodeProps & {
  group: FlowGroupBox; selected: number | null; visited?: ReadonlySet<string>; nextPriority?: number;
}) {
  const tab = active ? 0 : -1;
  const target = group.members.find(member => member.index === selected) ?? group.members[0];
  const asked = visited ? group.members.filter(member => visited.has(member.id)).length : undefined;
  const last = group.members[group.members.length - 1];
  return <div ref={measureRef} role="group" aria-label={sprintf(/* translators: %s: the box's title. */ __('%s: every match is asked, one at a time', 'wconvert'), group.title)}
    className="wconvert-flow-group" data-flow-node={group.id} data-colour={group.colour} data-state={state} data-unreachable={group.unreachable || undefined}
    dir={rtl ? 'rtl' : 'ltr'} style={{ left: box.x, top: box.y, width: box.width }}>
    <span className="wconvert-flow-group__title"><span className="wconvert-flow-tile" data-kind="question" aria-hidden="true"><CircleHelp /></span><bdi>{group.title}</bdi></span>
    <span className="wconvert-flow-group__sub">{group.unreachable ? __('No line reaches these follow-ups', 'wconvert') : asked === undefined
      ? __('Every match, one at a time. Then all continue.', 'wconvert')
      : sprintf(/* translators: 1: how many follow-ups this visitor is asked. 2: how many there are. */ __('This visitor is asked %1$d of %2$d.', 'wconvert'), asked, group.members.length)}</span>
    {group.members.map((member, at) => <button key={member.id} ref={member === target ? focusRef : undefined} type="button" className="wconvert-flow-group__member"
      data-flow-key={member === target ? group.id : undefined} tabIndex={tab} aria-current={selected === member.index ? 'true' : undefined}
      data-state={visited ? visited.has(member.id) ? 'on' : 'off' : undefined} onClick={() => onSelect(member.index)} onFocus={onFocusNode}
      aria-label={sprintf(/* translators: 1: its place. 2: how many. 3: its name. 4: its answer. */ __('Follow-up %1$d of %2$d: %3$s, only if %4$s', 'wconvert'), at + 1, group.members.length, member.name, member.answer)
        + (visited ? `, ${visited.has(member.id) ? __('asked in this trace', 'wconvert') : __('skipped in this trace', 'wconvert')}` : '')}>
      <span className="wconvert-flow-dot" data-colour={member.colour} aria-hidden="true" /><strong><bdi>{member.name}</bdi></strong><small><bdi>{member.answer}</bdi></small>
      {issues.some(issue => issue.screenId === member.id) && <span className="wconvert-flow-group__issue" aria-hidden="true">{issues.filter(issue => issue.screenId === member.id).length}</span>}
    </button>)}
    {nextPriority !== undefined && <button type="button" className="wconvert-flow-card__foot" tabIndex={tab} onClick={() => onSelectPath(last.index, nextPriority)}>
      {__('Then', 'wconvert')} <Arrow /> <b><bdi>{group.nextName}</bdi></b></button>}
    <JourneyIssueMarker issues={issues} onIssue={onIssue} tabIndex={tab} />
  </div>;
}

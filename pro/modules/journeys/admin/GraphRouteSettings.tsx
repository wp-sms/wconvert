import { followupGroups, followupGroupSource } from '@/builder/structure/followupGroups';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import type { JourneyGraphEdge, TemplateTree } from '@renderer/types';
import { ConfirmDialog } from '@/shell/ConfirmDialog';
import { ConditionSettings } from './JourneySettings';
import { graphEdgeId, graphTargets } from '@/builder/structure/graph';
import { answerLinesOverlap, conditionText } from '@/builder/structure/conditionText';
import { graphChangeImpact } from '@/builder/structure/graphChangeImpact';
import { graphChoiceSources } from '@/builder/structure/graphConnections';
import { questionsIn, unreachableScreens } from '@/builder/structure/journey';
import { answerColorOf, answerColors } from '@/builder/structure/flowModel';
import { graphInsertionLocations } from './structure/graphInsertion';
import { FieldHeading, PanelHint } from '@/builder/PanelSection';

/** A keyboard-complete editor for the actual v3 connections, not array order. */
export function GraphRouteSettings({ tree, step, focusPath, focusTarget = false, onChange, onInsert, onOpenInsert, onAdd, onSelect }: {
  tree: TemplateTree; step: number; focusPath?: number | 'hidden' | null; onChange(next: TemplateTree): void;
  focusTarget?: boolean; onSelect?(index: number): void;
  onInsert(edgeId: string, kind: 'content' | 'input'): void; onOpenInsert?(edgeId: string): void; onAdd?(intent: 'followup' | 'branch'): void;
}) {
  const graph = tree.graph;
  const screen = tree.steps[step];
  const list = useRef<HTMLOListElement>(null);
  const skipId = useId();
  const hiddenSelect = useRef<HTMLSelectElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  useEffect(() => { setConnectionsOpen(false); }, [step]);
  const [pending, setPending] = useState<{ tree: TemplateTree; description: string } | null>(null);
  useEffect(() => {
    if (focusPath === null || focusPath === undefined) return;
    if (focusPath === 'hidden') { hiddenSelect.current?.focus(); return; }
    const row = list.current?.querySelector<HTMLElement>(`[data-path-priority="${focusPath}"]`);
    const disclosure = row?.querySelector('details'); if (disclosure) disclosure.open = true;
    row?.scrollIntoView?.({ block: 'nearest' });
    if (focusTarget) { row?.querySelector<HTMLElement>('[data-route-target]')?.focus(); return; }
    const clause = row?.querySelector<HTMLElement>('.wconvert-journey-settings__clause');
    const invalidChoice = [...(clause?.querySelectorAll<HTMLSelectElement>('select:not(:disabled)') ?? [])]
      .find(select => select.selectedOptions[0]?.disabled);
    (invalidChoice ?? clause?.querySelector<HTMLElement>('.wconvert-journey-settings__answers input')
      ?? clause?.querySelector<HTMLElement>('select:last-of-type')
      ?? row?.querySelector<HTMLElement>('select'))?.focus();
  }, [focusPath, step, focusTarget]);
  if (!graph || !screen) return null;
  const routes = graph.edges.filter(edge => edge.from === screen.id);
  const locations = graphInsertionLocations(tree);
  const canAsk = (edgeId: string) => locations.find(item => item.id === `edge:${edgeId}`)?.canAsk === true;
  const questionAfterSave = routes.some(edge => edge.kind !== 'hidden' && !canAsk(edge.id));
  const answers = routes.filter(edge => edge.kind === 'answer');
  const fallback = routes.find(edge => edge.kind === 'default');
  const groups = followupGroups(tree);
  const memberGroup = groups.find(item => item.screens.includes(step));
  const group = memberGroup ?? (!answers.length ? groups.find(item => followupGroupSource(tree, item) === step) : undefined);
  const hidden = routes.find(edge => edge.kind === 'hidden');
  const overlap = answerLinesOverlap(tree, answers);
  // The color each answer line has on the Flow map (ADR 0142).
  const { colors } = answerColors(tree, questionsIn(screen.content)[0]?.id);
  const targets = graphTargets(tree, screen.id);
  const sources = graphChoiceSources(tree, screen.id);
  const apply = (next: readonly JourneyGraphEdge[]) => {
    const changed = { ...tree, graph: { ...graph, edges: [...graph.edges.filter(edge => edge.from !== screen.id), ...next] } };
    const description = graphChangeImpact(tree, changed);
    if (description) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPending({ tree: changed, description });
    }
    else onChange(changed);
  };
  // `null` removes the skip override, so a skipped screen falls through again (ADR 0135).
  const write = (nextAnswers: readonly JourneyGraphEdge[], nextFallback = fallback, nextHidden: JourneyGraphEdge | null | undefined = hidden) =>
    apply([...nextAnswers, ...(nextFallback ? [nextFallback] : []), ...(nextHidden ? [nextHidden] : [])]);
  const add = () => {
    const question = sources[0];
    if (!fallback || !question) return;
    const used = new Set(answers.flatMap(edge => edge.when?.clauses.filter(clause => clause.question === question.id).flatMap(clause => clause.values) ?? []));
    const value = question.options?.find(option => !used.has(option.value))?.value ?? question.options?.[0]?.value ?? '';
    const target = targets.find(candidate => candidate.id !== fallback.to)?.id ?? fallback.to;
    write([...answers, { id: graphEdgeId(graph), from: screen.id, to: target, kind: 'answer',
      when: { match: 'all', clauses: [{ question: question.id,
        operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [value] }] } }]);
  };
  if (!routes.length && ['result', 'acknowledgement'].includes(screen.kind)) return <div className="wconvert-journey-settings wconvert-journey-routes"><PanelHint>{__('The campaign ends here.', 'wconvert-pro')}</PanelHint></div>;
  /*
    **No heading of its own** (ADR 0136): the section around it names it
    ("Where visitors go next", "Paths") and carries the explainer as an
    InfoTip. Only follow-up groups, which behave differently, say so here.
  */
  return <div className="wconvert-journey-settings wconvert-journey-routes">
    {group && <><FieldHeading as="span" label={__('Follow-ups', 'wconvert-pro')} /><PanelHint>{__('Every match, one at a time. Then all continue.', 'wconvert-pro')}</PanelHint></>}
    {group && <div className="wconvert-followup-continuation">
      {!memberGroup && group.screens.map(index => <button type="button" key={tree.steps[index].id} onClick={() => onSelect?.(index)}><strong>{tree.steps[index].name}</strong><small>{conditionText(tree, tree.steps[index].when!)}</small></button>)}
      <label>{__('After the follow-ups', 'wconvert-pro')}<select value={group.next} onChange={event => {
        const last = tree.steps[group.screens[group.screens.length - 1]].id;
        const next = { ...tree, graph: { ...graph, edges: graph.edges.map(edge => edge.from === last && ['default', 'hidden'].includes(edge.kind) ? { ...edge, to: event.target.value } : edge) } };
        const description = graphChangeImpact(tree, next);
        if (description) { returnFocus.current = event.currentTarget; setPending({ tree: next, description }); } else onChange(next);
      }}>{graphTargets(tree, tree.steps[group.screens[group.screens.length - 1]].id).map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
      <button type="button" aria-expanded={connectionsOpen || focusPath != null} onClick={() => setConnectionsOpen(value => !value)}>{connectionsOpen || focusPath != null ? __('Hide answer lines', 'wconvert-pro') : __('Show answer lines', 'wconvert-pro')}</button>
    </div>}
    <div hidden={!!group && !connectionsOpen && focusPath == null}>
    {group && <PanelHint className="wconvert-journey-settings__warning">{__('Changing one line can separate this question from its follow-ups.', 'wconvert-pro')}</PanelHint>}
    {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Preserve list semantics in WebKit when list-style is none. */}
    <ol ref={list} className="wconvert-journey-routes__list" role="list">{[...answers, ...(fallback ? [fallback] : [])].map((edge, priority) => <li key={edge.id} className="wconvert-journey-routes__disclosure" data-path-priority={priority}>
      <details className="wconvert-journey-path-disclosure" open={focusPath === priority || !answers.length}>
      <summary><span className="wconvert-journey-path-disclosure__priority">{edge.kind === 'answer' ? priority + 1 : '↳'}</span><span><strong>{edge.kind === 'answer' && <span className="wconvert-flow-dot" data-color={answerColorOf(colors, edge.when)} aria-hidden="true" />}{edge.kind === 'default' ? answers.length ? __('All other answers', 'wconvert-pro') : group && !memberGroup ? __('Any of these', 'wconvert-pro') : __('Everyone', 'wconvert-pro') : edge.when ? conditionText(tree, edge.when) : __('Choose an answer condition', 'wconvert-pro')}</strong><small>{sprintf(/* translators: %s: a screen's name. */ __('Then → %s', 'wconvert-pro'), tree.steps.find(item => item.id === edge.to)?.name ?? __('Choose a screen', 'wconvert-pro'))}</small></span><ChevronDown className="wconvert-editor-disclosure-icon" aria-hidden="true" /></summary>
      <div className="wconvert-journey-path-disclosure__body">
      {edge.kind === 'answer' && <><strong>{sprintf(/* translators: 1: this line's place. 2: how many answer lines. */ __('Line %1$d of %2$d', 'wconvert-pro'), priority + 1, answers.length)}</strong>
        <ConditionSettings required purpose="route" value={edge.when ?? { match: 'all', clauses: [] }} sources={sources}
          onChange={when => { if (when) write(answers.map(item => item.id === edge.id ? { ...item, when } : item)); }} />
      </>}
      <label>{__('Then', 'wconvert-pro')}<select data-route-target value={edge.to} onChange={event => {
        const updated = { ...edge, to: event.target.value };
        // A skip edge that only copied the old destination goes, so the screen keeps falling through (ADR 0135).
        if (edge.kind === 'default') write(answers, updated, hidden && hidden.to === edge.to ? null : hidden);
        else write(answers.map(item => item.id === edge.id ? updated : item));
      }}>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label>
      {onSelect && <div className="wconvert-journey-route-destination">
        <button type="button" disabled={!tree.steps.some(item => item.id === edge.to)} onClick={() => onSelect(tree.steps.findIndex(item => item.id === edge.to))}>{sprintf(/* translators: %s: a screen's name. */ __('Open %s', 'wconvert-pro'), tree.steps.find(item => item.id === edge.to)?.name ?? '')}<ArrowRight aria-hidden="true" size={14} className="rtl:-scale-x-100"/></button>
      </div>}
      {tree.steps.find(item => item.id === edge.to)?.when && <p className="wconvert-journey-route-check">{sprintf(/* translators: %s: the screen's rule, e.g. “Interests includes Growing”. */ __('Only if %s', 'wconvert-pro'), conditionText(tree, tree.steps.find(item => item.id === edge.to)!.when!))}</p>}
      {onOpenInsert ? <button type="button" className="wconvert-journey-routes__insert" onClick={() => onOpenInsert(edge.id)}>{__('Add a screen on this line', 'wconvert-pro')}</button> : <>
      <button type="button" className="wconvert-journey-routes__insert" disabled={!canAsk(edge.id)} onClick={() => onInsert(edge.id, 'input')}>{__('Ask a question on this line', 'wconvert-pro')}</button>
      <button type="button" className="wconvert-journey-routes__insert" onClick={() => onInsert(edge.id, 'content')}>{__('Show a message on this line', 'wconvert-pro')}</button>
      </>}
      {edge.kind === 'answer' && <div className="wconvert-journey-routes__actions">
        <button type="button" disabled={priority === 0} onClick={() => { const next = [...answers]; [next[priority - 1], next[priority]] = [next[priority], next[priority - 1]]; write(next); }}>{__('Move up', 'wconvert-pro')}</button>
        <button type="button" disabled={priority === answers.length - 1} onClick={() => { const next = [...answers]; [next[priority], next[priority + 1]] = [next[priority + 1], next[priority]]; write(next); }}>{__('Move down', 'wconvert-pro')}</button>
        <button type="button" data-destructive="true" onClick={() => write(answers.filter(item => item.id !== edge.id))}>{__('Remove line', 'wconvert-pro')}</button>
      </div>}
      </div></details>
    </li>)}{!fallback && <li data-path-priority={answers.length}>
      <strong>{answers.length ? __('All other answers', 'wconvert-pro') : __('Then', 'wconvert-pro')}</strong>
      <p>{__('Choose where visitors go after this screen.', 'wconvert-pro')}</p>
      <label>{__('Then', 'wconvert-pro')}<select value="" onChange={event => {
        if (event.target.value) write(answers, { id: graphEdgeId(graph), from: screen.id, to: event.target.value, kind: 'default' });
      }}><option value="" disabled>{__('Choose a screen…', 'wconvert-pro')}</option>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label>
    </li>}</ol>
    {overlap && <p className="wconvert-panel-warn" role="status">{overlap.answers[0] === overlap.answers[1]
      ? sprintf(/* translators: 1: an answer. 2, 3: line numbers. */ __('Lines %2$d and %3$d both use “%1$s”. Visitors who pick it take line %2$d.', 'wconvert-pro'), overlap.answers[0], overlap.first + 1, overlap.second + 1)
      : sprintf(/* translators: 1, 2: answers. */ __('Someone who picks both “%1$s” and “%2$s” takes the first line: %1$s.', 'wconvert-pro'), overlap.answers[0], overlap.answers[1])}</p>}
    {questionAfterSave && <PanelHint>{__('Ask questions before this save so their answers are included.', 'wconvert-pro')}</PanelHint>}
    {fallback && sources.length > 0 && onAdd && <div className="wconvert-journey-next-actions"><button type="button" onClick={() => onAdd('followup')}>{__('Add a follow-up question', 'wconvert-pro')}</button><button type="button" onClick={() => onAdd('branch')}>{__('Send some answers to a different screen', 'wconvert-pro')}</button></div>}
    {fallback && sources.length > 0 && targets.length > 0 && !onAdd && <button type="button" className="wconvert-panel-link" onClick={add}>{__('Send some answers to a different screen', 'wconvert-pro')}</button>}
    {!sources.length && <PanelHint>{__('Add a choice question before this screen to send answers to different screens.', 'wconvert-pro')}</PanelHint>}
    {screen.when && <div className="wconvert-journey-settings__skip">
      {/* A skipped screen continues where it would have; choosing a screen here is an override (ADR 0135). */}
      <FieldHeading label={__('If skipped', 'wconvert-pro')} htmlFor={`${skipId}-skip`} tip={__('Skipped screens don’t collect answers or save details.', 'wconvert-pro')} />
      <select id={`${skipId}-skip`} ref={hiddenSelect} value={hidden && hidden.to !== fallback?.to ? hidden.to : ''} onChange={event => write(answers, fallback,
        event.target.value === '' ? null : { id: hidden?.id ?? graphEdgeId(graph), from: screen.id, kind: 'hidden', to: event.target.value })}>
        <option value="">{fallback ? sprintf(__('Where it would have gone (%s)', 'wconvert-pro'), tree.steps.find(item => item.id === fallback.to)?.name ?? '') : __('Where it would have gone', 'wconvert-pro')}</option>
        {targets.filter(target => target.id !== fallback?.to).map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></div>}
    </div>
    {unreachableScreens(tree).length > 0 && <p className="wconvert-panel-warn" role="status">{sprintf(/* translators: %s: screen names. */ __('No line reaches %s.', 'wconvert-pro'), unreachableScreens(tree).join(', '))}</p>}
    <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }} title={__('Check this change', 'wconvert-pro')} returnFocusTo={returnFocus}
      description={pending?.description ?? ''}
      confirmLabel={__('Change anyway', 'wconvert-pro')} onConfirm={() => { if (pending) onChange(pending.tree); setPending(null); }} />
  </div>;
}

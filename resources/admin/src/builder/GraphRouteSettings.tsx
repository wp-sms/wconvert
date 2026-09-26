import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { JourneyGraphEdge, TemplateTree } from '@renderer/types';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { ConditionSettings } from './JourneySettings';
import { graphEdgeId, graphTargets } from './structure/graph';
import { graphChangeImpact } from './structure/graphChangeImpact';
import { graphChoiceSources } from './structure/graphConnections';
import { unreachableScreens } from './structure/journey';
import { graphInsertionLocations } from './structure/graphInsertion';

/** A keyboard-complete editor for the actual v3 connections, not array order. */
export function GraphRouteSettings({ tree, step, focusPath, focusTarget = false, onChange, onInsert }: {
  tree: TemplateTree; step: number; focusPath?: number | 'hidden' | null; onChange(next: TemplateTree): void;
  focusTarget?: boolean;
  onInsert(edgeId: string, kind: 'content' | 'input'): void;
}) {
  const graph = tree.graph;
  const screen = tree.steps[step];
  const list = useRef<HTMLOListElement>(null);
  const hiddenSelect = useRef<HTMLSelectElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState<{ tree: TemplateTree; description: string } | null>(null);
  useEffect(() => {
    if (focusPath === null || focusPath === undefined) return;
    if (focusPath === 'hidden') { hiddenSelect.current?.focus(); return; }
    const row = list.current?.querySelector<HTMLElement>(`[data-path-priority="${focusPath}"]`);
    row?.scrollIntoView?.({ block: 'nearest' });
    if (focusTarget) { row?.querySelector<HTMLElement>('select')?.focus(); return; }
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
  const hidden = routes.find(edge => edge.kind === 'hidden');
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
  const write = (nextAnswers: readonly JourneyGraphEdge[], nextFallback = fallback, nextHidden = hidden) =>
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
  if (!routes.length && ['result', 'acknowledgement'].includes(screen.kind)) return <section className="wconvert-journey-settings"><h4>{__('Journey ends here', 'wconvert')}</h4>
    <p>{__('This screen has no next connection. Choose another screen to edit the journey.', 'wconvert')}</p></section>;
  return <section className="wconvert-journey-settings wconvert-journey-routes">
    <h4>{__('Next paths', 'wconvert')}</h4>
    <p>{answers.length ? __('Visitors take the first matching answer path. Everyone else follows the last path.', 'wconvert')
      : __('Everyone continues along this connection. Add an answer path to branch.', 'wconvert')}</p>
    <ol ref={list}>{[...answers, ...(fallback ? [fallback] : [])].map((edge, priority) => <li key={edge.id} data-path-priority={priority}>
      <strong>{edge.kind === 'default' ? answers.length ? __('Everyone else', 'wconvert') : __('Continue', 'wconvert') : sprintf(__('%d. If the answer matches', 'wconvert'), priority + 1)}</strong>
      <label>{__('Go to', 'wconvert')}<select value={edge.to} onChange={event => {
        const updated = { ...edge, to: event.target.value };
        if (edge.kind === 'default') write(answers, updated);
        else write(answers.map(item => item.id === edge.id ? updated : item));
      }}>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label>
      {edge.kind === 'answer' && <ConditionSettings required purpose="route" value={edge.when ?? { match: 'all', clauses: [] }} sources={sources}
        onChange={when => { if (when) write(answers.map(item => item.id === edge.id ? { ...item, when } : item)); }} />}
      <button type="button" className="wconvert-journey-routes__insert" disabled={!canAsk(edge.id)} onClick={() => onInsert(edge.id, 'input')}>{__('Ask a question on this path', 'wconvert')}</button>
      <button type="button" className="wconvert-journey-routes__insert" onClick={() => onInsert(edge.id, 'content')}>{__('Show a message on this path', 'wconvert')}</button>
      {edge.kind === 'answer' && <div className="wconvert-journey-routes__actions">
        <button type="button" disabled={priority === 0} onClick={() => { const next = [...answers]; [next[priority - 1], next[priority]] = [next[priority], next[priority - 1]]; write(next); }}>{__('Higher priority', 'wconvert')}</button>
        <button type="button" disabled={priority === answers.length - 1} onClick={() => { const next = [...answers]; [next[priority], next[priority + 1]] = [next[priority + 1], next[priority]]; write(next); }}>{__('Lower priority', 'wconvert')}</button>
        <button type="button" onClick={() => write(answers.filter(item => item.id !== edge.id))}>{__('Remove path', 'wconvert')}</button>
      </div>}
    </li>)}{!fallback && <li data-path-priority={answers.length}>
      <strong>{answers.length ? __('Everyone else', 'wconvert') : __('Continue to the next screen', 'wconvert')}</strong>
      <p>{__('This screen needs a next connection before visitors can continue.', 'wconvert')}</p>
      <label>{__('Go to', 'wconvert')}<select value="" onChange={event => {
        if (event.target.value) write(answers, { id: graphEdgeId(graph), from: screen.id, to: event.target.value, kind: 'default' });
      }}><option value="" disabled>{__('Choose next screen…', 'wconvert')}</option>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label>
    </li>}</ol>
    {questionAfterSave && <p>{__('Ask questions before this save so their answers can be included. Select an earlier connection to insert a question.', 'wconvert')}</p>}
    {fallback && sources.length > 0 && targets.length > 0 && <button type="button" onClick={add}>{__('Add answer path', 'wconvert')}</button>}
    {!sources.length && <p>{__('Add a choice question here or on a screen that leads here to branch by answer.', 'wconvert')}</p>}
    {screen.when && <div className="wconvert-journey-settings__skip"><strong>{__('When this screen is hidden', 'wconvert')}</strong>
      <label>{__('Continue at', 'wconvert')}<select ref={hiddenSelect} value={hidden?.to ?? ''} onChange={event => write(answers, fallback,
        { id: hidden?.id ?? graphEdgeId(graph), from: screen.id, kind: 'hidden', to: event.target.value })}>
        {!hidden && <option value="" disabled>{__('Choose hidden destination…', 'wconvert')}</option>}
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label><p>{__('Hidden screens do not collect an answer or submit details.', 'wconvert')}</p></div>}
    {unreachableScreens(tree).length > 0 && <p className="wconvert-journey-settings__warning" role="status">{sprintf(__('No path reaches: %s. Connect or remove these screens before publishing.', 'wconvert'), unreachableScreens(tree).join(', '))}</p>}
    <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }} title={__('Review this path change', 'wconvert')} returnFocusTo={returnFocus}
      description={pending?.description ?? ''}
      confirmLabel={__('Apply path change', 'wconvert')} onConfirm={() => { if (pending) onChange(pending.tree); setPending(null); }} />
  </section>;
}

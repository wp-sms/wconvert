import { followupGroups, followupGroupSource } from './structure/followupGroups';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Eye } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import type { JourneyGraphEdge, TemplateTree } from '@renderer/types';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { ConditionSettings } from './JourneySettings';
import { graphEdgeId, graphTargets } from './structure/graph';
import { conditionText } from './structure/conditionText';
import { graphChangeImpact } from './structure/graphChangeImpact';
import { graphChoiceSources } from './structure/graphConnections';
import { unreachableScreens } from './structure/journey';
import { graphInsertionLocations } from './structure/graphInsertion';

/** A keyboard-complete editor for the actual v3 connections, not array order. */
export function GraphRouteSettings({ tree, step, focusPath, focusTarget = false, onChange, onInsert, onOpenInsert, onAdd, onSelect, onPreview }: {
  tree: TemplateTree; step: number; focusPath?: number | 'hidden' | null; onChange(next: TemplateTree): void;
  focusTarget?: boolean; onSelect?(index: number): void; onPreview?(index: number): void;
  onInsert(edgeId: string, kind: 'content' | 'input'): void; onOpenInsert?(edgeId: string): void; onAdd?(intent: 'followup' | 'branch'): void;
}) {
  const graph = tree.graph;
  const screen = tree.steps[step];
  const list = useRef<HTMLOListElement>(null);
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
    <h4>{group ? __('Relevant follow-ups', 'wconvert') : answers.length ? __('Choose one path', 'wconvert') : __('Continue', 'wconvert')}</h4>
    <p>{group ? __('Ask each matching question in order, skip the rest, then continue together.', 'wconvert') : answers.length ? __('Visitors take the first matching answer path. Everyone else follows the last path.', 'wconvert')
      : __('Visitors continue here after completing this screen.', 'wconvert')}</p>
    {group && <div className="wconvert-followup-continuation">
      {!memberGroup && group.screens.map(index => <button type="button" key={tree.steps[index].id} onClick={() => onSelect?.(index)}><strong>{tree.steps[index].name}</strong><small>{conditionText(tree, tree.steps[index].when!)}</small></button>)}
      <label>{__('After the relevant questions', 'wconvert')}<select value={group.next} onChange={event => {
        const last = tree.steps[group.screens[group.screens.length - 1]].id;
        const next = { ...tree, graph: { ...graph, edges: graph.edges.map(edge => edge.from === last && ['default', 'hidden'].includes(edge.kind) ? { ...edge, to: event.target.value } : edge) } };
        const description = graphChangeImpact(tree, next);
        if (description) { returnFocus.current = event.currentTarget; setPending({ tree: next, description }); } else onChange(next);
      }}>{graphTargets(tree, tree.steps[group.screens[group.screens.length - 1]].id).map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
      <button type="button" aria-expanded={connectionsOpen || focusPath != null} onClick={() => setConnectionsOpen(value => !value)}>{connectionsOpen || focusPath != null ? __('Hide custom routing', 'wconvert') : __('Custom routing…', 'wconvert')}</button>
    </div>}
    <div hidden={!!group && !connectionsOpen && focusPath == null}>
    {group && <p className="wconvert-journey-settings__warning">{__('Changing individual connections can separate this question from its follow-up group. Use the shared continuation above to keep every matching question.', 'wconvert')}</p>}
    {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Preserve list semantics in WebKit when list-style is none. */}
    <ol ref={list} className="wconvert-journey-routes__list" role="list">{[...answers, ...(fallback ? [fallback] : [])].map((edge, priority) => <li key={edge.id} className="wconvert-journey-routes__disclosure" data-path-priority={priority}>
      <details className="wconvert-journey-path-disclosure" open={focusPath === priority || !answers.length}>
      <summary><span className="wconvert-journey-path-disclosure__priority">{edge.kind === 'answer' ? priority + 1 : '↳'}</span><span><strong>{edge.kind === 'default' ? answers.length ? __('Everyone else', 'wconvert') : __('Continue', 'wconvert') : edge.when ? conditionText(tree, edge.when) : __('Choose an answer condition', 'wconvert')}</strong><small>{sprintf(__('Go to %s', 'wconvert'), tree.steps.find(item => item.id === edge.to)?.name ?? __('Choose a screen', 'wconvert'))}</small></span><ChevronDown className="wconvert-editor-disclosure-icon" aria-hidden="true" /></summary>
      <div className="wconvert-journey-path-disclosure__body">
      {edge.kind === 'answer' && <><strong>{sprintf(__('Check %1$d of %2$d', 'wconvert'), priority + 1, answers.length)}</strong>
        <ConditionSettings required purpose="route" value={edge.when ?? { match: 'all', clauses: [] }} sources={sources}
          onChange={when => { if (when) write(answers.map(item => item.id === edge.id ? { ...item, when } : item)); }} />
      </>}
      <label>{__('Go to', 'wconvert')}<select data-route-target value={edge.to} onChange={event => {
        const updated = { ...edge, to: event.target.value };
        if (edge.kind === 'default') write(answers, updated);
        else write(answers.map(item => item.id === edge.id ? updated : item));
      }}>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label>
      {(onSelect || onPreview) && <div className="wconvert-journey-route-destination">
        {onSelect && <button type="button" disabled={!tree.steps.some(item => item.id === edge.to)} onClick={() => onSelect(tree.steps.findIndex(item => item.id === edge.to))}>{__('Edit destination screen', 'wconvert')}<ArrowRight aria-hidden="true" size={14}/></button>}
        {onPreview && <button type="button" disabled={!tree.steps.some(item => item.id === edge.to)} onClick={() => onPreview(tree.steps.findIndex(item => item.id === edge.to))}><Eye aria-hidden="true" size={14}/>{__('Preview', 'wconvert')}</button>}
      </div>}
      {tree.steps.find(item => item.id === edge.to)?.when && <p className="wconvert-journey-route-check">{sprintf(__('Check its show condition on arrival: %s', 'wconvert'), conditionText(tree, tree.steps.find(item => item.id === edge.to)!.when!))}</p>}
      {onOpenInsert ? <button type="button" className="wconvert-journey-routes__insert" onClick={() => onOpenInsert(edge.id)}>{__('Insert a screen on this path', 'wconvert')}</button> : <>
      <button type="button" className="wconvert-journey-routes__insert" disabled={!canAsk(edge.id)} onClick={() => onInsert(edge.id, 'input')}>{__('Ask a question on this path', 'wconvert')}</button>
      <button type="button" className="wconvert-journey-routes__insert" onClick={() => onInsert(edge.id, 'content')}>{__('Show a message on this path', 'wconvert')}</button>
      </>}
      {edge.kind === 'answer' && <div className="wconvert-journey-routes__actions">
        <button type="button" disabled={priority === 0} onClick={() => { const next = [...answers]; [next[priority - 1], next[priority]] = [next[priority], next[priority - 1]]; write(next); }}>{__('Higher priority', 'wconvert')}</button>
        <button type="button" disabled={priority === answers.length - 1} onClick={() => { const next = [...answers]; [next[priority], next[priority + 1]] = [next[priority + 1], next[priority]]; write(next); }}>{__('Lower priority', 'wconvert')}</button>
        <button type="button" data-destructive="true" onClick={() => write(answers.filter(item => item.id !== edge.id))}>{__('Remove path', 'wconvert')}</button>
      </div>}
      </div></details>
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
    {fallback && sources.length > 0 && onAdd && <div className="wconvert-journey-next-actions"><button type="button" onClick={() => onAdd('followup')}>{__('Add conditional follow-up', 'wconvert')}</button><button type="button" onClick={() => onAdd('branch')}>{__('Add branch', 'wconvert')}</button></div>}
    {fallback && sources.length > 0 && targets.length > 0 && !onAdd && <button type="button" onClick={add}>{__('Add answer path', 'wconvert')}</button>}
    {!sources.length && <p>{__('Add a choice question here or on a screen that leads here to branch by answer.', 'wconvert')}</p>}
    {screen.when && <div className="wconvert-journey-settings__skip"><strong>{__('When this screen is hidden', 'wconvert')}</strong>
      <label>{__('Continue at', 'wconvert')}<select ref={hiddenSelect} value={hidden?.to ?? ''} onChange={event => write(answers, fallback,
        { id: hidden?.id ?? graphEdgeId(graph), from: screen.id, kind: 'hidden', to: event.target.value })}>
        {!hidden && <option value="" disabled>{__('Choose hidden destination…', 'wconvert')}</option>}
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label><p>{__('Hidden screens do not collect an answer or submit details.', 'wconvert')}</p></div>}
    </div>
    {unreachableScreens(tree).length > 0 && <p className="wconvert-journey-settings__warning" role="status">{sprintf(__('No path reaches: %s. Connect or remove these screens before publishing.', 'wconvert'), unreachableScreens(tree).join(', '))}</p>}
    <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }} title={__('Review this path change', 'wconvert')} returnFocusTo={returnFocus}
      description={pending?.description ?? ''}
      confirmLabel={__('Apply path change', 'wconvert')} onConfirm={() => { if (pending) onChange(pending.tree); setPending(null); }} />
  </section>;
}

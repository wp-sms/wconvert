import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { JourneyGraphEdge, QuestionNode, TemplateTree } from '@renderer/types';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { ConditionSettings } from './JourneySettings';
import { graphEdgeId, graphReaches, graphTargets } from './structure/graph';
import { unreachableScreens, walkNodes } from './structure/journey';

type ChoiceQuestion = QuestionNode & { id: string };

/** A keyboard-complete editor for the actual v3 connections, not array order. */
export function GraphRouteSettings({ tree, step, focusPath, onChange, onInsert }: {
  tree: TemplateTree; step: number; focusPath?: number | null; onChange(next: TemplateTree): void;
  onInsert(edgeId: string, kind: 'content' | 'input'): void;
}) {
  const graph = tree.graph;
  const screen = tree.steps[step];
  const list = useRef<HTMLOListElement>(null);
  const [pending, setPending] = useState<{ tree: TemplateTree; disconnected: readonly string[] } | null>(null);
  useEffect(() => {
    if (focusPath === null || focusPath === undefined) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-path-priority="${focusPath}"]`);
    row?.scrollIntoView?.({ block: 'nearest' });
    const clause = row?.querySelector<HTMLElement>('.wconvert-journey-settings__clause');
    (clause?.querySelector<HTMLElement>('.wconvert-journey-settings__answers input')
      ?? clause?.querySelector<HTMLElement>('select:last-of-type')
      ?? row?.querySelector<HTMLElement>('select'))?.focus();
  }, [focusPath, step]);
  if (!graph || !screen) return null;
  const routes = graph.edges.filter(edge => edge.from === screen.id);
  const savedHere = walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  const questionAfterSave = savedHere && !tree.steps.some(item => item.kind === 'result');
  const answers = routes.filter(edge => edge.kind === 'answer');
  const fallback = routes.find(edge => edge.kind === 'default');
  const hidden = routes.find(edge => edge.kind === 'hidden');
  const targets = graphTargets(tree, screen.id);
  const sources = tree.steps.filter(candidate => candidate.id === screen.id || graphReaches(graph, candidate.id, screen.id))
    .flatMap(candidate => walkNodes(candidate.content))
    .filter((node): node is ChoiceQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string'
      && 'answer_type' in node && node.answer_type !== 'text') as ChoiceQuestion[];
  const apply = (next: readonly JourneyGraphEdge[]) => {
    const changed = { ...tree, graph: { ...graph, edges: [...graph.edges.filter(edge => edge.from !== screen.id), ...next] } };
    const before = new Set(unreachableScreens(tree));
    const disconnected = unreachableScreens(changed).filter(name => !before.has(name));
    if (disconnected.length) setPending({ tree: changed, disconnected });
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
  if (!fallback) return <section className="wconvert-journey-settings"><h4>{__('Journey ends here', 'wconvert')}</h4>
    <p>{__('This screen has no next connection. Choose another screen to edit the journey.', 'wconvert')}</p></section>;
  return <section className="wconvert-journey-settings wconvert-journey-routes">
    <h4>{__('Next paths', 'wconvert')}</h4>
    <p>{answers.length ? __('Visitors take the first matching answer path. Everyone else follows the last path.', 'wconvert')
      : __('Everyone continues along this connection. Add an answer path to branch.', 'wconvert')}</p>
    <ol ref={list}>{[...answers, fallback].map((edge, priority) => <li key={edge.id} data-path-priority={priority}>
      <strong>{edge.kind === 'default' ? __('Everyone else', 'wconvert') : sprintf(__('%d. If the answer matches', 'wconvert'), priority + 1)}</strong>
      <label>{__('Go to', 'wconvert')}<select value={edge.to} onChange={event => {
        const updated = { ...edge, to: event.target.value };
        if (edge.kind === 'default') write(answers, updated);
        else write(answers.map(item => item.id === edge.id ? updated : item));
      }}>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label>
      {edge.when && <ConditionSettings required purpose="route" value={edge.when} sources={sources}
        onChange={when => { if (when) write(answers.map(item => item.id === edge.id ? { ...item, when } : item)); }} />}
      <button type="button" className="wconvert-journey-routes__insert" disabled={questionAfterSave} onClick={() => onInsert(edge.id, 'input')}>{__('Ask a question on this path', 'wconvert')}</button>
      <button type="button" className="wconvert-journey-routes__insert" onClick={() => onInsert(edge.id, 'content')}>{__('Show a message on this path', 'wconvert')}</button>
      {edge.kind === 'answer' && <div className="wconvert-journey-routes__actions">
        <button type="button" disabled={priority === 0} onClick={() => { const next = [...answers]; [next[priority - 1], next[priority]] = [next[priority], next[priority - 1]]; write(next); }}>{__('Higher priority', 'wconvert')}</button>
        <button type="button" disabled={priority === answers.length - 1} onClick={() => { const next = [...answers]; [next[priority], next[priority + 1]] = [next[priority + 1], next[priority]]; write(next); }}>{__('Lower priority', 'wconvert')}</button>
        <button type="button" onClick={() => write(answers.filter(item => item.id !== edge.id))}>{__('Remove path', 'wconvert')}</button>
      </div>}
    </li>)}</ol>
    {questionAfterSave && <p>{__('Ask questions before this save so their answers can be included. Select an earlier connection to insert a question.', 'wconvert')}</p>}
    {sources.length > 0 && targets.length > 0 && answers.length < 5 && <button type="button" onClick={add}>{__('Add answer path', 'wconvert')}</button>}
    {!sources.length && <p>{__('Add a choice question here or on a screen that leads here to branch by answer.', 'wconvert')}</p>}
    {screen.when && hidden && <div className="wconvert-journey-settings__skip"><strong>{__('When this screen is hidden', 'wconvert')}</strong>
      <label>{__('Continue at', 'wconvert')}<select value={hidden.to} onChange={event => write(answers, fallback, { ...hidden, to: event.target.value })}>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label><p>{__('Hidden screens do not collect an answer or submit details.', 'wconvert')}</p></div>}
    {unreachableScreens(tree).length > 0 && <p className="wconvert-journey-settings__warning" role="status">{sprintf(__('No path reaches: %s. Connect or remove these screens before publishing.', 'wconvert'), unreachableScreens(tree).join(', '))}</p>}
    <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }} title={__('Review this path change', 'wconvert')}
      description={pending ? sprintf(__('These screens would become unreachable: %s. They stay in the draft, but visitors cannot reach them. Undo restores the connection.', 'wconvert'), pending.disconnected.join(', ')) : ''}
      confirmLabel={__('Apply path change', 'wconvert')} onConfirm={() => { if (pending) onChange(pending.tree); setPending(null); }} />
  </section>;
}

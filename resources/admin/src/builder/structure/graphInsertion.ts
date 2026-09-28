import { matches } from '../../../../loader/src/journey-rules';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree, TemplateScreen } from '@renderer/types';
import { graphDisplayOrder, graphEdgeId, graphReaches, insertOnGraphEdge } from './graph';
import { graphChoiceSources } from './graphConnections';
import { conditionText } from './conditionText';
import { freshScreen, walkNodes, withBackButton } from './journey';

export type GraphScreenKind = 'content' | 'input' | 'followup' | 'ending';
interface InsertionLocation {
  id: string; source: string; target: string; label: string; detail: string;
  choices: ReturnType<typeof graphChoiceSources>; canAsk: boolean; sharedHidden?: boolean;
}

/** Only choose automatically when this answer alone determines the outgoing path. */
export function answerInsertionEdge(tree: TemplateTree, source: string, questionId: string, value: string) {
  const outgoing = tree.graph?.edges.filter(edge => edge.from === source) ?? [];
  const branches = outgoing.filter(edge => edge.kind === 'answer');
  const question = graphChoiceSources(tree, source).find(item => item.id === questionId);
  if (branches.length && (question?.answer_type !== 'single' || branches.some(edge =>
    !edge.when || edge.when.clauses.some(clause => clause.question !== questionId)))) return undefined;
  return branches.find(edge => matches(edge.when, { [questionId]: value })) ?? outgoing.find(edge => edge.kind === 'default');
}

export function graphInsertionLocations(tree: TemplateTree) {
  const graph = tree.graph;
  if (!graph) return [];
  const entry = tree.steps.find(screen => screen.id === graph.entry);
  const locations: InsertionLocation[] = entry ? [{ id: 'entry', source: '', target: entry.id,
    label: sprintf(__('Before first screen: %s', 'wconvert'), entry.name), detail: __('This becomes the first screen visitors see.', 'wconvert'), choices: [] as ReturnType<typeof graphChoiceSources>, canAsk: true }] : [];
  const captures = tree.steps.filter(screen => walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
  for (const index of graphDisplayOrder(tree)) {
    const source = tree.steps[index];
    const outgoing = graph.edges.filter(edge => edge.from === source.id);
    const answers = outgoing.filter(edge => edge.kind === 'answer');
    const choices = graphChoiceSources(tree, source.id);
    const ownQuestions = new Set(walkNodes(source.content).filter(node => node.type === 'question' && 'id' in node).map(node => 'id' in node ? node.id : undefined));
    for (const edge of [...answers, ...outgoing.filter(edge => edge.kind !== 'answer')]) {
      const target = tree.steps.find(screen => screen.id === edge.to);
      if (!target) continue;
      const path = edge.kind === 'hidden' ? __('When hidden', 'wconvert') : edge.kind === 'answer'
        ? sprintf(__('Answer path %d', 'wconvert'), answers.indexOf(edge) + 1)
        : answers.length ? __('Everyone else', 'wconvert') : __('Continue', 'wconvert');
      locations.push({ id: `edge:${edge.id}`, source: source.id, target: target.id,
        sharedHidden: edge.kind === 'default' && outgoing.some(item => item.kind === 'hidden' && item.to === edge.to),
        label: sprintf(__('%1$s — %2$s — to %3$s', 'wconvert'), source.name, path, target.name),
        detail: edge.kind === 'answer' && edge.when ? conditionText(tree, edge.when)
          : edge.kind === 'hidden' ? __('Used when the source screen is skipped.', 'wconvert')
          : answers.length ? __('Used when none of the answer paths match.', 'wconvert') : __('Visitors continue along this connection.', 'wconvert'),
        choices: choices.filter(question => edge.kind !== 'hidden' || !ownQuestions.has(question.id)),
        canAsk: !tree.submissions.length || tree.steps.some(screen => screen.kind === 'result')
          || captures.some(screen => graphReaches(graph, edge.to, screen.id)),
      });
    }
  }
  return locations;
}

export function insertionUnavailable(location: ReturnType<typeof graphInsertionLocations>[number], kind: GraphScreenKind): string | null {
  if (kind === 'ending' && location.id === 'entry') return __('Choose a path to finish after the first screen.', 'wconvert');
  if (kind !== 'content' && kind !== 'ending' && !location.canAsk) return __('Ask this question before visitors submit their details so its answer is saved with them.', 'wconvert');
  if (kind === 'followup' && !location.choices.length) return __('Choose a connection after a choice question.', 'wconvert');
  return null;
}

export function addGraphScreen(tree: TemplateTree, locationId: string, kind: GraphScreenKind, when?: QuestionCondition, includeSharedHidden = false): TemplateTree {
  const location = graphInsertionLocations(tree).find(item => item.id === locationId);
  if (!tree.graph || !location || insertionUnavailable(location, kind)) return tree;
  if ((kind === 'followup' || when) && (!when?.clauses.length || when.clauses.some(clause => {
    const question = location.choices.find(item => item.id === clause.question);
    return !question || !clause.values.length || clause.values.some(value => !question.options?.some(option => option.value === value));
  }))) return tree;
  let screen = kind === 'ending' ? freshEnding(tree) : freshScreen(tree, kind === 'content' ? 'content' : 'input', locationId !== 'entry');
  if (kind === 'ending' && locationId === 'entry') return tree;
  if (when) screen = { ...screen, ...(kind === 'followup' ? { name: __('Relevant follow-up', 'wconvert') } : {}), when };
  if (locationId !== 'entry') {
    const inserted = insertOnGraphEdge(tree, locationId.slice(5), screen);
    const next = kind === 'ending' ? { ...inserted, graph: { ...inserted.graph!, edges: inserted.graph!.edges.filter(edge => edge.from !== screen.id) } } : inserted;
    if (!location.sharedHidden || includeSharedHidden) return next;
    // The low-level chain insertion also moves a shared hidden continuation.
    // A named-path insertion leaves it alone unless the merchant includes it.
    const hidden = tree.graph.edges.find(edge => edge.from === location.source && edge.kind === 'hidden');
    return { ...next, graph: { ...next.graph!, edges: next.graph!.edges.map(edge => edge.id === hidden?.id ? hidden : edge) } };
  }
  return { ...tree, steps: [...tree.steps.map(item => item.id === tree.graph!.entry ? withBackButton(item) : item), screen],
    graph: { ...tree.graph, entry: screen.id, edges: [...tree.graph.edges,
      { id: graphEdgeId(tree.graph), from: screen.id, to: tree.graph.entry, kind: 'default' }] } };
}

/** Add an exclusive branch without changing the fallback or earlier priorities. */
export function addGraphBranchScreen(tree: TemplateTree, source: string, kind: 'content' | 'input' | 'ending', when: QuestionCondition): TemplateTree {
  const graph = tree.graph;
  const fallback = graph?.edges.find(edge => edge.from === source && edge.kind === 'default');
  const location = graphInsertionLocations(tree).find(item => item.id === `edge:${fallback?.id}`);
  if (!graph || !fallback || !location || insertionUnavailable(location, kind) || !when.clauses.length
    || when.clauses.some(clause => { const question = location.choices.find(item => item.id === clause.question);
      return !question || !clause.values.length || clause.values.some(value => !question.options?.some(option => option.value === value)); })) return tree;
  const screen = kind === 'ending' ? freshEnding(tree) : freshScreen(tree, kind);
  const branch = { id: graphEdgeId(graph), from: source, to: screen.id, kind: 'answer' as const, when };
  return { ...tree, steps: [...tree.steps, screen], graph: { ...graph, edges: [...graph.edges, branch,
    ...(kind === 'ending' ? [] : [{ id: graphEdgeId({ ...graph, edges: [...graph.edges, branch] }), from: screen.id, to: fallback.to, kind: 'default' as const }])] } };
}

function freshEnding(tree: TemplateTree): TemplateScreen {
  return { ...freshScreen(tree, 'content'), name: __('All done', 'wconvert'), kind: 'acknowledgement', content: { type: 'stack', children: [
    { type: 'heading', role: 'headline', text: __('All done', 'wconvert') },
    { type: 'text', role: 'body', text: __('Thank you for your time.', 'wconvert') },
    { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    { type: 'button', label: __('Close', 'wconvert'), action: 'close' },
  ] } };
}

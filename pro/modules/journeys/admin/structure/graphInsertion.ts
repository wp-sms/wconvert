import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree, TemplateScreen } from '@renderer/types';
import { graphDisplayOrder, graphEdgeId, graphReaches, insertOnGraphEdge } from '@/builder/structure/graph';
import { graphChoiceSources } from '@/builder/structure/graphConnections';
import { conditionText } from '@/builder/structure/conditionText';
import { freshScreen, walkNodes, withBackButton } from '@/builder/structure/journey';

export type GraphScreenKind = 'content' | 'input' | 'followup' | 'ending';
interface InsertionLocation {
  id: string; source: string; target: string; label: string; detail: string;
  choices: ReturnType<typeof graphChoiceSources>; canAsk: boolean; sharedHidden?: boolean;
}

export function graphInsertionLocations(tree: TemplateTree) {
  const graph = tree.graph;
  if (!graph) return [];
  const entry = tree.steps.find(screen => screen.id === graph.entry);
  const locations: InsertionLocation[] = entry ? [{ id: 'entry', source: '', target: entry.id,
    label: sprintf(/* translators: %s: the first screen's name, e.g. “Welcome”. */ __('Before first screen: %s', 'wconvert-pro'), entry.name), detail: __('This becomes the first screen visitors see.', 'wconvert-pro'), choices: [] as ReturnType<typeof graphChoiceSources>, canAsk: true }] : [];
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
      const path = edge.kind === 'hidden' ? __('If skipped', 'wconvert-pro') : edge.kind === 'answer'
        ? sprintf(/* translators: %d: the line's position among this screen's answer lines, starting at 1. */ __('Answer line %d', 'wconvert-pro'), answers.indexOf(edge) + 1)
        : answers.length ? __('All other answers', 'wconvert-pro') : __('Continue', 'wconvert-pro');
      locations.push({ id: `edge:${edge.id}`, source: source.id, target: target.id,
        sharedHidden: edge.kind === 'default' && outgoing.some(item => item.kind === 'hidden' && item.to === edge.to),
        label: sprintf(/* translators: 1: the screen the line starts from, 2: which line, e.g. “Answer line 2” or “All other answers”, 3: the screen it leads to. */ __('%1$s — %2$s — to %3$s', 'wconvert-pro'), source.name, path, target.name),
        detail: edge.kind === 'answer' && edge.when ? conditionText(tree, edge.when)
          : edge.kind === 'hidden' ? __('Used when the source screen is skipped.', 'wconvert-pro')
          : answers.length ? __('Used when none of the answer lines match.', 'wconvert-pro') : __('Everyone on this line.', 'wconvert-pro'),
        choices: choices.filter(question => edge.kind !== 'hidden' || !ownQuestions.has(question.id)),
        canAsk: !tree.submissions.length || tree.steps.some(screen => screen.kind === 'result')
          || captures.some(screen => graphReaches(graph, edge.to, screen.id)),
      });
    }
  }
  return locations;
}

export function insertionUnavailable(location: ReturnType<typeof graphInsertionLocations>[number], kind: GraphScreenKind): string | null {
  if (kind === 'ending' && location.id === 'entry') return __('Choose a line after the first screen.', 'wconvert-pro');
  if (kind !== 'content' && kind !== 'ending' && !location.canAsk) return __('Ask this question before visitors submit their details so its answer is saved with them.', 'wconvert-pro');
  if (kind === 'followup' && !location.choices.length) return __('Choose a line after a choice question.', 'wconvert-pro');
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
  if (when) screen = { ...screen, ...(kind === 'followup' ? { name: __('Relevant follow-up', 'wconvert-pro') } : {}), when };
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
  return { ...freshScreen(tree, 'content'), name: __('All done', 'wconvert-pro'), kind: 'acknowledgement', content: { type: 'stack', children: [
    { type: 'heading', role: 'headline', text: __('All done', 'wconvert-pro') },
    { type: 'text', role: 'body', text: __('Thank you for your time.', 'wconvert-pro') },
    { type: 'button', label: __('Back', 'wconvert-pro'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    { type: 'button', label: __('Close', 'wconvert-pro'), action: 'close' },
  ] } };
}

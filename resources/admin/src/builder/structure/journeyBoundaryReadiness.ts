import { __, sprintf } from '@wordpress/i18n';
import type { JourneyGraphEdge, TemplateTree } from '@renderer/types';
import { graphReaches } from './graph';
import { submissionScreen, walkNodes } from './journey';
import type { JourneyReadinessIssue } from './journeyReadiness';

/** One witness per destination. Repair the bypass before it rejoins the normal
 * route; changing a shared edge after the join could create a loop. */
function bypasses(tree: TemplateTree, required: string, targets: Set<string>) {
  const graph = tree.graph!;
  const pending: { id: string; path: JourneyGraphEdge[] }[] = [{ id: graph.entry, path: [] }];
  const seen = new Set<string>();
  const found: { target: string; edge: JourneyGraphEdge }[] = [];
  while (pending.length) {
    const { id, path } = pending.pop()!;
    if (id === required || seen.has(id)) continue;
    seen.add(id);
    if (targets.has(id)) {
      const edge = path.find(edge => graphReaches(graph, required, edge.to)) ?? path.at(-1);
      if (edge) found.push({ target: id, edge });
    }
    for (const edge of graph.edges.filter(edge => edge.from === id)) pending.push({ id: edge.to, path: [...path, edge] });
  }
  return found;
}

export function journeyBoundaryIssues(tree: TemplateTree, action?: string): JourneyReadinessIssue[] {
  if (!tree.graph) return [];
  const issues: JourneyReadinessIssue[] = [];
  const name = (id: string) => tree.steps.find(screen => screen.id === id)?.name ?? id;
  // An ending that skips the result is early and allowed (ADR 0142); once every screen is connected one always comes after it.
  const primaryAt = submissionScreen(tree, tree.submissions[0]?.id);
  if (primaryAt < 0) return issues;
  const primary = tree.steps[primaryAt];
  if (action === 'submit') for (const screen of tree.steps) {
    if (screen.id === primary.id || !graphReaches(tree.graph, primary.id, screen.id)) continue;
    if (!walkNodes(screen.content).some(node => node.type === 'question')) continue;
    issues.push({ key: `question-after-save:${screen.id}`,
      said: sprintf(__('The questions on “%1$s” come after “%2$s” saves the answers. Move this screen before that save, or remove its questions.', 'wconvert'), screen.name, primary.name),
      repair: { screenId: screen.id, section: 'content', focus: 'questions' },
    });
  }
  for (const save of tree.submissions.slice(1)) {
    const at = submissionScreen(tree, save.id);
    if (at < 0 || at === primaryAt) continue;
    for (const { edge } of bypasses(tree, primary.id, new Set([tree.steps[at].id]))) issues.push({
      key: `secondary-before-primary:${save.id}`,
      said: sprintf(__('A line reaches “%1$s” before the main form at “%2$s”. Send the line from “%3$s” through the main form.', 'wconvert'), tree.steps[at].name, primary.name, name(edge.from)),
      repair: { screenId: edge.from, section: 'paths', edgeId: edge.id, focus: edge.kind === 'hidden' ? 'hidden-route' : 'route-target' },
    });
  }
  return issues;
}

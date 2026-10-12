import type { JourneyGraphEdge, TemplateTree } from '@renderer/types';
import { graphReaches, skipEdge } from './graph';
import { submissionScreen } from './journey';

/**
 * Endings either side of a gate — the required form, or the result — the
 * editor's copy of `GraphCaptureContract::gateHolds()` (ADR 0142). An ending
 * may be reached without the gate: always (an *early* ending, "Ends without
 * saving details") or by some visitors (*shared*, "Some visitors end here
 * without saving details"). Both are allowed while at least one ending comes
 * after the gate. Nothing is stored: it is read off the lines each time.
 * `tests/fixtures/journey-graph-early-endings.json` keeps the two in step.
 */
export interface GateSides {
  readonly after: readonly string[];
  readonly early: readonly string[];
  readonly shared: readonly string[];
  /** Screens some route reaches without the gate, and the line it arrived on. */
  readonly without: ReadonlyMap<string, JourneyGraphEdge | undefined>;
}

const none: GateSides = { after: [], early: [], shared: [], without: new Map() };

/** Screens with no line out that a visitor can reach, in storage order. */
export function endingsOf(tree: TemplateTree): readonly string[] {
  const graph = tree.graph;
  if (!graph) return [];
  return tree.steps.filter(screen => !graph.edges.some(edge => edge.from === screen.id)
    && (screen.id === graph.entry || graphReaches(graph, graph.entry, screen.id))).map(screen => screen.id);
}

export function gateEndings(tree: TemplateTree, gate: string): GateSides {
  const graph = tree.graph;
  if (!graph || !tree.steps.some(screen => screen.id === gate)) return none;
  const without = new Map<string, JourneyGraphEdge | undefined>();
  const pending: { id: string; via?: JourneyGraphEdge }[] = graph.entry === gate ? [] : [{ id: graph.entry }];
  // A gate with "Only if…" can itself be skipped: that visitor goes on along
  // its skip line without passing it (ADR 0135). The server refuses a
  // condition on a form, but the editor still has to say what it would do.
  const skip = tree.steps.find(screen => screen.id === gate)?.when ? skipEdge(graph, gate) : undefined;
  let skipped = false;
  while (pending.length) {
    const { id, via } = pending.pop()!;
    if (id === gate) { if (skip && !skipped) { skipped = true; pending.push({ id: skip.to, via: skip }); } continue; }
    if (without.has(id)) continue;
    without.set(id, via);
    for (const edge of graph.edges) if (edge.from === id) pending.push({ id: edge.to, via: edge });
  }
  const after: string[] = [], early: string[] = [], shared: string[] = [];
  for (const ending of endingsOf(tree)) {
    const withGate = ending === gate || graphReaches(graph, gate, ending);
    const skipping = without.has(ending);
    (withGate && skipping ? shared : withGate ? after : early).push(ending);
  }
  return { after, early, shared, without };
}

/** The required form's screen and the result screen, where each exists. */
export function gatesOf(tree: TemplateTree): { details?: string; result?: string } {
  const form = tree.submissions.find(submission => submission.required);
  const at = form ? submissionScreen(tree, form.id) : -1;
  return { details: at >= 0 ? tree.steps[at].id : undefined, result: tree.steps.find(screen => screen.kind === 'result')?.id };
}

/** A gate an ending can skip on purpose: the required form's details, or the result. */
export type Gate = 'details' | 'result';

/** A gate an ending can be reached without, and whether every visitor who ends there skips it. */
export interface SkippedGate { readonly gate: Gate; readonly always: boolean }

/** Every gate visitors can skip on their way to this ending; empty when they all pass them (or a gate is broken). */
export function earlyEnding(tree: TemplateTree, id: string): readonly SkippedGate[] {
  const gates = gatesOf(tree);
  return (['details', 'result'] as const).flatMap((kind): SkippedGate[] => {
    const gate = gates[kind];
    if (!gate) return [];
    const sides = gateEndings(tree, gate);
    return sides.early.includes(id) ? [{ gate: kind, always: true }] : sides.shared.includes(id) ? [{ gate: kind, always: false }] : [];
  });
}

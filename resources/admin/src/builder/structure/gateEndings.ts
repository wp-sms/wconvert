import type { JourneyGraphEdge, TemplateTree } from '@renderer/types';
import { graphReaches } from './graph';
import { submissionScreen } from './journey';

/**
 * Endings either side of a gate — the required form, or the result — the
 * editor's copy of `GraphCaptureContract::gateEndings()` (ADR 0142). An
 * ending no route reaches through the gate is *early* ("Ends without saving
 * details") and allowed while at least one ending comes after the gate and
 * none is reachable both with and without it. Nothing is stored: it is read
 * off the lines each time. `tests/fixtures/journey-graph-early-endings.json`
 * keeps the two in step.
 */
export interface GateSides {
  readonly after: readonly string[];
  readonly early: readonly string[];
  readonly shared: readonly string[];
  /** The campaign may publish as far as this gate is concerned. */
  readonly holds: boolean;
  /** Screens some route reaches without the gate, and the line it arrived on. */
  readonly without: ReadonlyMap<string, JourneyGraphEdge | undefined>;
}

const none: GateSides = { after: [], early: [], shared: [], holds: true, without: new Map() };

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
  const skip = tree.steps.find(screen => screen.id === gate)?.when
    ? graph.edges.find(edge => edge.from === gate && edge.kind === 'hidden') ?? graph.edges.find(edge => edge.from === gate && edge.kind === 'default')
    : undefined;
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
  return { after, early, shared, holds: after.length > 0 && shared.length === 0, without };
}

/** The required form's screen and the result screen, where each exists. */
export function gatesOf(tree: TemplateTree): { details?: string; result?: string } {
  const form = tree.submissions.find(submission => submission.required);
  const at = form ? submissionScreen(tree, form.id) : -1;
  return { details: at >= 0 ? tree.steps[at].id : undefined, result: tree.steps.find(screen => screen.kind === 'result')?.id };
}

/** A gate an ending can skip on purpose: the required form's details, or the result. */
export type Gate = 'details' | 'result';

/** Every gate an ending skips on purpose; empty when it comes after them all (or a gate is broken). */
export function earlyEnding(tree: TemplateTree, id: string): readonly Gate[] {
  const gates = gatesOf(tree);
  return (['details', 'result'] as const).filter(kind => {
    const gate = gates[kind];
    if (!gate) return false;
    const sides = gateEndings(tree, gate);
    return sides.after.length > 0 && sides.early.includes(id);
  });
}

/**
 * The endings that keep a gate from holding: those reached both with and
 * without it, else — when none comes after it — every early one.
 */
export function gateFaults(sides: GateSides): { readonly ids: readonly string[]; readonly reason: 'shared' | 'none-after' } {
  return sides.shared.length ? { ids: sides.shared, reason: 'shared' } : { ids: sides.after.length ? [] : sides.early, reason: 'none-after' };
}

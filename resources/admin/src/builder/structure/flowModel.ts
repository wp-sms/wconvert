import { __, _n, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { conditionText } from './conditionText';
import { followupGroups, followupGroupSource } from './followupGroups';
import { earlyEnding, type SkippedGate } from './gateEndings';
import { graphDisplayOrder } from './graph';
import { unreachableScreenIds, walkNodes } from './journey';

/**
 * What the Flow map draws (ADR 0142), worked out once from the tree and never
 * stored: the cards in reading order, the follow-up boxes, and the lines with
 * their words, answer colours and what a click or "+" on each one opens.
 * `flowLayout` places them; the components only draw. Version 2 trees and
 * graphs read the same, and every line keeps the edge ids a trace names
 * (`${screen}-${priority}`, `${screen}-hidden` for version 2), so
 * `journeyTraceEdges` marks them one to one.
 */

export type CardKind = 'question' | 'message' | 'form' | 'result' | 'ending';
export type LineStyle = 'plain' | 'answer' | 'around' | 'skipped';
export type Priority = number | 'hidden';

export interface FlowEdge {
  readonly id: string; readonly from: string; readonly to: string;
  readonly kind: 'answer' | 'default' | 'hidden'; readonly when?: QuestionCondition; readonly priority: Priority;
}

/** A line is on in a trace when one of its edges was taken and the screens around it were (or were not) shown. */
export interface TraceRule {
  readonly edges: readonly string[];
  readonly all?: readonly string[];
  readonly any?: readonly string[];
  readonly none?: readonly string[];
}
export interface FlowTrace { readonly screens: ReadonlySet<string>; readonly edges: ReadonlySet<string> }

export interface FlowLine {
  readonly id: string;
  /** A card's screen id, or a follow-up box's id. */
  readonly from: string;
  readonly to: string;
  readonly style: LineStyle;
  readonly label?: string;
  /** Answer colour slot, 1–6. */
  readonly colour?: AnswerColour;
  readonly edgeIds: readonly string[];
  /** The graph edge "+" inserts a screen on; absent where the line is drawn only. */
  readonly insertEdgeId?: string;
  /** The rule a click on the label opens. */
  readonly select?: { readonly index: number; readonly priority: Priority };
  /** An answer line with no answer chosen yet. */
  readonly problem?: boolean;
  readonly trace: readonly TraceRule[];
}

export interface FlowResult { readonly id: string; readonly heading: string; readonly colour?: AnswerColour; readonly fallback: boolean; readonly needsCondition: boolean }

export interface FlowCard {
  readonly id: string;
  readonly index: number;
  readonly kind: CardKind;
  readonly name: string;
  readonly first: boolean;
  readonly multi: boolean;
  readonly optional: boolean;
  readonly onlyIf?: { readonly text: string; readonly colour?: AnswerColour };
  readonly then?: { readonly target: string; readonly name: string; readonly priority: number };
  readonly skip?: { readonly target: string; readonly name: string };
  /** "3 lines · first match wins", when more than one line leaves the card. */
  readonly linesText?: string;
  readonly linePriority?: number;
  /** Where "All other answers" sits among its lines: what "Choose where visitors go" opens. */
  readonly fallbackPriority: number;
  /** An ending reached only without the required form or the result. */
  /** The gates some or all visitors who end here skip. */
  readonly endsWithout?: readonly SkippedGate[];
  readonly results?: readonly FlowResult[];
  readonly unreachable: boolean;
  /** Nowhere to go next, where something has to follow. */
  readonly missingThen: boolean;
  /** The colour of the one answer every line into this card carries. */
  readonly colour?: AnswerColour;
  /** Its whole sentence, for a screen reader. */
  readonly label: string;
}

export interface FlowMember { readonly id: string; readonly index: number; readonly name: string; readonly answer: string; readonly colour?: AnswerColour }
export interface FlowGroupBox {
  readonly id: string;
  readonly screens: readonly number[];
  readonly members: readonly FlowMember[];
  readonly title: string;
  readonly next: string;
  readonly nextName: string;
  readonly colour?: AnswerColour;
  readonly unreachable: boolean;
}

export interface FlowModel {
  readonly cards: readonly FlowCard[];
  readonly groups: readonly FlowGroupBox[];
  readonly lines: readonly FlowLine[];
  /** No line says who takes it: every visitor sees every screen. */
  readonly straight: boolean;
  /** Set when more answers are used than there are colours: only this question's keep theirs. */
  readonly focusQuestion?: string;
  /** The card or box a screen is drawn in. */
  readonly nodeOf: (screenId: string) => string;
}

export function routesFor(tree: TemplateTree, index: number) {
  const screen = tree.steps[index];
  if (tree.graph) {
    const outgoing = tree.graph.edges.filter(edge => edge.from === screen.id);
    return [...outgoing.filter(edge => edge.kind === 'answer'), ...outgoing.filter(edge => edge.kind === 'default')];
  }
  return screen.paths ?? (tree.steps[index + 1] ? [{ to: tree.steps[index + 1].id }] : []);
}

export function hiddenFor(tree: TemplateTree, index: number): string | undefined {
  if (tree.graph) return tree.graph.edges.find(edge => edge.from === tree.steps[index].id && edge.kind === 'hidden')?.to;
  return tree.steps[index].when ? tree.steps[index + 1]?.id : undefined;
}

/** Every way out of every screen, named the way a trace names it. */
export function edgesOf(tree: TemplateTree): FlowEdge[] {
  return tree.steps.flatMap((screen, index) => {
    if (tree.graph) {
      const answers = tree.graph.edges.filter(edge => edge.from === screen.id && edge.kind === 'answer');
      const rest = tree.graph.edges.filter(edge => edge.from === screen.id && edge.kind !== 'answer');
      return [...answers.map((edge, priority) => ({ ...edge, priority })),
        ...rest.map(edge => ({ ...edge, priority: edge.kind === 'hidden' ? 'hidden' as const : answers.length }))];
    }
    const paths = routesFor(tree, index);
    const out: FlowEdge[] = paths.map((path, priority) => ({ id: `${screen.id}-${priority}`, from: screen.id, to: path.to,
      kind: 'when' in path && path.when ? 'answer' : 'default', ...('when' in path && path.when ? { when: path.when } : {}), priority }));
    const hidden = hiddenFor(tree, index);
    if (hidden && !paths.some(path => path.to === hidden)) out.push({ id: `${screen.id}-hidden`, from: screen.id, to: hidden, kind: 'hidden', priority: 'hidden' });
    return out;
  });
}

/** The one word for each kind of screen (ADR 0142). */
export const kindWord = (kind: CardKind): string => ({ question: __('Question', 'wconvert'), message: __('Message', 'wconvert'), form: __('Form', 'wconvert'),
  result: __('Result', 'wconvert'), ending: __('Ending', 'wconvert') })[kind];

/**
 * How an ending says it finishes: after everything; early, without what it
 * skips; or, where only some visitors skip it, that some do (ADR 0142).
 */
export function endingWords(skipped: readonly SkippedGate[] | undefined, lead = true): string {
  const both = skipped?.length === 2, details = skipped?.some(item => item.gate === 'details'), result = skipped?.some(item => item.gate === 'result');
  const some = skipped?.some(item => !item.always);
  if (some) {
    if (lead) return both ? __('Some visitors end here without saving details or a result', 'wconvert') : details ? __('Some visitors end here without saving details', 'wconvert')
      : __('Some visitors end here without a result', 'wconvert');
    return both ? __('some visitors end here without saving details or a result', 'wconvert') : details ? __('some visitors end here without saving details', 'wconvert')
      : __('some visitors end here without a result', 'wconvert');
  }
  if (lead) return both ? __('Ends without saving details or a result', 'wconvert') : details ? __('Ends without saving details', 'wconvert')
    : result ? __('Ends without a result', 'wconvert') : __('Ends the campaign', 'wconvert');
  return both ? __('ends without saving details or a result', 'wconvert') : details ? __('ends without saving details', 'wconvert')
    : result ? __('ends without a result', 'wconvert') : __('ends the campaign', 'wconvert');
}

/** Which colour slot, 1–6, an answer has on the map. */
export type AnswerColour = number;

const pair = (question: string, value: string) => `${question}\u0000${value}`;

/**
 * One colour per answer some rule uses, in reading order (ADR 0142). Past six,
 * only the question in focus keeps its colours, so two answers never share one.
 */
export function answerColours(tree: TemplateTree, focus?: string): { colours: ReadonlyMap<string, number>; focusQuestion?: string } {
  const used = new Set<string>();
  const note = (when?: QuestionCondition) => when?.clauses.forEach(clause => clause.values.forEach(value => { if (value) used.add(pair(clause.question, value)); }));
  tree.steps.forEach(screen => { note(screen.when); screen.paths?.forEach(path => note(path.when)); screen.results?.forEach(result => note(result.when)); });
  tree.graph?.edges.forEach(edge => note(edge.when));
  const ordered: { question: string; key: string }[] = [];
  for (const index of graphDisplayOrder(tree)) for (const node of walkNodes(tree.steps[index].content)) {
    if (node.type !== 'question' || !('id' in node) || typeof node.id !== 'string') continue;
    for (const option of (node as QuestionNode).options ?? []) if (used.has(pair(node.id, option.value))) ordered.push({ question: node.id, key: pair(node.id, option.value) });
  }
  if (ordered.length <= 6) return { colours: new Map(ordered.map((item, at) => [item.key, at + 1])) };
  const focusQuestion = focus && ordered.some(item => item.question === focus) ? focus : ordered[0].question;
  return { colours: new Map(ordered.filter(item => item.question === focusQuestion).slice(0, 6).map((item, at) => [item.key, at + 1])), focusQuestion };
}

export function lineIsOn(line: FlowLine, trace: FlowTrace): boolean {
  return line.trace.some(rule => rule.edges.some(edge => trace.edges.has(edge))
    && (rule.all ?? []).every(id => trace.screens.has(id))
    && (!rule.any || rule.any.some(id => trace.screens.has(id)))
    && (rule.none ?? []).every(id => !trace.screens.has(id)));
}

export function flowModel(tree: TemplateTree, { selectedQuestion }: { selectedQuestion?: string } = {}): FlowModel {
  const edges = edgesOf(tree);
  const entry = tree.graph?.entry ?? tree.steps[0]?.id;
  const byId = new Map(tree.steps.map((screen, index) => [screen.id, { screen, index }]));
  const name = (id: string) => byId.get(id)?.screen.name ?? __('Removed screen', 'wconvert');
  const out = (id: string) => edges.filter(edge => edge.from === id);
  const answersOf = (id: string) => out(id).filter(edge => edge.kind === 'answer');
  const defaultOf = (id: string) => out(id).find(edge => edge.kind === 'default');
  const hiddenOf = (id: string) => out(id).find(edge => edge.kind === 'hidden');
  const questions = new Map(tree.steps.flatMap(screen => walkNodes(screen.content))
    .filter((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node && typeof node.id === 'string').map(node => [node.id, node]));
  const own = (id: string) => new Set(walkNodes(byId.get(id)?.screen.content ?? { type: 'stack' } as never)
    .flatMap(node => node.type === 'question' && 'id' in node && typeof node.id === 'string' ? [node.id] : []));
  const { colours, focusQuestion } = answerColours(tree, selectedQuestion);
  const colourOf = (when?: QuestionCondition) => {
    const clause = when?.clauses.length === 1 ? when.clauses[0] : undefined;
    return clause && ['is', 'includes_any'].includes(clause.operator) && clause.values.length === 1 ? colours.get(pair(clause.question, clause.values[0])) : undefined;
  };
  const answerWords = (question: string, values: readonly string[]) => values.map(value => questions.get(question)?.options?.find(option => option.value === value)?.label ?? value)
    .join(` ${__('or', 'wconvert')} `);
  /** "Growing", "Includes Growing", "Without Growing" on the question's own lines; the whole rule elsewhere. */
  const ruleWords = (when: QuestionCondition, from: string): { text: string; problem: boolean } => {
    const clause = when.clauses.length === 1 ? when.clauses[0] : undefined;
    const problem = when.clauses.some(item => !item.values.some(Boolean));
    if (problem) return { text: __('Choose an answer', 'wconvert'), problem };
    if (!clause || !own(from).has(clause.question)) return { text: conditionText(tree, when), problem };
    const words = answerWords(clause.question, clause.values);
    return { text: clause.operator === 'is' ? words
      : clause.operator === 'is_not' ? sprintf(/* translators: %s: one or more answers. */ __('Not %s', 'wconvert'), words)
        : clause.operator === 'includes_any' ? sprintf(/* translators: %s: one or more answers. */ __('Includes %s', 'wconvert'), words)
          : sprintf(/* translators: %s: one or more answers. */ __('Without %s', 'wconvert'), words), problem };
  };
  const same = (a?: QuestionCondition, b?: QuestionCondition) => JSON.stringify(a) === JSON.stringify(b);
  /** Where a visitor goes who skips a screen: its skip line, else on along its default (ADR 0135). */
  const skipTarget = (id: string) => {
    const when = byId.get(id)?.screen.when;
    let target = (hiddenOf(id) ?? defaultOf(id))?.to;
    for (let guard = 0; target && guard < 20; guard++) {
      const next = byId.get(target)?.screen;
      if (!next?.when || !same(next.when, when) || hiddenOf(target)) break;
      target = defaultOf(target)?.to;
    }
    return target;
  };

  const groups = followupGroups(tree, { messages: true });
  const groupOf = new Map(groups.flatMap(group => group.screens.map(index => [tree.steps[index].id, group] as const)));
  const nodeOf = (id: string) => groupOf.get(id)?.id ?? id;
  const conditional = tree.steps.filter(screen => screen.when).map(screen => screen.id);
  /** An "Only if" screen reached by one plain line splits it: through, and around (ADR 0142). */
  const splits = (id: string) => {
    const screen = byId.get(id)?.screen;
    if (!screen?.when || groupOf.has(id) || id === entry) return false;
    const incoming = edges.filter(edge => edge.to === id);
    return incoming.length === 1 && incoming[0].kind === 'default'
      && !conditional.some(other => other !== id && skipTarget(other) === id);
  };

  const raw: Omit<FlowLine, 'id'>[] = [];
  const groupLine = (group: typeof groups[number]) => {
    const members = group.screens.map(at => tree.steps[at].id);
    const last = members[members.length - 1];
    const fallback = defaultOf(last), hidden = hiddenOf(last);
    if (fallback) raw.push({ from: group.id, to: nodeOf(group.next), style: 'plain', edgeIds: [fallback.id, ...(hidden ? [hidden.id] : [])],
      insertEdgeId: tree.graph ? fallback.id : undefined, select: { index: group.screens[group.screens.length - 1], priority: fallback.priority },
      trace: [{ edges: [fallback.id, ...(hidden ? [hidden.id] : [])], any: members }] });
  };
  const order = graphDisplayOrder(tree);
  for (const index of order) {
    const screen = tree.steps[index];
    const id = screen.id;
    // A box's own line out is drawn where its first member stands in reading order.
    if (groupOf.has(id)) { if (groupOf.get(id)!.screens[0] === index) groupLine(groupOf.get(id)!); continue; }
    const answers = answersOf(id), fallback = defaultOf(id);
    answers.forEach(edge => {
      const words = edge.when ? ruleWords(edge.when, id) : { text: __('Choose an answer', 'wconvert'), problem: true };
      raw.push({ from: id, to: nodeOf(edge.to), style: 'answer', label: words.text, colour: colourOf(edge.when), problem: words.problem, edgeIds: [edge.id],
        insertEdgeId: tree.graph ? edge.id : undefined, select: { index, priority: edge.priority }, trace: [{ edges: [edge.id] }] });
    });
    if (fallback) {
      const select = { index, priority: fallback.priority };
      const insertEdgeId = tree.graph ? fallback.id : undefined;
      const group = groupOf.get(fallback.to);
      if (group && tree.steps[group.screens[0]].id === fallback.to) {
        const members = group.screens.map(at => tree.steps[at].id);
        raw.push({ from: id, to: group.id, style: 'plain', label: answers.length ? __('All other answers', 'wconvert') : __('Any of these', 'wconvert'),
          edgeIds: [fallback.id], insertEdgeId, select, trace: [{ edges: [fallback.id], all: [id], any: members }] });
        raw.push({ from: id, to: nodeOf(group.next), style: 'around', label: __('None of these', 'wconvert'), edgeIds: [fallback.id], select,
          trace: [{ edges: [fallback.id], all: [id], none: members }] });
      } else if (splits(fallback.to)) {
        const target = byId.get(fallback.to)!;
        const when = target.screen.when!;
        const words = ruleWords(when, id);
        const clause = when.clauses.length === 1 ? when.clauses[0] : undefined;
        const ownRule = !!clause && own(id).has(clause.question);
        raw.push({ from: id, to: fallback.to, style: 'answer', label: ownRule ? words.text : sprintf(/* translators: %s: a rule, e.g. “Interests includes Growing”. */ __('Only if %s', 'wconvert'), conditionText(tree, when)),
          colour: colourOf(when), edgeIds: [fallback.id], insertEdgeId, select, trace: [{ edges: [fallback.id], all: [id, fallback.to] }] });
        const skip = skipTarget(fallback.to);
        const around = answers.length || !clause || clause.operator !== 'includes_any' ? __('All other answers', 'wconvert')
          : ownRule ? sprintf(/* translators: %s: one or more answers. */ __('Without %s', 'wconvert'), answerWords(clause.question, clause.values))
            : conditionText(tree, { match: 'all', clauses: [{ ...clause, operator: 'includes_none' }] });
        const hidden = hiddenOf(fallback.to);
        if (skip) raw.push({ from: id, to: nodeOf(skip), style: 'around', label: around, edgeIds: [fallback.id, ...(hidden ? [hidden.id] : [])],
          insertEdgeId: tree.graph && hidden ? hidden.id : undefined, select: { index: target.index, priority: 'hidden' },
          trace: [{ edges: [fallback.id], all: [id], none: [fallback.to] }] });
      } else {
        raw.push({ from: id, to: nodeOf(fallback.to), style: 'plain', label: answers.length ? __('All other answers', 'wconvert') : undefined,
          edgeIds: [fallback.id], insertEdgeId, select, trace: [{ edges: [fallback.id] }] });
      }
    }
    // An "Only if" screen in the line: draw its own skip only where it goes somewhere else.
    if (screen.when && !splits(id)) {
      const skip = skipTarget(id);
      const skipEdge = hiddenOf(id) ?? fallback;
      if (skip && skipEdge && skip !== fallback?.to) raw.push({ from: id, to: nodeOf(skip), style: 'skipped', label: __('If skipped', 'wconvert'),
        edgeIds: [skipEdge.id], insertEdgeId: tree.graph && hiddenOf(id) ? hiddenOf(id)!.id : undefined, select: { index, priority: 'hidden' },
        trace: [{ edges: [skipEdge.id], none: [id] }] });
    }
  }
  // Two lines between the same two boxes are one line with both its words.
  const lines: FlowLine[] = [];
  for (const line of raw) {
    if (line.from === line.to) continue;
    const at = lines.findIndex(item => item.from === line.from && item.to === line.to);
    if (at < 0) { lines.push({ ...line, id: `${line.from}>${line.to}` }); continue; }
    const before = lines[at];
    const label = [before.label, line.label].filter(Boolean).join(' / ') || undefined;
    lines[at] = { ...before, label, colour: before.colour === line.colour ? before.colour : undefined,
      style: before.style === 'answer' || line.style === 'answer' ? 'answer' : before.style === 'plain' || line.style === 'plain' ? 'plain' : before.style,
      problem: before.problem || line.problem, edgeIds: [...new Set([...before.edgeIds, ...line.edgeIds])], trace: [...before.trace, ...line.trace] };
  }

  // A line keeps its answer's colour until a card with more than one line in.
  const nodes = [...new Set(order.map(index => nodeOf(tree.steps[index].id)))];
  const nodeColour = new Map<string, number | undefined>();
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const node of nodes) {
      const into = lines.filter(line => line.to === node);
      const colour = into.length && into.every(line => line.colour && line.colour === into[0].colour) ? into[0].colour : undefined;
      if (nodeColour.get(node) !== colour) { nodeColour.set(node, colour); changed = true; }
    }
    lines.forEach((line, at) => {
      if (line.style !== 'plain' || line.label) return;
      const colour = nodeColour.get(line.from);
      if (line.colour !== colour) { lines[at] = { ...line, colour }; changed = true; }
    });
    if (!changed) break;
  }

  const unreachable = new Set(unreachableScreenIds(tree));
  const kindOf = (index: number): CardKind => {
    const screen = tree.steps[index];
    if (screen.kind === 'acknowledgement') return 'ending';
    if (screen.kind === 'result') return 'result';
    const nodes = walkNodes(screen.content);
    if (nodes.some(node => node.type === 'question')) return 'question';
    // A form is its fields as much as its submit button: split capture asks on one screen and saves on the next.
    return nodes.some(node => node.type === 'field' || node.type === 'consent' || node.type === 'button' && 'action' in node && node.action === 'submit') ? 'form' : 'message';
  };
  const targetName = (node: string) => groupOf.has(node) || groups.some(group => group.id === node) ? __('the follow-ups', 'wconvert') : name(node);
  const cards: FlowCard[] = order.filter(index => !groupOf.has(tree.steps[index].id)).map(index => {
    const screen = tree.steps[index];
    const kind = kindOf(index);
    const fallback = defaultOf(screen.id);
    const leaving = lines.filter(line => line.from === screen.id && line.style !== 'skipped');
    const answers = answersOf(screen.id);
    const submit = walkNodes(screen.content).find(node => node.type === 'button' && 'action' in node && node.action === 'submit');
    const optional = !!submit && 'submission' in submit && tree.submissions.find(item => item.id === submit.submission)?.required === false;
    const skip = screen.when && !splits(screen.id) ? skipTarget(screen.id) : undefined;
    const onlyIf = screen.when ? { text: conditionText(tree, screen.when), colour: colourOf(screen.when) } : undefined;
    const linesText = leaving.length > 1 ? sprintf(/* translators: 1: how many lines leave a screen. 2: “first match wins”, or their answers. */ _n('%1$d line · %2$s', '%1$d lines · %2$s', leaving.length, 'wconvert'),
      leaving.length, answers.length ? __('first match wins', 'wconvert') : leaving.map(line => line.label).filter(Boolean).join(', ')) : undefined;
    const then = fallback ? { target: fallback.to, name: targetName(nodeOf(fallback.to)), priority: Number(fallback.priority) } : undefined;
    const skipped = kind === 'ending' ? earlyEnding(tree, screen.id) : [];
    const endsWithout = skipped.length ? skipped : undefined;
    const results = screen.results?.map((result, at, all) => ({ id: result.id, heading: result.heading, colour: colourOf(result.when),
      fallback: !result.when && at === all.length - 1, needsCondition: !result.when && at < all.length - 1 }));
    const missingThen = !fallback && !['ending', 'result'].includes(kind) && (!!tree.graph || index < tree.steps.length - 1);
    const sentence = [sprintf(/* translators: 1: a screen's kind. 2: its name. */ __('%1$s: %2$s', 'wconvert'), kindWord(kind), screen.name),
      ...(onlyIf ? [sprintf(/* translators: %s: a rule. */ __('only if %s', 'wconvert'), onlyIf.text)] : []),
      ...(linesText ? [linesText] : then ? [sprintf(/* translators: %s: a screen's name. */ __('then %s', 'wconvert'), then.name)] : []),
      ...(endsWithout ? [endingWords(endsWithout, false)] : []),
      ...(unreachable.has(screen.id) ? [__('no line reaches it', 'wconvert')] : [])];
    return { id: screen.id, index, kind, name: screen.name, first: screen.id === entry,
      multi: walkNodes(screen.content).some(node => node.type === 'question' && 'answer_type' in node && node.answer_type === 'multi'), optional,
      ...(onlyIf ? { onlyIf } : {}), ...(then ? { then } : {}),
      ...(skip && skip !== fallback?.to ? { skip: { target: skip, name: targetName(nodeOf(skip)) } } : {}),
      ...(linesText ? { linesText, linePriority: Number(answers[0]?.priority ?? fallback?.priority ?? 0) } : {}),
      ...(endsWithout ? { endsWithout } : {}), ...(results ? { results } : {}),
      fallbackPriority: answers.length, unreachable: unreachable.has(screen.id), missingThen, colour: nodeColour.get(screen.id), label: sentence.join(', ') };
  });
  const boxes: FlowGroupBox[] = groups.map(group => {
    const source = followupGroupSource(tree, group);
    const question = tree.steps[group.screens[0]].when?.clauses[0]?.question;
    return { id: group.id, screens: group.screens,
      members: group.screens.map(at => {
        const screen = tree.steps[at];
        const clause = screen.when?.clauses.length === 1 ? screen.when.clauses[0] : undefined;
        return { id: screen.id, index: at, name: screen.name, answer: clause ? answerWords(clause.question, clause.values) : conditionText(tree, screen.when!), colour: colourOf(screen.when) };
      }),
      title: sprintf(/* translators: %s: a question or screen. */ __('Follow-ups · %s', 'wconvert'), source !== undefined ? tree.steps[source].name : questions.get(question ?? '')?.label ?? ''),
      next: nodeOf(group.next), nextName: targetName(nodeOf(group.next)), colour: nodeColour.get(group.id),
      unreachable: unreachable.has(tree.steps[group.screens[0]].id) };
  });
  return { cards, groups: boxes, lines, straight: !lines.some(line => line.label) && !cards.some(card => card.onlyIf), focusQuestion, nodeOf };
}

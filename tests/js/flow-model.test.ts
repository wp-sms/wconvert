import { describe, expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { journeyTrace } from '@loader/journey-rules';
import { flowModel, lineIsOn } from '../../resources/admin/src/builder/structure/flowModel';
import { journeyTraceEdges } from '../../resources/admin/src/builder/structure/journeyTraceEdges';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import splitCapture from '../fixtures/journey-graph-split-capture.json';
import paths from '../fixtures/journey-paths.json';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import coffee from '../fixtures/journey-graph-coffee.json';
import early from '../fixtures/journey-graph-early-endings.json';

const straight = splitCapture as unknown as TemplateTree;
const v2 = { v: 2, submissions: [], steps: paths.steps } as unknown as TemplateTree;
const summary = (tree: TemplateTree) => flowModel(tree).lines.map(line => `${line.from}>${line.to}${line.label ? ` “${line.label}”` : ''} ${line.style}`);

describe('a straight campaign', () => {
  it('is one line of cards that each say where they go', () => {
    const model = flowModel(straight);
    expect(model.straight).toBe(true);
    expect(model.cards.map(card => [card.id, card.kind])).toEqual([['details', 'form'], ['save', 'form'], ['thanks', 'ending']]);
    expect(model.cards.find(card => card.id === 'details')).toMatchObject({ first: true, then: { target: 'save', priority: 0 } });
    expect(summary(straight)).toEqual(['details>save plain', 'save>thanks plain']);
  });

  it('lets every line take a new screen where the campaign is a graph', () => {
    expect(flowModel(straight).lines.map(line => line.insertEdgeId)).toEqual(['continue', 'saved']);
    expect(flowModel(v2).lines.every(line => line.insertEdgeId === undefined)).toBe(true);
  });
});

describe('the edge-id contract', () => {
  it('names a version 2 tree’s lines the way a trace names them', () => {
    const model = flowModel(v2);
    const answers = { q_interest: ['garden'], q_garden: 'small' };
    const trace = journeyTrace(v2.steps, answers);
    const edges = journeyTraceEdges(v2, trace.decisions);
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) expect(model.lines.some(line => line.edgeIds.includes(edge)), edge).toBe(true);
    const visited = new Set(trace.indices.map(index => v2.steps[index].id));
    const on = model.lines.filter(line => lineIsOn(line, { screens: visited, edges: new Set(edges) }));
    expect(on.map(line => `${line.from}>${line.to}`)).toEqual(['interests>garden', 'garden>indoors', 'indoors>contact', 'contact>received']);
  });

  it('marks the same lines after the tree becomes a graph', () => {
    const graph = upgradeToGraph(v2);
    const trace = graphTrace(graph.steps, graph.graph!, { q_interest: ['indoors'], q_indoor: 'bright' });
    const visited = new Set(trace.indices.map(index => graph.steps[index].id));
    const on = flowModel(graph).lines.filter(line => lineIsOn(line, { screens: visited, edges: new Set(journeyTraceEdges(graph, trace.decisions)) }));
    expect(on.map(line => `${line.from}>${line.to}`)).toEqual(['interests>followups:garden', 'followups:garden>contact', 'contact>received']);
  });
});

type Spec = { id: string; kind?: 'input' | 'content' | 'result' | 'acknowledgement'; ask?: [type: 'single' | 'multi', ...values: string[]]; when?: [question: string, operator: 'is' | 'includes_any', ...values: string[]]; results?: TemplateTree['steps'][number]['results']; submit?: boolean };
const rule = ([question, operator, ...values]: [string, 'is' | 'includes_any', ...string[]]) => ({ match: 'all' as const, clauses: [{ question: `q_${question}`, operator, values }] });
const word = (value: string) => value[0].toUpperCase() + value.slice(1);
/** A graph from a few lines of shorthand: each screen, then `from>to`, `from>to?answer` or `from~to` (skip). */
function build(screens: Spec[], links: string[]): TemplateTree {
  return { v: 3, submissions: [], steps: screens.map(spec => ({ id: spec.id, name: word(spec.id), kind: spec.kind ?? 'input',
    content: { type: 'stack', children: [
      ...(spec.ask ? [{ type: 'question', id: `q_${spec.id}`, label: word(spec.id), answer_type: spec.ask[0], options: spec.ask.slice(1).map(value => ({ value, label: word(value) })) }] : []),
      ...(spec.submit ? [{ type: 'button', action: 'submit', submission: 'lead', label: 'Send' }] : []),
    ] }, ...(spec.when ? { when: rule(spec.when) } : {}), ...(spec.results ? { results: spec.results } : {}) })) as TemplateTree['steps'],
  graph: { entry: screens[0].id, edges: links.map(link => {
    const [, from, sep, to, answer] = /^(\w+)([>~])(\w+)(?:\?(.+))?$/.exec(link)!;
    const [question, operator, ...values] = (answer ?? '').split(':');
    return { id: link, from, to, kind: sep === '~' ? 'hidden' as const : answer ? 'answer' as const : 'default' as const,
      ...(answer ? { when: rule([question, operator as 'is', ...values]) } : {}) };
  }) } };
}

describe('“Only if” splits the line (ADR 0142)', () => {
  it('reads Includes / Without after a choose-several question', () => {
    const tree = build([{ id: 'interests', ask: ['multi', 'garden', 'indoors'] }, { id: 'garden', ask: ['single', 'small', 'large'], when: ['interests', 'includes_any', 'garden'] },
      { id: 'contact', submit: true }, { id: 'thanks', kind: 'acknowledgement' }], ['interests>garden', 'garden>contact', 'contact>thanks']);
    expect(summary(tree)).toEqual(['interests>garden “Includes Garden” answer', 'interests>contact “Without Garden” around', 'garden>contact plain', 'contact>thanks plain']);
    const model = flowModel(tree);
    expect(model.straight).toBe(false);
    expect(model.cards.find(card => card.id === 'interests')?.linesText).toBe('2 lines · Includes Garden, Without Garden');
    expect(model.lines.find(line => line.style === 'around')).toMatchObject({ insertEdgeId: undefined, select: { index: 1, priority: 'hidden' } });
  });

  it('reads the answer / All other answers after a choose-one question', () => {
    const tree = build([{ id: 'brew', ask: ['single', 'espresso', 'filter'] }, { id: 'grinder', ask: ['single', 'yes', 'no'], when: ['brew', 'is', 'filter'] },
      { id: 'thanks', kind: 'acknowledgement' }], ['brew>grinder', 'grinder>thanks']);
    expect(summary(tree)).toEqual(['brew>grinder “Filter” answer', 'brew>thanks “All other answers” around', 'grinder>thanks plain']);
  });

  it('keeps an “Only if” screen reached by two lines in the line, with its own skip', () => {
    const tree = build([{ id: 'style', ask: ['single', 'modern', 'classic'] }, { id: 'modern', kind: 'content' }, { id: 'classic', kind: 'content' },
      { id: 'light', ask: ['single', 'sun', 'shade'], when: ['style', 'is', 'modern'] }, { id: 'care', kind: 'content' }, { id: 'thanks', kind: 'acknowledgement' }],
    ['style>modern?style:is:modern', 'style>classic', 'modern>light', 'classic>light', 'light>care', 'light~thanks', 'care>thanks']);
    expect(summary(tree)).toEqual(['style>modern “Modern” answer', 'style>classic “All other answers” plain', 'modern>light plain', 'classic>light plain',
      'light>care plain', 'light>thanks “If skipped” skipped', 'care>thanks plain']);
    expect(flowModel(tree).cards.find(card => card.id === 'light')).toMatchObject({ onlyIf: { text: 'Style is Modern' }, skip: { target: 'thanks', name: 'Thanks' } });
  });

  it('draws several follow-ups as one box, Any of these in and None of these around', () => {
    const tree = enquiry as unknown as TemplateTree;
    const model = flowModel(tree);
    expect(summary(tree)).toEqual(['interests>followups:garden “Any of these” plain', 'interests>contact “None of these” around', 'followups:garden>contact plain', 'contact>received plain']);
    expect(model.groups[0].members.map(member => member.answer)).toEqual(['Garden', 'Indoors', 'Balcony']);
    expect(model.lines.find(line => line.label === 'None of these')?.insertEdgeId).toBeUndefined();
    const trace = graphTrace(tree.steps, tree.graph!, { n1: ['balcony'], n4: 'small' });
    const on = model.lines.filter(line => lineIsOn(line, { screens: new Set(trace.indices.map(index => tree.steps[index].id)), edges: new Set(journeyTraceEdges(tree, trace.decisions)) }));
    expect(on.map(line => line.id)).toEqual(['interests>followups:garden', 'followups:garden>contact', 'contact>received']);
    const none = graphTrace(tree.steps, tree.graph!, { n1: [] });
    expect(model.lines.filter(line => lineIsOn(line, { screens: new Set(none.indices.map(index => tree.steps[index].id)), edges: new Set(journeyTraceEdges(tree, none.decisions)) })).map(line => line.id))
      .toEqual(['interests>contact', 'contact>received']);
  });
});

describe('colour means an answer (ADR 0142)', () => {
  const coffeeTree = (coffee as unknown as { template?: { tree: TemplateTree } }).template?.tree ?? coffee as unknown as TemplateTree;

  it('gives a line, the card it leads to and the result that use one answer one colour', () => {
    const model = flowModel(coffeeTree);
    const filter = model.lines.find(line => line.to === 'grind')!;
    expect(filter.colour).toBe(2);
    expect(model.cards.find(card => card.id === 'grind')?.colour).toBe(2);
    expect(model.lines.find(line => line.id === 'grind>result')?.colour).toBe(2);
    expect(model.cards.find(card => card.id === 'result')?.colour).toBeUndefined();
    expect(model.cards.find(card => card.id === 'result')?.results?.map(result => [result.id, result.colour, result.fallback])).toEqual([['espresso', undefined, false], ['filter', 2, false], ['fallback', undefined, true]]);
  });

  it('past six coloured answers, keeps colour only on the question in focus', () => {
    const values = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const tree = build([{ id: 'pick', ask: ['single', ...values] }, { id: 'size', ask: ['single', 'big', 'small'] }, ...values.map(value => ({ id: `go${value}`, kind: 'content' as const })),
      { id: 'tip', kind: 'content', when: ['size', 'is', 'big'] }, { id: 'end', kind: 'acknowledgement' }],
    ['pick>size', ...values.map(value => `size>go${value}?pick:is:${value}`), 'size>tip', 'tip>end', ...values.map(value => `go${value}>end`)]);
    const answerColours = (selectedQuestion?: string) => flowModel(tree, { selectedQuestion }).lines.filter(line => line.style === 'answer').map(line => line.colour);
    expect(flowModel(tree).focusQuestion).toBe('q_pick');
    expect(answerColours()).toEqual([1, 2, 3, 4, 5, 6, undefined, undefined]);
    expect(flowModel(tree, { selectedQuestion: 'q_size' }).focusQuestion).toBe('q_size');
    expect(answerColours('q_size')).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1]);
  });
});

describe('early endings (ADR 0142)', () => {
  it('says an early ending ends without saving details', () => {
    const tree = early.cases[0].tree as unknown as TemplateTree;
    const ending = flowModel(tree).cards.find(card => card.id === 'not_fit')!;
    expect(ending.endsWithout).toBe('details');
    expect(ending.label).toContain('ends without saving details');
    expect(flowModel(tree).cards.find(card => card.id === 'received')?.endsWithout).toBeUndefined();
  });
});

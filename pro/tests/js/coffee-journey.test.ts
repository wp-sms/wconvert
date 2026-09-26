import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';
import { bindJourney } from '../../modules/journeys/loader/journey';
import { registerPremiumJourneyRenderer } from '../../modules/journeys/loader/render';
import { graphTrace } from '@loader/journey-graph';
import { chooseResult } from '@loader/journey-rules';
import fixture from '../../../tests/fixtures/journey-graph-coffee.json';

registerPremiumJourneyRenderer();
const template = fixture.template as Template;
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
function visitor() {
  const anchor = document.createElement('div'); document.body.append(anchor);
  const mounted = mount({ template, displayType: 'inline', anchor }); mounted.show();
  const captured = vi.fn(); const completed = vi.fn();
  bindJourney(mounted, { id: 'coffee', template, capture_contract: 'coffee-contract' }, { onCaptured: captured, onCompleted: completed });
  const root = () => mounted.root!;
  const choose = (value: string) => root().querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click();
  const act = (action: string) => root().querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)!.click();
  return { mounted, root, choose, act, captured, completed };
}

it.each(fixture.cases)('routes and completes anonymously for $name', example => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const tree = template.tree;
  const trace = graphTrace(tree.steps, tree.graph!, example.answers);
  expect(trace.indices.map(index => tree.steps[index].id)).toEqual(example.visible);
  expect(trace.answers).toEqual(example.active);
  const results = tree.steps.find(screen => screen.kind === 'result')!.results!;
  expect(chooseResult(results, trace.answers)?.id).toBe(example.result);
  const journey = visitor();
  journey.choose(example.answers.n1); journey.act('next');
  for (const taste of example.answers.n2) journey.choose(taste);
  journey.act('next');
  if (example.answers.n1 === 'filter') {
    expect(journey.root().textContent).toContain('Do you grind your own beans?');
    journey.choose(example.answers.n3); journey.act('next');
  }
  expect(journey.root().querySelector('[data-result-heading]')?.textContent).toBe(results.find(result => result.id === example.result)!.heading);
  expect(journey.root().textContent).not.toContain('Email address');
  journey.act('next'); journey.act('skip');
  expect(journey.root().textContent).toContain('Thanks for visiting');
  expect(journey.completed).toHaveBeenCalledOnce();
  expect(journey.captured).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  journey.mounted.close();
});

it('retains taste but permanently clears a grinder answer after leaving and re-entering its branch', () => {
  const journey = visitor();
  journey.choose('filter'); journey.act('next'); journey.choose('bright'); journey.act('next'); journey.choose('yes'); journey.act('next');
  journey.act('back'); journey.act('back'); journey.act('back');
  journey.choose('espresso'); journey.act('next');
  expect(journey.root().querySelector<HTMLInputElement>('input[value="bright"]')?.checked).toBe(true);
  journey.act('next');
  expect(journey.root().textContent).toContain('An easy everyday favourite');
  journey.act('back'); journey.act('back'); journey.choose('filter'); journey.act('next'); journey.act('next');
  expect(journey.root().querySelector<HTMLInputElement>('input[value="yes"]')?.checked).toBe(false);
  journey.act('next');
  expect(journey.root().textContent).toContain('Do you grind your own beans?');
  expect(journey.completed).toHaveBeenCalledOnce();
  journey.mounted.close();
});

it('chooses the first overlapping result and uses fallback for an optional unanswered taste', () => {
  const results = template.tree.steps.find(screen => screen.kind === 'result')!.results!;
  const general = { ...results[0], id: 'any-espresso', when: { match: 'all' as const, clauses: [{ question: 'n1', operator: 'is' as const, values: ['espresso'] }] } };
  const answers = { n1: 'espresso', n2: ['bold', 'bright'] };
  expect(chooseResult([results[0], general, ...results.slice(1)], answers)?.id).toBe('espresso');
  expect(chooseResult([general, ...results], answers)?.id).toBe('any-espresso');
  expect(chooseResult(results, { n1: 'espresso' })?.id).toBe('fallback');
});

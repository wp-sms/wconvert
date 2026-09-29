import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';
import { bindJourney } from '../../modules/journeys/loader/journey';
import { registerPremiumJourneyRenderer } from '../../modules/journeys/loader/render';
import { chooseResult } from '@loader/journey-rules';

registerPremiumJourneyRenderer();
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
const cases: [string, string[][], string][] = [
  ['gift-edit', [['growing'], ['under30']], 'growing_small'],
  ['gift-edit', [['growing'], ['over30']], 'growing_set'],
  ['gift-edit', [['home'], ['under30']], 'home_small'],
  ['gift-edit', [['home'], ['over30']], 'home_set'],
  ['space-planner', [['compact', 'grow']], 'compact_plant'],
  ['space-planner', [['roomy', 'grow']], 'roomy_plant'],
  ['space-planner', [['compact', 'organise']], 'compact_storage'],
  ['space-planner', [['roomy', 'organise']], 'roomy_storage'],
  ['kit-workbench', [['starting']], 'starter'],
  ['kit-workbench', [['experienced'], ['space']], 'compact'],
  ['kit-workbench', [['experienced'], ['collection']], 'collection'],
  ['service-directory', [['room', 'ideas']], 'room_ideas'],
  ['service-directory', [['room', 'ready']], 'room_ready'],
  ['service-directory', [['garden', 'ideas']], 'garden_ideas'],
  ['service-directory', [['garden', 'ready']], 'garden_ready'],
  ['service-directory', [['unsure', 'ideas']], 'fallback'],
  ['service-directory', [['unsure', 'ready']], 'fallback'],
  ['project-route', [['planning']], 'planning'],
  ['project-route', [['consulting']], 'consulting'],
  ['project-route', [['estimating']], 'estimating'],
  ['reading-path', [['writing'], ['beginner']], 'writing_beginner'],
  ['reading-path', [['writing'], ['deeper']], 'writing_deeper'],
  ['reading-path', [['growing'], ['beginner']], 'growing_beginner'],
  ['reading-path', [['growing'], ['deeper']], 'growing_deeper'],
];
function visitor(id: string) {
  const design = JSON.parse(readFileSync(`pro/modules/journeys/templates/${id}.json`, 'utf8'));
  const template: Template = { tree: design.tree, tokens: design.tokens };
  const anchor = document.createElement('div'); document.body.append(anchor);
  const mounted = mount({ template, displayType: 'inline', anchor }); mounted.show();
  const completed = vi.fn(), captured = vi.fn();
  bindJourney(mounted, { id, template, capture_contract: 'review-contract' }, { onCompleted: completed, onCaptured: captured });
  const root = () => mounted.root!;
  const choose = (value: string) => root().querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click();
  const act = (action: string) => root().querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)!.click();
  return { template, mounted, root, choose, act, completed, captured };
}
it.each(cases)('%s navigates %j to %s without collecting contact details', (id, path, expected) => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const v = visitor(id);
  for (const values of path) {
    const heading = v.root().textContent;
    v.act('next'); // Required unanswered questions keep the visitor on this screen.
    expect(v.root().textContent).toContain(heading?.split('\n')[0] ?? '');
    expect(v.root().querySelector('[data-result-heading]')).toBeNull();
    values.forEach(v.choose); v.act('next');
  }
  const results = v.template.tree.steps.find(s => s.kind === 'result')!.results!;
  expect(v.root().querySelector('[data-result-heading]')?.textContent).toBe(results.find(r => r.id === expected)!.heading);
  expect(chooseResult(results, {})?.id).toBe('fallback');
  expect(v.completed).toHaveBeenCalledOnce();
  expect(v.captured).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  v.mounted.close();
});
it('clears the kit project answer when Back changes experience and requires a fresh answer on re-entry', () => {
  const v = visitor('kit-workbench');
  v.choose('experienced'); v.act('next'); v.choose('space'); v.act('next');
  v.act('back'); v.act('back'); v.choose('starting'); v.act('next');
  expect(v.root().textContent).toContain('Start with one plant');
  v.act('back'); v.choose('experienced'); v.act('next');
  expect(v.root().querySelector<HTMLInputElement>('input[value="space"]')?.checked).toBe(false);
  v.act('next'); expect(v.root().querySelector('[data-result-heading]')).toBeNull();
  v.choose('collection'); v.act('next'); expect(v.root().textContent).toContain('Add a coordinated growing set');
  v.mounted.close();
});

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import type { QuestionNode, TemplateTree } from '@renderer/types';
import { graphTrace } from '@loader/journey-graph';
import { journeyCapturePrefix } from '@loader/journey-capture';
import { chooseResult, journeyPath, type Answers } from '@loader/journey-rules';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { walkNodes } from '../../resources/admin/src/builder/structure/journey';

const roots = [resolve('resources/templates/library'),
  ...readdirSync(resolve('pro/modules'), { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => resolve('pro/modules', entry.name, 'templates'))];
const designs = roots.flatMap(root => {
  try { return readdirSync(root).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(resolve(root, file), 'utf8')) as { id: string; tree: TemplateTree }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
});

/** All answer combinations for the small shipped examples, including optional blanks. */
function samples(tree: TemplateTree): Answers[] {
  const questions = tree.steps.flatMap(screen => walkNodes(screen.content))
    .filter((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node);
  return questions.reduce<Answers[]>((answers, question) => {
    const choices = question.options?.map(option => option.value) ?? [];
    const values: (string | string[])[] = question.answer_type === 'text' ? ['', 'Sample enquiry']
      : question.answer_type === 'multi' ? Array.from({ length: 2 ** choices.length }, (_, mask) => choices.filter((_, index) => mask & (1 << index)))
        : ['', ...choices];
    return answers.flatMap(answer => values.map(value => ({ ...answer, [question.id]: value })));
  }, [{}]);
}

it('includes the Free library and every installed Pro template module', () => {
  expect(designs.length).toBeGreaterThanOrEqual(60);
  expect(new Set(designs.map(design => design.id)).size).toBe(designs.length);
});

it.each(designs)('$id preserves visitor paths, results and save boundaries through graph upgrade and JSON round-trip', ({ tree }) => {
  const original = JSON.stringify(tree);
  const upgraded = upgradeToGraph(tree);
  // Saved JSON and storage order must not decide graph visitation order.
  const saved: TemplateTree = JSON.parse(JSON.stringify({ ...upgraded, steps: [...upgraded.steps].reverse() }));
  expect(saved.submissions).toEqual(tree.submissions);
  for (const answers of samples(tree)) {
    const before = tree.graph ? graphTrace(tree.steps, tree.graph, answers) : journeyPath(tree.steps, answers);
    const after = graphTrace(saved.steps, saved.graph!, answers);
    expect(after.indices.map(index => saved.steps[index].id)).toEqual(before.indices.map(index => tree.steps[index].id));
    expect(after.answers).toEqual(before.answers);
    for (const screen of tree.steps) {
      if (screen.results) expect(chooseResult(screen.results, after.answers)).toEqual(chooseResult(screen.results, before.answers));
      if (!walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')) continue;
      const oldCapture = journeyCapturePrefix(tree.steps, tree.graph, tree.steps.indexOf(screen), answers);
      const newCapture = journeyCapturePrefix(saved.steps, saved.graph, saved.steps.findIndex(item => item.id === screen.id), answers);
      expect(newCapture?.questionIds).toEqual(oldCapture?.questionIds);
      expect(newCapture?.answers).toEqual(oldCapture?.answers);
      expect(newCapture?.indices.map(index => saved.steps[index].id)).toEqual(oldCapture?.indices.map(index => tree.steps[index].id));
    }
  }
  expect(JSON.stringify(tree)).toBe(original);
});

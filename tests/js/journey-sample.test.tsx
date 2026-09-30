import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { JourneySample } from '../../resources/admin/src/builder/JourneySample';
import type { TemplateScreen, TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-paths.json';
import graphFixture from '../fixtures/journey-graph.json';

it('explains a branch bypass using the actual winning route', async () => {
  const user = userEvent.setup();
  const steps = structuredClone(fixture.steps) as TemplateScreen[];
  const when = (value: string) => ({ match: 'all' as const, clauses: [
    { question: 'q_interest', operator: 'includes_any' as const, values: [value] },
  ] });
  steps[0] = { ...steps[0], paths: [{ to: 'indoors', when: when('indoors') }, { to: 'garden', when: when('garden') }, { to: 'contact' }] };
  const tree: TemplateTree = { v: 2, steps, submissions: [] };
  render(<JourneySample tree={tree} onTrace={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()} />);
  const interests = screen.getByRole('group', { name: 'What interests you?' });
  await user.click(within(interests).getByRole('checkbox', { name: 'Indoors' }));
  expect(screen.getByText('Interests went directly to Indoor details on a different path.')).toBeInTheDocument();
  expect(screen.getByText('Interests: 1 path wins; later matches are ignored.')).toBeInTheDocument();
});

it('shows graph routes in visitor order even when stored screens are unordered', async () => {
  const user = userEvent.setup();
  const tree = { v: 3, steps: graphFixture.steps, graph: graphFixture.graph, submissions: [] } as unknown as TemplateTree;
  const onTrace = vi.fn();
  render(<JourneySample tree={tree} onTrace={onTrace} onSelect={vi.fn()} onClose={vi.fn()} />);
  const interests = screen.getByRole('group', { name: 'What interests you?' });
  expect(onTrace).toHaveBeenLastCalledWith([2, 4, 0, 3]);
  expect(screen.getByText('Indoor details').closest('.wconvert-journey-sample__skipped')).toBeInTheDocument();
  await user.click(within(interests).getByRole('checkbox', { name: 'Indoors' }));
  expect(onTrace).toHaveBeenLastCalledWith([2, 4, 1, 0, 3]);
  expect(screen.getByRole('group', { name: 'Indoor light?' })).toBeInTheDocument();
});

it('discloses seeded sample choices and resets them without treating them as a visitor test', async () => {
  const user = userEvent.setup();
  const tree = { v: 3, steps: graphFixture.steps, graph: graphFixture.graph, submissions: [] } as unknown as TemplateTree;
  render(<JourneySample tree={tree} onTrace={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText(/Sample starts with the first answer/)).toBeInTheDocument();
  const interests = screen.getByRole('group', { name: 'What interests you?' });
  await user.click(within(interests).getByRole('checkbox', { name: 'Indoors' }));
  expect(within(interests).getByRole('checkbox', { name: 'Indoors' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Reset sample answers' }));
  expect(within(interests).getByRole('checkbox', { name: 'Indoors' })).not.toBeChecked();
  expect(screen.getByText(/Predicted path/)).toBeInTheDocument();
});

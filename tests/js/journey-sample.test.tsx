import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { JourneySample } from '../../resources/admin/src/builder/JourneySample';
import type { TemplateScreen, TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-paths.json';
import graphFixture from '../fixtures/journey-graph.json';
import signup from '../../resources/templates/library/journey-email-then-sms.json';

it('does not choose a fallback or infer a later answer before the merchant answers', async () => {
  const user = userEvent.setup();
  const steps = structuredClone(fixture.steps) as TemplateScreen[];
  const when = (value: string) => ({ match: 'all' as const, clauses: [{ question: 'q_interest', operator: 'includes_any' as const, values: [value] }] });
  steps[0] = { ...steps[0], paths: [{ to: 'indoors', when: when('indoors') }, { to: 'garden', when: when('garden') }, { to: 'contact' }] };
  const onTrace = vi.fn(), onShowPath = vi.fn();
  render(<JourneySample tree={{ v: 2, steps, submissions: [] }} onTrace={onTrace} onShowPath={onShowPath} onSelect={vi.fn()} onClose={vi.fn()} />);
  expect(onTrace).toHaveBeenLastCalledWith([0]);
  expect(screen.queryByText(/path wins/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show sample path on the map' }));
  expect(onShowPath).toHaveBeenLastCalledWith([0], []);
  await user.click(screen.getByRole('checkbox', { name: 'Indoors' }));
  expect(onTrace).toHaveBeenLastCalledWith([0, 2]);
  expect(screen.getByText('Interests: 1 path wins; later matches are ignored.')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Bright' })).not.toBeChecked();
  expect(screen.queryByText(/Prediction complete/)).not.toBeInTheDocument();
});

it('predicts graph routes in visitor order and discards answers from a removed branch', async () => {
  const user = userEvent.setup();
  const tree = { v: 3, steps: graphFixture.steps, graph: graphFixture.graph, submissions: [] } as unknown as TemplateTree;
  const onTrace = vi.fn();
  render(<JourneySample tree={tree} onTrace={onTrace} onSelect={vi.fn()} onClose={vi.fn()} />);
  expect(onTrace).toHaveBeenLastCalledWith([2]);
  await user.click(screen.getByRole('checkbox', { name: 'Garden' }));
  expect(onTrace).toHaveBeenLastCalledWith([2, 4]);
  await user.click(screen.getByRole('radio', { name: 'Small' }));
  expect(onTrace).toHaveBeenLastCalledWith([2, 4, 0, 3]);
  await user.click(screen.getByRole('checkbox', { name: 'Indoors' }));
  expect(onTrace).toHaveBeenLastCalledWith([2, 4, 1]);
  await user.click(screen.getByRole('radio', { name: 'Bright' }));
  expect(onTrace).toHaveBeenLastCalledWith([2, 4, 1, 0, 3]);
  await user.click(screen.getByRole('checkbox', { name: 'Indoors' }));
  expect(screen.queryByRole('group', { name: 'Indoor light?' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'Indoors' }));
  expect(screen.getByRole('radio', { name: 'Bright' })).not.toBeChecked();
  expect(onTrace).toHaveBeenLastCalledWith([2, 4, 1]);
});

it('lets an optional question remain unanswered deliberately, and resets to no assumptions', async () => {
  const user = userEvent.setup();
  const tree = { v: 3, steps: graphFixture.steps, graph: graphFixture.graph, submissions: [] } as unknown as TemplateTree;
  const onTrace = vi.fn();
  render(<JourneySample tree={tree} onTrace={onTrace} onSelect={vi.fn()} onClose={vi.fn()} />);
  await user.click(screen.getByRole('checkbox', { name: 'Garden' }));
  await user.click(within(screen.getByRole('group', { name: 'Garden size?' })).getByRole('button', { name: 'Leave unanswered' }));
  expect(onTrace).toHaveBeenLastCalledWith([2, 4, 0, 3]);
  await user.click(screen.getByRole('button', { name: 'Reset sample answers' }));
  expect(screen.getByRole('checkbox', { name: 'Garden' })).not.toBeChecked();
  expect(onTrace).toHaveBeenLastCalledWith([2]);
});

it('requires explicit submit or skip choices and never treats them as completed tests', async () => {
  const user = userEvent.setup(), onTrace = vi.fn();
  render(<JourneySample tree={signup.tree as TemplateTree} onTrace={onTrace} onSelect={vi.fn()} onClose={vi.fn()} />);
  expect(onTrace).toHaveBeenLastCalledWith([0]);
  await user.selectOptions(screen.getByRole('combobox', { name: signup.tree.steps[0].name }), 'submit');
  expect(onTrace).toHaveBeenLastCalledWith([0, 1]);
  await user.selectOptions(screen.getByRole('combobox', { name: signup.tree.steps[1].name }), 'skip');
  expect(onTrace).toHaveBeenLastCalledWith([0, 1, 2]);
  expect(screen.getByText('1 submission would be made with these choices.')).toBeInTheDocument();
  expect(screen.getByText(/Predictions do not count as completed tests/)).toBeInTheDocument();
});

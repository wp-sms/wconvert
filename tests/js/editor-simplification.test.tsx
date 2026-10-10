import { AdvancedContext, AdvancedToggle } from '../../resources/admin/src/builder/advanced';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Template, TemplateTree } from '@renderer/types';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';
import { GraphRouteSettings } from '../../resources/admin/src/builder/GraphRouteSettings';
import { ResultSettings, QuestionSettings } from '../../resources/admin/src/builder/JourneySettings';
import { JourneyConsentSettings } from '../../resources/admin/src/builder/JourneyConsentSettings';
import { Tokens } from '../../resources/admin/src/builder/Tokens';
import { walkNodes } from '../../resources/admin/src/builder/structure/journey';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import coffee from '../fixtures/journey-graph-coffee.json';
import signup from '../../resources/templates/library/journey-email-then-sms.json';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn().mockResolvedValue([]) }));
afterEach(cleanup);
const labels = { roles: {}, nodes: {}, layouts: {}, layoutNotes: {}, layoutParams: {}, layoutParamValues: {}, nodeParams: {}, nodeParamValues: {}, fields: {}, keys: {}, placeholders: {}, tokens: {}, tokenValues: {} } as TemplateLabels;
it('keeps a child follow-up on the shared continuation until custom routing is requested', () => {
  const tree = enquiry as unknown as TemplateTree, change = vi.fn();
  render(<GraphRouteSettings tree={tree} step={tree.steps.findIndex(item => item.id === 'garden')} onChange={change} onInsert={() => {}} />);
  expect(screen.getByRole('combobox', { name: 'After the relevant questions' })).toHaveValue('contact');
  expect(screen.queryByRole('combobox', { name: 'If skipped, go to' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Send some answers down another path' }));
  // A skip edge to where the screen would have gone anyway reads as falling through (ADR 0135).
  expect(screen.getByRole('combobox', { name: 'If skipped, go to' })).toHaveValue('');
  expect(change).not.toHaveBeenCalled();
});
it('selecting a result updates the canvas selection without changing matching rules', () => {
  const base = coffee.template.tree as unknown as TemplateTree;
  const tree = { ...base, steps: base.steps.map(item => ({ ...item, products_required: false, results: item.results?.map(result => ({ ...result, product_ids: [] })) })) }, change = vi.fn(), select = vi.fn();
  const step = tree.steps.findIndex(item => item.kind === 'result');
  render(<ResultSettings tree={tree} step={step} onChange={change} onResultSelect={select} />);
  expect(select).toHaveBeenLastCalledWith(tree.steps[step].results![0].id);
  fireEvent.click(screen.getByRole('button', { name: /^A fresh start/ }));
  expect(select).toHaveBeenLastCalledWith(tree.steps[step].results![1].id);
  expect(screen.getByRole('button', { name: 'Search catalog' })).not.toBeVisible();
  fireEvent.click(screen.getByText('Products'));
  expect(screen.getByRole('button', { name: 'Search catalog' })).toBeVisible();
  expect(change).not.toHaveBeenCalled();
});
it('reviews referenced answer-type changes before applying them as one edit', () => {
  const tree = coffee.template.tree as unknown as TemplateTree, change = vi.fn();
  render(<QuestionSettings tree={tree} step={tree.steps.findIndex(item => item.id === 'brew')} onChange={change} onSelect={() => {}} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Answer type' }), { target: { value: 'multi' } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('region', { name: 'Review answer type change' })).getByRole('button', { name: 'Apply answer type change' }));
  expect(change).toHaveBeenCalledTimes(1);
  expect(walkNodes(change.mock.calls[0][0].steps.find((item: { id: string }) => item.id === 'brew').content).find(node => node.type === 'question')).toMatchObject({ answer_type: 'multi' });
});
it('edits SMS consent without changing email consent or submission ownership', () => {
  const tree = signup.tree as TemplateTree, change = vi.fn();
  render(<JourneyConsentSettings tree={tree} step={1} labels={labels} onChange={change} />);
  // The Consent disclosure is the Form section's now (ADR 0136); this draws the wording itself.
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Text me product updates.' } });
  const next = change.mock.calls.at(-1)![0] as TemplateTree;
  expect(next.steps[0]).toEqual(tree.steps[0]);
  expect(next.submissions).toEqual(tree.submissions);
  expect(walkNodes(next.steps[1].content).find(node => node.type === 'consent')).toMatchObject({ text: 'Text me product updates.' });
});
it('offers essential presets and preserves custom measurements when Advanced opens', () => {
  const initial = { ...signup, tokens: { ...signup.tokens, width: '37ch' } } as Template;
  const change = vi.fn();
  // The Look's one Advanced switch is the panel's (ADR 0136); Tokens reads it.
  function Styles() {
    const [open, setOpen] = useState<string | null>(null);
    const [advanced, setAdvanced] = useState(false);
    return <AdvancedContext.Provider value={advanced}><AdvancedToggle advanced={advanced} onToggle={() => setAdvanced(value => !value)} />
      <Tokens template={initial} labels={labels} design={signup.tokens} openToken={open} onOpenToken={setOpen} onChange={change} onError={() => {}} /></AdvancedContext.Provider>;
  }
  render(<Styles />);
  expect(screen.getByRole('option', { name: 'Custom (37ch)' })).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'width unit' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  expect(screen.getByRole('combobox', { name: /width unit/i })).toHaveValue('ch');
  expect(change).not.toHaveBeenCalled();
});

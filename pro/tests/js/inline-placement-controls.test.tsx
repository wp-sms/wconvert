import { displayPlan } from '../../../tests/js/support/display-entry';
import { ruleTypes } from '../../../tests/js/support/rule-types';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, onTestFinished, vi } from 'vitest';
import PlacementSettings from '../../modules/inline-placement/admin/PlacementSettings';
import { InlinePlacementSettings } from '@/inlinePlacement';
import { PlacementGuidance } from '@/builder/PlacementGuidance';
import type { RuleVocabulary } from '@/builder/api';
import { DisplayRules, type DisplayRulesValue } from '@/builder/rules/DisplayRules';
import { planFrom } from '@/builder/rules/plan';

const vocabulary = { triggers: [{ type: 'page_load' }, { type: 'time_on_page' }], conditions: [], targeting: [] } as unknown as RuleVocabulary;

it('groups the placement choices without repeating the section heading', () => {
  render(<PlacementSettings optinId="example" published config={{}} vocabulary={vocabulary} onChange={() => undefined} />);
  const choices = screen.getByRole('group', { name: 'Placement method' });
  expect(within(choices).getByRole('radio', { name: 'Manual' })).toBeChecked();
  expect(within(choices).getByRole('radio', { name: 'Automatic' })).not.toBeChecked();
  expect(screen.queryByText('Inline placement')).toBeNull();
});

it('names what switching to automatic changes elsewhere, preserves other settings and can return to manual', async () => {
  const user = userEvent.setup();
  function Editor() {
    const [config, setConfig] = useState<Record<string, unknown>>({ display_rules: displayPlan([{ type: 'time_on_page', seconds: 10 }], [{ type: 'device', value: ['mobile'] }]), targeting: { exclude: [{ type: 'post', value: 4 }] }, frequency: { maxImpressions: 2 } });
    return <><PlacementSettings optinId="example" published config={config} vocabulary={ruleTypes()} onChange={(patch) => setConfig({ ...config, ...patch })} /><output data-testid="config">{JSON.stringify(config)}</output></>;
  }
  render(<Editor />);
  await user.click(screen.getByRole('radio', { name: 'Automatic' }));
  const confirm = screen.getByRole('region', { name: 'Switch to automatic placement?' });
  expect(within(confirm).getByText('When does it open?').closest('li')).toHaveTextContent('After 10 secondsRight away');
  expect(within(confirm).getByText('Where does it show?').closest('li')).toHaveTextContent('Blog posts only');
  expect(screen.getByText('Switch to automatic placement?')).toHaveFocus();
  expect(screen.getByRole('radio', { name: 'Manual' })).toBeChecked();
  expect(screen.getByTestId('config')).toHaveTextContent('time_on_page');
  await user.click(screen.getByRole('button', { name: 'Switch to automatic placement' }));
  const current = () => JSON.parse(screen.getByTestId('config').textContent!);
  expect(current()).toMatchObject({ inline_placement: { position: 'after_content' }, display_rules: displayPlan([{ type: 'page_load' }], [{ type: 'device', value: ['mobile'] }]), targeting: { include: [{ type: 'singular', value: 'post' }], exclude: [{ type: 'post', value: 4 }] }, frequency: { maxImpressions: 2 } });
  await user.click(screen.getByRole('radio', { name: 'After a paragraph' }));
  await user.selectOptions(screen.getByLabelText('If there are fewer paragraphs'), 'skip');
  expect(current().inline_placement).toEqual({ position: 'after_paragraph', paragraph: 3, fallback: 'skip' });
  await user.clear(screen.getByLabelText('Paragraph number'));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole paragraph number');
  await user.type(screen.getByLabelText('Paragraph number'), '10');
  expect(current().inline_placement.paragraph).toBe(10);
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('radio', { name: 'Manual' }));
  expect(current().inline_placement).toBeNull();
  expect(current().display_rules.opening).toEqual({ mode: 'immediate' });
});

it('switches without asking when nothing else would change, and keeps deliberate page targeting', async () => {
  const user = userEvent.setup();
  let changes: Record<string, unknown> = {};
  render(<PlacementSettings optinId="example" published config={{ targeting: { include: [{ type: 'post', value: 99 }] }, display_rules: displayPlan([{ type: 'page_load' }]) }} vocabulary={vocabulary} onChange={(patch) => { changes = patch; }} />);
  await user.click(screen.getByRole('radio', { name: 'Automatic' }));
  expect(screen.queryByRole('region', { name: /Switch to/ })).toBeNull();
  expect(changes).toMatchObject({ inline_placement: { position: 'after_content' } });
  expect(changes).not.toHaveProperty('targeting');
});

it('cancels a switch and keeps the method in use', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<PlacementSettings optinId="example" published config={{ display_rules: displayPlan([{ type: 'time_on_page', seconds: 10 }]) }} vocabulary={vocabulary} onChange={onChange} />);
  await user.click(screen.getByRole('radio', { name: 'Content lock' }));
  const confirm = screen.getByRole('region', { name: 'Switch to content lock?' });
  expect(within(confirm).queryByText('Where does it show?')).toBeNull();
  // Cancel first and the action last, as in every dialog.
  expect(within(confirm).getAllByRole('button').map((button) => button.textContent)).toEqual(['Keep Manual', 'Switch to content lock']);
  await user.click(screen.getByRole('button', { name: 'Keep Manual' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: 'Manual' })).toBeChecked();
});

it('choosing automatic placement or a content lock sets Right away, and When then holds it', async () => {
  const user = userEvent.setup();
  // The builder's wiring: the placement controls sit under Where, and either method holds When at Right away.
  function Builder() {
    const [config, setConfig] = useState<Record<string, unknown>>({ display_rules: displayPlan([{ type: 'time_on_page', seconds: 10 }]), targeting: { include: [{ type: 'post', value: 99 }] }, frequency: {} });
    const edit = (patch: Record<string, unknown>) => setConfig(current => ({ ...current, ...patch }));
    const value: DisplayRulesValue = { display_rules: planFrom(config.display_rules), targeting: config.targeting as DisplayRulesValue['targeting'], frequency: {}, schedule: {}, priority: 0 };
    return <DisplayRules vocabulary={ruleTypes()} value={value} overlay={false} onChange={edit} placement={{
      summary: 'Placement', opensRightAway: config.inline_placement != null || config.content_lock != null,
      controls: <PlacementSettings optinId="example" published config={config} vocabulary={ruleTypes()} onChange={edit} />,
    }} />;
  }
  render(<Builder />);
  const nav = screen.getByRole('navigation', { name: 'Display rules' });
  await user.click(within(nav).getByRole('button', { name: /When does it open/ }));
  expect(within(screen.getByRole('group', { name: 'When does it open?' })).getByRole('radio', { name: /^After/ })).not.toHaveAttribute('aria-disabled');

  for (const method of ['Automatic', 'Content lock']) {
    await user.click(within(nav).getByRole('button', { name: /Where does it show/ }));
    await user.click(screen.getByRole('radio', { name: method }));
    await user.click(screen.getByRole('button', { name: method === 'Automatic' ? 'Switch to automatic placement' : 'Switch to content lock' }));
    await user.click(within(nav).getByRole('button', { name: /When does it open/ }));
    const when = screen.getByRole('group', { name: 'When does it open?' });
    expect(within(when).getByRole('radio', { name: 'Right away' })).toBeChecked();
    expect(within(when).getByRole('radio', { name: /^After/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(when).getByRole('radio', { name: /^After/ })).toHaveAccessibleDescription('Inline placement opens right away.');
    // Back to manual for the next method, so its switch asks again.
    await user.click(within(nav).getByRole('button', { name: /Where does it show/ }));
    await user.click(screen.getByRole('radio', { name: 'Manual' }));
    await user.click(within(nav).getByRole('button', { name: /When does it open/ }));
    await user.click(within(screen.getByRole('group', { name: 'When does it open?' })).getByRole('radio', { name: /^After/ }));
    expect(within(screen.getByRole('group', { name: 'When does it open?' })).getByRole('radio', { name: /^After/ })).toBeChecked();
  }
});

it('offers the door when automatic placement no longer opens right away', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<PlacementSettings optinId="example" published config={{ inline_placement: { position: 'after_content' }, display_rules: displayPlan([{ type: 'time_on_page', seconds: 10 }]) }} vocabulary={vocabulary} onChange={onChange} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Automatic placement needs “When does it open?” set to Right away.');
  await user.click(screen.getByRole('button', { name: 'Set it to Right away' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ display_rules: expect.objectContaining({ opening: { mode: 'immediate' } }) }));
});

it('Free explains manual placement without carrying the premium controls', () => {
  render(<InlinePlacementSettings optinId="example" published config={{}} vocabulary={vocabulary} onChange={() => undefined} />);
  expect(screen.getByText('Place this campaign with its block or shortcode.')).toBeInTheDocument();
  expect(screen.queryByText(/Pro/)).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
});

/** Settings saved under Pro are explained without naming a product (ADR 0116). */
it('Free explains retained automatic placement and content lock without selling either', () => {
  render(<InlinePlacementSettings optinId="example" published config={{ inline_placement: { position: 'after_content' }, content_lock: { mode: 'hide' } }} vocabulary={vocabulary} onChange={() => undefined} />);
  expect(screen.getByText('Content lock isn’t available on this site. The selected region stays readable.')).toBeInTheDocument();
  expect(screen.getByText('Automatic placement isn’t available on this site. You can still place this campaign manually with its block or shortcode.')).toBeInTheDocument();
  expect(screen.queryByText(/Pro/)).toBeNull();
});

it('Free can explicitly return a previously automatic campaign to manual placement', async () => {
  const user = userEvent.setup();
  let changes: Record<string, unknown> = {};
  render(<InlinePlacementSettings optinId="example" published config={{ inline_placement: { position: 'after_content' } }} vocabulary={vocabulary} onChange={(patch) => { changes = patch; }} />);
  await user.click(screen.getByRole('button', { name: 'Use manual placement' }));
  expect(changes).toEqual({ inline_placement: null, content_lock: null });
});

it('automatic publish guidance does not tell merchants to insert a shortcode', () => {
  // A paid install; a free one falls back to manual placement (ADR 0116).
  window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
  onTestFinished(() => { delete window.wconvertAdmin; });
  render(<PlacementGuidance optinId="example" displayType="inline" inlinePlacement={{ position: 'after_paragraph', paragraph: 3 }} published />);
  expect(screen.getByText('Automatically after paragraph 3')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText(/No block or shortcode is needed/)).toBeInTheDocument();
});

it('hands a published content lock off to its region block and enclosing shortcode', () => {
  render(<PlacementGuidance optinId="example" displayType="inline" contentLock={{ mode: 'hide' }} published />);
  expect(screen.getByText(/Add the “WConvert Lock from here” divider/)).toBeVisible();
  expect(screen.getByText('[wconvert_content_lock id="example"]…[/wconvert_content_lock]')).toBeVisible();
  expect(screen.queryByText(/Add the “Inline Campaign” block/)).toBeNull();
});

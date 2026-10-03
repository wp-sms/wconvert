import { displayPlan } from '../../../tests/js/support/display-entry';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, onTestFinished } from 'vitest';
import PlacementSettings from '../../modules/inline-placement/admin/PlacementSettings';
import { InlinePlacementSettings } from '@/inlinePlacement';
import { PlacementGuidance } from '@/builder/PlacementGuidance';
import type { RuleVocabulary } from '@/builder/api';

const vocabulary = { triggers: [{ type: 'page_load' }, { type: 'time_on_page' }], conditions: [], targeting: [], bundles: [] } as unknown as RuleVocabulary;

it('groups the placement choices without repeating the section heading', () => {
  render(<PlacementSettings optinId="example" published config={{}} vocabulary={vocabulary} onChange={() => undefined} />);
  const choices = screen.getByRole('group', { name: 'Placement method' });
  expect(within(choices).getByRole('radio', { name: 'Manual' })).toBeChecked();
  expect(within(choices).getByRole('radio', { name: 'Automatic' })).not.toBeChecked();
  expect(screen.queryByText('Inline placement')).toBeNull();
});

it('makes trigger replacement and post-only defaults explicit, preserves other settings and can return to manual', async () => {
  const user = userEvent.setup();
  function Editor() {
    const [config, setConfig] = useState<Record<string, unknown>>({ display_rules: displayPlan([{ type: 'time_on_page', seconds: 10 }], [{ type: 'device', value: ['mobile'] }]), targeting: { exclude: [{ type: 'post', value: 4 }] }, frequency: { maxImpressions: 2 } });
    return <><PlacementSettings optinId="example" published config={config} vocabulary={vocabulary} onChange={(patch) => setConfig({ ...config, ...patch })} /><output data-testid="config">{JSON.stringify(config)}</output></>;
  }
  render(<Editor />);
  await user.click(screen.getByRole('radio', { name: 'Automatic' }));
  expect(screen.getByText(/replace existing triggers with page load/)).toBeInTheDocument();
  expect(screen.getByTestId('config')).toHaveTextContent('time_on_page');
  await user.click(screen.getByRole('button', { name: 'Enable automatic placement' }));
  expect(screen.getByRole('radio', { name: 'Automatic' })).toHaveFocus();
  const current = () => JSON.parse(screen.getByTestId('config').textContent!);
  expect(current()).toMatchObject({ inline_placement: { position: 'after_content' }, display_rules: displayPlan([{ type: 'page_load' }], [{ type: 'device', value: ['mobile'] }]), targeting: { include: [{ type: 'singular', value: 'post' }], exclude: [{ type: 'post', value: 4 }] }, frequency: { maxImpressions: 2 } });
  await user.selectOptions(screen.getByLabelText('Position in content'), 'after_paragraph');
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

it('preserves deliberate page targeting and warns about incompatible triggers', async () => {
  const user = userEvent.setup();
  let changes: Record<string, unknown> = {};
  render(<PlacementSettings optinId="example" published config={{ targeting: { include: [{ type: 'post', value: 99 }] }, rules: [{ type: 'page_load' }] }} vocabulary={vocabulary} onChange={(patch) => { changes = patch; }} />);
  await user.click(screen.getByRole('radio', { name: 'Automatic' }));
  expect(screen.queryByText(/posts only/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Enable automatic placement' }));
  expect(changes).not.toHaveProperty('targeting');
});

it('Free explains manual placement without carrying the premium controls', () => {
  render(<InlinePlacementSettings optinId="example" published config={{}} vocabulary={vocabulary} onChange={() => undefined} />);
  expect(screen.getByText('Place this Campaign with its block or shortcode.')).toBeInTheDocument();
  expect(screen.queryByText(/Pro/)).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
});

/** Settings saved under Pro are explained without naming a product (ADR 0116). */
it('Free explains retained automatic placement and content lock without selling either', () => {
  render(<InlinePlacementSettings optinId="example" published config={{ inline_placement: { position: 'after_content' }, content_lock: { mode: 'hide' } }} vocabulary={vocabulary} onChange={() => undefined} />);
  expect(screen.getByText('Content lock isn’t available on this site. The selected region stays readable.')).toBeInTheDocument();
  expect(screen.getByText('Automatic placement isn’t available on this site. You can still place this Campaign manually with its block or shortcode.')).toBeInTheDocument();
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

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import PlacementSettings from '../../modules/inline-placement/admin/PlacementSettings';
import { InlinePlacementSettings } from '@/inlinePlacement';
import { PlacementGuidance } from '@/builder/PlacementGuidance';
import type { RuleVocabulary } from '@/builder/api';

const vocabulary = { triggers: [{ type: 'page_load' }, { type: 'time_on_page' }], conditions: [], targeting: [], bundles: [] } as unknown as RuleVocabulary;

it('makes trigger replacement and post-only defaults explicit, preserves other settings and can return to manual', async () => {
  const user = userEvent.setup();
  function Editor() {
    const [config, setConfig] = useState<Record<string, unknown>>({ rules: [{ type: 'time_on_page', seconds: 10 }, { type: 'device', value: 'mobile' }], targeting: { exclude: [{ type: 'post', value: 4 }] }, frequency: { maxImpressions: 2 } });
    return <><PlacementSettings config={config} vocabulary={vocabulary} onChange={(patch) => setConfig({ ...config, ...patch })} /><output data-testid="config">{JSON.stringify(config)}</output></>;
  }
  render(<Editor />);
  await user.click(screen.getByRole('radio', { name: 'Automatic' }));
  expect(screen.getByText(/page load instead of other triggers/)).toBeInTheDocument();
  expect(screen.getByTestId('config')).toHaveTextContent('time_on_page');
  await user.click(screen.getByRole('button', { name: 'Enable automatic placement' }));
  const current = () => JSON.parse(screen.getByTestId('config').textContent!);
  expect(current()).toMatchObject({ inline_placement: { position: 'after_content' }, rules: [{ type: 'device', value: 'mobile' }, { type: 'page_load' }], targeting: { include: [{ type: 'singular', value: 'post' }], exclude: [{ type: 'post', value: 4 }] }, frequency: { maxImpressions: 2 } });
  await user.selectOptions(screen.getByLabelText('Position in content'), 'after_paragraph');
  await user.selectOptions(screen.getByLabelText('If there are fewer paragraphs'), 'skip');
  expect(current().inline_placement).toEqual({ position: 'after_paragraph', paragraph: 3, fallback: 'skip' });
  await user.click(screen.getByRole('radio', { name: 'Manual — block or shortcode' }));
  expect(current().inline_placement).toBeNull();
  expect(current().rules).toContainEqual({ type: 'page_load' });
});

it('preserves deliberate page targeting and warns about incompatible triggers', async () => {
  const user = userEvent.setup();
  let changes: Record<string, unknown> = {};
  render(<PlacementSettings config={{ targeting: { include: [{ type: 'post', value: 99 }] }, rules: [{ type: 'page_load' }] }} vocabulary={vocabulary} onChange={(patch) => { changes = patch; }} />);
  await user.click(screen.getByRole('radio', { name: 'Automatic' }));
  expect(screen.queryByText(/posts only/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Enable automatic placement' }));
  expect(changes).not.toHaveProperty('targeting');
});

it('Free explains availability without carrying the premium controls', () => {
  render(<InlinePlacementSettings config={{}} vocabulary={vocabulary} onChange={() => undefined} />);
  expect(screen.getByText(/Automatic placement is included in Pro/)).toBeInTheDocument();
  expect(screen.queryByRole('radio')).toBeNull();
});

it('automatic publish guidance does not tell merchants to insert a shortcode', () => {
  render(<PlacementGuidance optinId="example" displayType="inline" inlinePlacement={{ position: 'after_paragraph', paragraph: 3 }} published />);
  expect(screen.getByText('Automatically after paragraph 3')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText(/No block or shortcode is needed/)).toBeInTheDocument();
});

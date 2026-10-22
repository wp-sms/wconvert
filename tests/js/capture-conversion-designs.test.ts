import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Template, TemplateTree } from '@renderer/types';
import { captureSwitch, convertCapture, type CaptureTarget, type Conversion } from '../../resources/admin/src/builder/structure/captureConversion';
import { walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { GOALS } from './support/goals';

/**
 * Every design, with and without a form (ADR 0163, A4). Each one the switch
 * offers converts each way, comes back as it was, never shows a code before a
 * submission (G5) and stays within seven screens (G3). With
 * `WCONVERT_DUMP_CONVERSIONS=<file>` the converted drafts are written out for
 * `bin/verify-converted-designs.php` to check against the PHP contracts.
 */
type Design = Template & { id: string; display_type: string };

const roots = [resolve('resources/templates/library'), resolve('tools/design-library/hosted/templates'),
  ...readdirSync(resolve('pro/modules'), { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => resolve('pro/modules', entry.name, 'templates'))];
const designs = roots.flatMap(root => {
  try { return readdirSync(root).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(resolve(root, file), 'utf8')) as Design); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
});

/** As the editor holds it: every counted link points somewhere. */
const linked = (design: Design): Record<string, unknown> => ({ template_id: design.id, display_type: design.display_type,
  template: { tokens: design.tokens, tree: JSON.parse(JSON.stringify(design.tree).replaceAll('"action":"link"', '"action":"link","href":"https://shop.test/offer"')) } });
const goalOf = (tree: TemplateTree): string | null => {
  const all = tree.steps.flatMap(step => walkNodes(step.content));
  if (tree.submissions.length === 0) return all.some(node => node.type === 'button' && 'action' in node && node.action === 'link') ? 'promote_offer' : 'show_message';
  const asks = (name: string) => all.some(node => node.type === 'field' && 'name' in node && node.name === name && 'required' in node && node.required);
  // A list design carries a consent, shown or not; an enquiry design asks none.
  if (!all.some(node => node.type === 'consent')) return asks('email') || asks('phone') ? 'collect_enquiries' : null;
  return asks('email') ? 'grow_email_list' : asks('phone') ? 'grow_sms_list' : null;
};
const treeOf = (config: Record<string, unknown>) => (config.template as Template).tree;
const idless = (value: unknown): unknown => Array.isArray(value) ? value.map(idless)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id').map(([key, item]) => [key, idless(item)])) : value;
/** Form text the switch regenerates by design (H2): it is compared without it. */
const unworded = (value: unknown): unknown => Array.isArray(value) ? value.map(unworded)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
    .filter(([key]) => !(['field', 'consent'].includes(String((value as { type?: unknown }).type)) && ['label', 'placeholder', 'text', 'link', 'name', 'hidden'].includes(key)))
    .map(([key, item]) => [key, unworded(item)])) : value;

const dumped: { design: string; target: string; goal: string; config: Record<string, unknown> }[] = [];
const convert = (design: Design, config: Record<string, unknown>, goal: string, target: CaptureTarget): Conversion => {
  const result = convertCapture({ config, goal }, target, { goals: GOALS });
  if ('reason' in result) throw new Error(`${design.id} → ${target.capture}: ${result.reason}`);
  dumped.push({ design: design.id, target: target.capture + ('link' in target && target.link ? '+link' : ''), goal: result.goal, config: result.config });
  return result;
};

/** No screen before the main submission shows the reward (G5), and at most seven screens (G3). */
function expectSafe(tree: TemplateTree) {
  expect(tree.steps.length).toBeLessThanOrEqual(7);
  const submitAt = tree.steps.findIndex(step => walkNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
  tree.steps.forEach((step, at) => {
    if (submitAt >= 0 && at <= submitAt) expect(walkNodes(step.content).filter(node => node.type === 'code' || node.type === 'followup')).toEqual([]);
  });
}

afterAll(() => {
  const file = process.env.WCONVERT_DUMP_CONVERSIONS;
  if (file) writeFileSync(file, JSON.stringify(dumped));
});

it('reads the Free library, the hosted designs and every Pro template module', () => {
  expect(designs.length).toBeGreaterThanOrEqual(150);
});

const offered = designs.map(design => ({ design, goal: goalOf(design.tree) }))
  .filter((entry): entry is { design: Design; goal: string } => entry.goal !== null)
  .map(entry => ({ ...entry, offer: captureSwitch(linked(entry.design), entry.goal, GOALS) }));

describe.each(offered.filter(entry => entry.offer.offered && entry.offer.state === 'none').map(entry => [entry.design.id, entry]))('%s, which has no form', (_, { design, goal }) => {
  it.each(['email', 'phone'] as const)('takes a %s form and gives it back as it was', (channel) => {
    const signup = convert(design, linked(design), goal, { capture: channel });
    expectSafe(treeOf(signup.config));
    expect(treeOf(signup.config).steps.map(step => step.kind)).toEqual(['input', 'acknowledgement']);
    const back = convert(design, signup.config, signup.goal, { capture: 'none' });
    expect(back.goal).toBe(goal);
    expect(idless(treeOf(back.config).steps)).toEqual(idless(treeOf(linked(design)).steps));
  });
});

describe.each(offered.filter(entry => entry.offer.offered && entry.offer.state !== 'none').map(entry => [entry.design.id, entry]))('%s, which has a form', (_, { design, goal, offer }) => {
  it('loses it, with or without a button to carry', () => {
    const message = convert(design, linked(design), goal, { capture: 'none' });
    expect(message.goal).toBe('show_message');
    expect(treeOf(message.config).steps).toHaveLength(1);
    const shop = convert(design, linked(design), goal, { capture: 'none', link: { label: 'Shop now', href: 'https://shop.test/shop/' } });
    expect(shop.goal).toBe('promote_offer');
    expectSafe(treeOf(shop.config));
  });

  it('changes channel and back, keeping every word but the form’s own', () => {
    const state = offer.offered ? offer.state : 'none';
    const other = state === 'email' ? 'phone' : 'email';
    const attempt = convertCapture({ config: linked(design), goal }, { capture: other }, { goals: GOALS });
    // A second signup already on that channel is the merchant's to rearrange.
    if ('reason' in attempt) { expect(attempt.reason).toMatch(/already asks/u); return; }
    const swapped = convert(design, linked(design), goal, { capture: other });
    expectSafe(treeOf(swapped.config));
    const back = convert(design, swapped.config, swapped.goal, { capture: state as 'email' | 'phone' });
    expect(back.goal).toBe(goal);
    expect(unworded(idless(treeOf(back.config).steps))).toEqual(unworded(idless(treeOf(linked(design)).steps)));
  });
});

it('offers the switch on every design but quizzes and product blocks', () => {
  const refused = offered.filter(entry => !entry.offer.offered).map(entry => `${entry.design.id}: ${'reason' in entry.offer ? entry.offer.reason : ''}`);
  // Quizzes and product blocks are the expected refusals.
  expect(refused.every(line => /Quizzes|Product|branches/u.test(line)), refused.join('\n')).toBe(true);
});

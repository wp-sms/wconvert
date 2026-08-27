import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * The builder shell, against the four decisions #69 and #71 make about it that
 * are not layout.
 *
 * #29 drew the line — *"Not a TDD seam: React component structure, panel
 * layout, gallery chrome"* — and none of these is on the far side of it:
 *
 * - **Four tabs, not five.** Triggers, Conditions and page targeting are three
 *   answers to one question, and a merchant arrives expecting them together.
 *   Whether the two editors reach the same screen is a fact about the product.
 * - **The preview is beside every tab.** It lived inside the settings panel, so
 *   editing a Trigger showed no preview at all — the exact failure the pinned
 *   column exists to end.
 * - **This Optin's numbers are here.** *Is this change worth making?* is asked
 *   in the editor and was answerable two screens away, and the read is
 *   swallowed on failure, so an analytics outage must not cost anyone a Save.
 * - **Leaving with unsaved work asks first.** This admin does not save as you
 *   type, deliberately; the price of that is a question at the one door out.
 */

const builder = vi.hoisted(() => ({
  getOptin: vi.fn(),
  getRules: vi.fn(),
  saveOptin: vi.fn(),
  getThemeTokens: vi.fn(),
}));

const templates = vi.hoisted(() => ({ listTemplates: vi.fn() }));
const stats = vi.hoisted(() => ({ readDashboard: vi.fn() }));
const destinations = vi.hoisted(() => ({ readDestinations: vi.fn() }));

vi.mock('../../resources/admin/src/builder/api', () => builder);
vi.mock('../../resources/admin/src/templates/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/templates/api')>()),
  ...templates,
}));
vi.mock('../../resources/admin/src/stats/api', () => stats);
vi.mock('../../resources/admin/src/destinations/api', () => destinations);

const { OptinBuilder } = await import('../../resources/admin/src/builder/OptinBuilder');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

const ID = '01JQ00000000000000000000AA';

const vocabulary = ruleTypes();

const LABELS = {
  roles: { headline: 'Headline', fine_print: 'Fine print' },
  nodes: {},
  fields: { email: 'Email address' },
  keys: { text: 'Text', label: 'Label', placeholder: 'Placeholder', link: 'Link' },
  tokens: { bg: 'Background' },
};

function optin(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    name: 'Welcome discount',
    goal: 'grow_email_list',
    published_at: null,
    config: { template_id: 'centred-card', template: { tree: ENTRY.tree, tokens: ENTRY.tokens } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  builder.getOptin.mockResolvedValue(optin());
  builder.getRules.mockResolvedValue(vocabulary);
  builder.saveOptin.mockImplementation((_id: string, _name: string, config: Record<string, unknown>) =>
    Promise.resolve({ ...optin(), config }),
  );
  templates.listTemplates.mockResolvedValue({ templates: [ENTRY], labels: LABELS });
  stats.readDashboard.mockResolvedValue({ from: '', to: '', days: 30, goals: [] });
  destinations.readDestinations.mockResolvedValue({ destinations: [], types: [] });
});

const open = () => render(<OptinBuilder id={ID} onClose={vi.fn()} />);

describe('the builder shell', () => {
  /**
   * **Four, and *Display rules* is the merged one.** "When does this fire",
   * "who is eligible" and "which pages" were three tabs' worth of one question.
   */
  it('offers four tabs, with the three rule surfaces under one of them', async () => {
    open();

    expect(await screen.findByRole('tab', { name: 'Design' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Design',
      'Content',
      'Display rules',
      'Destinations',
    ]);
  });

  /**
   * The merge is a TAB and not a model: the two editors render unchanged, one
   * under the other, still over the two client axes and the server one
   * (ADR 0005).
   */
  it('puts triggers, conditions and page targeting on that one tab', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Display rules' }));

    expect(screen.getByRole('heading', { name: 'When it shows' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who sees it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Where it shows' })).toBeInTheDocument();
  });

  /**
   * **The preview follows every tab.** Inside the settings panel it was on one
   * of them, which is the same as saying a merchant tightening a Trigger could
   * not see what they were tightening.
   */
  it('keeps the preview on screen while the rules are being edited', async () => {
    open();

    const preview = await screen.findByRole('complementary', { name: 'Preview' });

    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));

    expect(preview).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: 'Mobile' })).toBeInTheDocument();
  });

  /** Mobile is a WIDTH, because reflow is the question a phone preview answers. */
  it('constrains the preview when the merchant asks for a phone', async () => {
    open();

    const preview = await screen.findByRole('complementary', { name: 'Preview' });

    await userEvent.click(within(preview).getByRole('button', { name: 'Mobile' }));

    expect(preview.querySelector('[data-device]')).toHaveAttribute('data-device', 'mobile');
  });

  /**
   * **A draft has been shown to nobody**, and a row of dashes over the editor
   * reads as a broken panel rather than as "not yet".
   */
  it('says nothing about numbers for an Optin that was never published', async () => {
    open();

    await screen.findByRole('tab', { name: 'Design' });

    expect(screen.queryByText('Impressions')).toBeNull();
    expect(stats.readDashboard).not.toHaveBeenCalled();
  });

  it('shows this Optin’s own numbers once it is live, named by its Goal', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-08-01 09:00:00' }));
    stats.readDashboard.mockResolvedValue({
      from: '',
      to: '',
      days: 30,
      goals: [
        {
          goal: 'grow_email_list',
          label: 'Grow my email list',
          headline_label: 'Submissions',
          optins: [{ id: ID, name: 'Welcome discount', headline: 42, impressions: 1000, conversion_rate: 0.042 }],
        },
      ],
    });

    open();

    expect(await screen.findByText('Submissions')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
  });

  /**
   * **Swallowed, exactly as the Goal registry's is on the Optin list.** Numbers
   * are a nicety on an editing screen; an analytics outage must not put an
   * error banner over a builder that is working, and must not cost the Save.
   */
  it('still edits and still saves when the numbers cannot be read', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-08-01 09:00:00' }));
    stats.readDashboard.mockRejectedValue(new Error('nope'));

    open();

    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.queryByText('nope')).toBeNull();
  });
});

/**
 * ============================================================================
 * LEAVING WITH UNSAVED WORK ASKS FIRST.
 * ============================================================================
 * Explicit Save stays — `config` is the working draft and `published_config` is
 * what the site serves, and editing is deliberately not publishing. The price
 * of an explicit Save is that the one door out has to ask.
 */
describe('the way out of the builder', () => {
  it('leaves at once when there is nothing to lose', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.click(await screen.findByRole('button', { name: 'All Optins' }));

    expect(closed).toHaveBeenCalled();
  });

  it('asks before discarding an edit, and keeps the merchant here if they say no', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(closed).not.toHaveBeenCalled();
  });

  it('leaves when the merchant says to discard', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));

    expect(closed).toHaveBeenCalled();
  });

  /** A saved edit is not unsaved work, so the door stops asking. */
  it('stops asking once the work is saved', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/Saved\./);
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));

    expect(closed).toHaveBeenCalled();
  });
});

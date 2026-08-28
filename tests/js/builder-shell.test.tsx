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
 * - **~~Four~~ five tabs.** Triggers, Conditions and page targeting are three
 *   answers to one question, and a merchant arrives expecting them together —
 *   that merge is unchanged. What is new beside it is **Structure**, which is
 *   the other view of the document Content already edits. Whether these editors
 *   reach the same screen is a fact about the product.
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
/*
 * Spread over the real module rather than replacing it, exactly as
 * `templates/api` is above. `readDashboard` is the fetch and belongs stubbed;
 * `numbersByOptin` beside it is a pure walk over the payload this file already
 * writes by hand, and stubbing the module wholesale replaced it with
 * `undefined` — a builder that silently showed no numbers at all.
 */
vi.mock('../../resources/admin/src/stats/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/stats/api')>()),
  ...stats,
}));
vi.mock('../../resources/admin/src/destinations/api', () => destinations);

const { OptinBuilder } = await import('../../resources/admin/src/builder/OptinBuilder');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

const ID = '01JQ00000000000000000000AA';

const vocabulary = ruleTypes();

const LABELS = {
  roles: { headline: 'Headline', body: 'Body text', fine_print: 'Fine print' },
  nodes: { heading: 'Heading', text: 'Text', button: 'Button', consent: 'Consent checkbox' },
  layouts: { stack: 'Column', row: 'Row', split: 'Side by side', grid: 'Grid' },
  fields: { email: 'Email address' },
  keys: { text: 'Text', label: 'Label', placeholder: 'Placeholder', link: 'Link' },
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
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

/**
 * A block row's own name button, as opposed to the three controls beside it
 * that are also named after the block.
 *
 * The move and menu buttons carry the block's name deliberately — fifteen
 * buttons reading "Move up" are fifteen buttons a screen-reader user cannot
 * tell apart — so "the button called Headline" is genuinely ambiguous, and this
 * asks the row for the one that selects.
 */
const labelOf = (name: string | RegExp) =>
  within(screen.getByRole('row', { name })).getAllByRole('button')[0];

describe('the builder shell', () => {
  /**
   * **~~Four~~ ~~five~~ four, and the count has now moved three times.**
   *
   * *Display rules* is still the merged one — "when does this fire", "who is
   * eligible" and "which pages" were three tabs' worth of one question — and
   * that is untouched. What went is **Structure**: with an inspector under the
   * tree it and *Content* were one screen drawn twice, and a merchant changing
   * a headline had to pick which copy of it to open.
   *
   * This assertion is edited rather than deleted each time, because a test
   * breaking here is behaviour moving and ADR 0039 asks that it be recorded in
   * the commit that moves it rather than quietly rewritten. The ADR's own tab
   * count is struck through again in the same commit.
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
   * ========================================================================
   * THE TREE IS THE DESIGN'S OWN BLOCKS, LAYOUTS INCLUDED.
   * ========================================================================
   * `slotsOf` walks leaves and flattens them, which is right for a column of
   * words. A merchant MOVING the email field is moving it within the `row`, so
   * the row has to be a row.
   */
  it('lists every block of the design, layouts included, as a treegrid', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    const tree = screen.getByRole('treegrid', { name: 'Blocks in this design' });

    expect(within(tree).getByRole('row', { name: /The form/ })).toBeInTheDocument();
    expect(within(tree).getByRole('row', { name: /Headline/ })).toBeInTheDocument();
    expect(within(tree).getByRole('row', { name: /Email address/ })).toBeInTheDocument();
  });

  /**
   * **Named by what it says, never "item 3 of 5".** Position is announced by
   * `aria-level`, `aria-posinset` and `aria-setsize` — after the name, rather
   * than instead of it.
   */
  it('names a row by the words the block is showing, and states its place separately', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    const headline = screen.getByRole('row', { name: /Headline/ });

    expect(headline).toHaveAccessibleName(expect.stringContaining('Get 10% off your first order'));
    expect(headline).toHaveAttribute('aria-level', '2');
    expect(headline).toHaveAttribute('aria-posinset', '1');
  });

  /**
   * **Selection is the one string ADR 0040 built, on a third surface.** It
   * carries no way to REACH a slot, so nothing that receives one gains the
   * ability to write — which is why the tree can share it with the preview.
   */
  it('marks a block selected when its row is clicked', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));
    await userEvent.click(labelOf(/Headline/));

    expect(screen.getByRole('row', { name: /Headline/ })).toHaveAttribute('aria-selected', 'true');
  });

  /**
   * **Exactly one tab stop for the whole grid.** A `tabindex="0"` per control
   * would put sixty stops between the tab strip and the Save button on a
   * fifteen-block design.
   */
  it('keeps one tab stop across the whole tree', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    const tree = screen.getByRole('treegrid', { name: 'Blocks in this design' });
    const tabbable = within(tree).getAllByRole('button').filter((button) => button.tabIndex === 0);

    expect(tabbable).toHaveLength(1);
  });

  /**
   * ========================================================================
   * THE EDITOR IS NEVER A LIST WITH AN INSTRUCTION UNDER IT.
   * ========================================================================
   * A merchant opening the tab is already editing the first block. Not the
   * first ROW — that is a step, and a step is not a block a merchant arranges
   * (ADR 0025) — but the first thing inside it, which is what someone reading
   * the design top to bottom would have clicked.
   */
  it('has the first block selected on arrival, so the inspector is never empty', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    expect(screen.getByRole('row', { name: /Headline/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: 'Headline' })).toBeInTheDocument();
  });

  /**
   * **The selection survives a walk to the look and back.** Design holds the
   * tokens now, and a merchant who went to change a colour and came back should
   * find the block they were on still open — the outline in the preview must
   * not blink off and on for no reason they could name.
   */
  it('keeps the selected block while the merchant goes to the design and back', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));
    await userEvent.click(labelOf(/Body text/));
    await userEvent.click(screen.getByRole('tab', { name: 'Design' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Content' }));

    expect(screen.getByRole('row', { name: /Body text/ })).toHaveAttribute('aria-selected', 'true');
  });

  /**
   * ========================================================================
   * THE OUTLINE GOES; THE SELECTION DOES NOT.
   * ========================================================================
   * They used to be one thing. The outline says *this is the block you are
   * working on*, and left up over the rules tab it is a highlight with nothing
   * on screen explaining it — so the selection was cleared on the way out.
   *
   * That answer stopped working when the selection also decided what the
   * inspector was showing: a merchant coming back from the rules would find an
   * editor with no block open, which is the empty panel the arrival selection
   * exists to prevent. So the tab decides what the PREVIEW is handed, and the
   * selection survives the walk.
   *
   * What the preview does with a null is inside a closed shadow root and is not
   * observable from here — it is on the browser pass with the rest of the CSS.
   */
  it('keeps the block open while the merchant is away editing the rules', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));
    await userEvent.click(labelOf(/Body text/));
    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Content' }));

    expect(screen.getByRole('row', { name: /Body text/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: 'Body text' })).toBeInTheDocument();
  });

  /**
   * **Authoring is the editor plus a DEV-ONLY export** (ADR 0010), and a
   * merchant has no use for the library entry behind their popup.
   */
  it('keeps the library entry off the design tab unless WP_DEBUG is on', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Design' }));

    expect(screen.queryByText(/Library entry/)).toBeNull();
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
  /**
   * **Waits for the builder before leaving it, and that is not ceremony.** The
   * skeleton draws its own way out — it has to, since a merchant on a slow
   * connection must be able to turn back before the Optin arrives (#73) — so
   * this clicked the placeholder's button on the frame before the real one
   * existed. React replaces the whole subtree when the skeleton gives way, so
   * the node it had was detached by the time it was clicked, and the assertion
   * was about a control nobody could still see.
   */
  it('leaves at once when there is nothing to lose', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await screen.findByRole('tab', { name: 'Design' });
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));

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
